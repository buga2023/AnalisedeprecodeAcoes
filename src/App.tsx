import { useCallback, useMemo, useState } from "react";
import { LoginScreen } from "@/components/LoginScreen";
import { AppShell } from "@/components/praxia/AppShell";
import { BottomNav, type NavTab } from "@/components/praxia/BottomNav";
import { FloatingPraButton } from "@/components/praxia/FloatingPraButton";
import { ScreenOnboarding } from "@/components/praxia/screens/ScreenOnboarding";
import { ScreenQuiz } from "@/components/praxia/screens/ScreenQuiz";
import { ScreenHome } from "@/components/praxia/screens/ScreenHome";
import { ScreenMarket } from "@/components/praxia/screens/ScreenMarket";
import { ScreenStockDetail } from "@/components/praxia/screens/ScreenStockDetail";
import { ScreenOrder } from "@/components/praxia/screens/ScreenOrder";
import { ScreenOrderReview } from "@/components/praxia/screens/ScreenOrderReview";
import { ScreenActivity } from "@/components/praxia/screens/ScreenActivity";
import { ScreenProfile } from "@/components/praxia/screens/ScreenProfile";
import { ChatSheet } from "@/components/praxia/ChatSheet";
import { QuickWatch } from "@/components/praxia/QuickWatch";
import { PortfolioInsightsModal } from "@/components/praxia/PortfolioInsightsModal";
import { useStockQuotes } from "@/hooks/useStockQuotes";
import { useInvestorProfile } from "@/hooks/useInvestorProfile";
import { useTransactions } from "@/hooks/useTransactions";
import { useUIPreferences } from "@/hooks/useUIPreferences";
import { useAIProvider } from "@/hooks/useAIProvider";
import { totalPortfolioValue } from "@/lib/portfolio";
import type {
  AIProviderConfig,
  OrderType,
  Stock,
  TransactionType,
} from "@/types/stock";

type Screen = "home" | "market" | "stock" | "order" | "review" | "activity" | "profile";

interface OrderDraft {
  shares: number;
  total: number;
  fee: number;
  orderType: OrderType;
  type: TransactionType;
}

function PraxiaApp({ username, onLogout }: { username: string; onLogout: () => void }) {
  const { accent, setAccent, tone, setTone } = useUIPreferences();
  const { profile, saveProfile, reset: resetProfile } = useInvestorProfile();
  const { stocks, addStock, applyTransaction, toggleFavorite, error, clearError } =
    useStockQuotes();
  const { transactions, record, clear: clearTransactions } = useTransactions();
  const { providerConfig, setProviderConfig, clearProviderConfig } = useAIProvider();

  const [bootScreen, setBootScreen] = useState<"onboarding" | "quiz" | "app">(() => {
    if (profile) return "app";
    return "onboarding";
  });

  const [screen, setScreen] = useState<Screen>("home");
  const [activeTicker, setActiveTicker] = useState<string | null>(null);
  const [activeFallback, setActiveFallback] = useState<Stock | null>(null);
  const [orderDraft, setOrderDraft] = useState<OrderDraft | null>(null);
  const [pendingType, setPendingType] = useState<TransactionType>("buy");
  const [quickWatch, setQuickWatch] = useState<Stock | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);

  // Derive the currently-active stock straight from the portfolio so it
  // always reflects the latest quote without manual sync. Falls back to a
  // snapshot for tickers the user inspected via search but hasn't bought.
  const activeStock = useMemo<Stock | null>(() => {
    if (!activeTicker) return null;
    return stocks.find((s) => s.ticker === activeTicker) ?? activeFallback;
  }, [activeTicker, stocks, activeFallback]);

  const totalValue = useMemo(() => totalPortfolioValue(stocks), [stocks]);

  const openStock = useCallback((s: Stock) => {
    setActiveTicker(s.ticker);
    setActiveFallback(s);
    setQuickWatch(null);
    setScreen("stock");
  }, []);

  const startOrder = useCallback((s: Stock, type: TransactionType) => {
    setActiveTicker(s.ticker);
    setActiveFallback(s);
    setPendingType(type);
    setOrderDraft(null);
    setQuickWatch(null);
    setScreen("order");
  }, []);

  const confirmOrder = useCallback(async () => {
    if (!activeStock || !orderDraft) return;
    const ok = await applyTransaction(
      activeStock.ticker,
      orderDraft.type,
      orderDraft.shares,
      activeStock.price
    );
    if (!ok) return;
    record({
      ticker: activeStock.ticker,
      type: orderDraft.type,
      orderType: orderDraft.orderType,
      shares: orderDraft.shares,
      price: activeStock.price,
      total: orderDraft.total,
      fee: orderDraft.fee,
    });
    setOrderDraft(null);
    setScreen("activity");
  }, [activeStock, orderDraft, applyTransaction, record]);

  const handleProviderSave = useCallback(
    (config: AIProviderConfig | null) => {
      if (config) setProviderConfig(config);
      else clearProviderConfig();
    },
    [setProviderConfig, clearProviderConfig]
  );

  const clearAllLocal = useCallback(() => {
    if (!window.confirm("Apagar TODOS os dados locais (perfil, carteira, transações, chat)?")) return;
    resetProfile();
    clearTransactions();
    localStorage.removeItem("stocks-ai-portfolio");
    localStorage.removeItem("praxia-pra-chat");
    window.location.reload();
  }, [resetProfile, clearTransactions]);

  // ── Boot flow ───────────────────────────────────────────────────────────
  if (bootScreen === "onboarding") {
    return (
      <AppShell>
        <ScreenOnboarding accent={accent} onStart={() => setBootScreen("quiz")} />
      </AppShell>
    );
  }

  if (bootScreen === "quiz") {
    return (
      <AppShell>
        <ScreenQuiz
          accent={accent}
          onComplete={(p) => {
            saveProfile(p);
            setBootScreen("app");
          }}
        />
      </AppShell>
    );
  }

  // ── Main app ────────────────────────────────────────────────────────────
  const showNav = ["home", "market", "activity", "profile"].includes(screen);
  const showFab = showNav;

  return (
    <AppShell>
      {error && (
        <div
          onClick={clearError}
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            right: 12,
            zIndex: 60,
            padding: "10px 14px",
            background: "rgba(255,107,129,0.16)",
            border: "0.5px solid rgba(255,107,129,0.4)",
            borderRadius: 12,
            color: "#ff6b81",
            fontSize: 12.5,
            fontFamily: '"Manrope", sans-serif',
            cursor: "pointer",
          }}
        >
          {error} (toque para fechar)
        </div>
      )}

      {screen === "home" && (
        <ScreenHome
          accent={accent}
          stocks={stocks}
          profile={profile}
          onOpenStock={(s) => setQuickWatch(s)}
          onSeeAllHoldings={() => setScreen("market")}
          onAddStock={() => setScreen("market")}
          onOpenInsights={() => setInsightsOpen(true)}
        />
      )}

      {screen === "market" && (
        <ScreenMarket
          accent={accent}
          stocks={stocks}
          profile={profile}
          onOpenStock={(s) => setQuickWatch(s)}
          onAddTicker={async (ticker) => {
            const added = await addStock(ticker, 0, 0);
            return added !== null;
          }}
        />
      )}

      {screen === "activity" && (
        <ScreenActivity accent={accent} transactions={transactions} />
      )}

      {screen === "profile" && (
        <ScreenProfile
          accent={accent}
          onAccentChange={setAccent}
          tone={tone}
          onToneChange={setTone}
          profile={profile}
          username={username}
          providerConfig={providerConfig}
          onProviderSave={handleProviderSave}
          onRetakeQuiz={() => {
            resetProfile();
            setBootScreen("quiz");
          }}
          onLogout={onLogout}
          onClearLocalData={clearAllLocal}
        />
      )}

      {screen === "stock" && activeStock && (
        <ScreenStockDetail
          accent={accent}
          stock={activeStock}
          profile={profile}
          isFavorite={activeStock.isFavorite}
          isOwned={(activeStock.quantity || 0) > 0}
          onBack={() => setScreen("home")}
          onBuy={(s) => startOrder(s, "buy")}
          onSell={(s) => startOrder(s, "sell")}
          onToggleFavorite={() => toggleFavorite(activeStock.ticker)}
        />
      )}

      {screen === "order" && activeStock && (
        <ScreenOrder
          accent={accent}
          stock={activeStock}
          type={pendingType}
          maxShares={pendingType === "sell" ? activeStock.quantity : undefined}
          onBack={() => setScreen(activeStock ? "stock" : "home")}
          onConfirm={(draft) => {
            setOrderDraft(draft);
            setScreen("review");
          }}
        />
      )}

      {screen === "review" && activeStock && orderDraft && (
        <ScreenOrderReview
          accent={accent}
          stock={activeStock}
          draft={orderDraft}
          totalPortfolio={totalValue}
          onClose={() => setScreen("order")}
          onConfirm={confirmOrder}
        />
      )}

      {showNav && (
        <BottomNav
          tab={screen as NavTab}
          onChange={(t) => setScreen(t)}
          accent={accent}
        />
      )}

      {showFab && (
        <FloatingPraButton accent={accent} onClick={() => setChatOpen(true)} />
      )}

      <QuickWatch
        accent={accent}
        stock={quickWatch ?? stocks[0] ?? activeStock!}
        open={quickWatch !== null}
        onClose={() => setQuickWatch(null)}
        onBuy={() => quickWatch && startOrder(quickWatch, "buy")}
        onSell={() => quickWatch && startOrder(quickWatch, "sell")}
        onSeeDetail={() => quickWatch && openStock(quickWatch)}
      />

      <ChatSheet
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        accent={accent}
        tone={tone}
        profile={profile}
        stocks={stocks}
        totalValue={totalValue}
        onProfileDetected={(draft) => {
          saveProfile(draft);
        }}
      />

      <PortfolioInsightsModal
        open={insightsOpen}
        onClose={() => setInsightsOpen(false)}
        stocks={stocks}
        profile={profile}
        accent={accent}
      />
    </AppShell>
  );
}

function App() {
  const [authenticated, setAuthenticated] = useState(false);

  if (!authenticated) {
    return <LoginScreen onLogin={() => setAuthenticated(true)} />;
  }

  return (
    <PraxiaApp username="admin" onLogout={() => setAuthenticated(false)} />
  );
}

export default App;
