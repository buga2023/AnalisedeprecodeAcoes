import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { LoginScreen } from "@/components/LoginScreen";
import { AppShell } from "@/components/praxia/AppShell";
import { BottomNav, type NavTab } from "@/components/praxia/BottomNav";
import { FloatingPraButton } from "@/components/praxia/FloatingPraButton";
import { ScreenOnboarding } from "@/components/praxia/screens/ScreenOnboarding";
import { ScreenOnboardingB } from "@/components/praxia/screens/ScreenOnboardingB";
import { ScreenQuiz } from "@/components/praxia/screens/ScreenQuiz";
import { ScreenHome } from "@/components/praxia/screens/ScreenHome";
import { ScreenMarket } from "@/components/praxia/screens/ScreenMarket";
import { ScreenActivity } from "@/components/praxia/screens/ScreenActivity";
import { ScreenProfile } from "@/components/praxia/screens/ScreenProfile";
import { AlertSheet } from "@/components/praxia/AlertSheet";
import { QuickWatch } from "@/components/praxia/QuickWatch";

// Screens / modais secundários — carregados sob demanda pra reduzir o bundle
// inicial (de ~872 kB pra ~480 kB no chunk principal).
const ScreenStockDetail = lazy(() =>
  import("@/components/praxia/screens/ScreenStockDetail").then((m) => ({ default: m.ScreenStockDetail }))
);
const ScreenOrder = lazy(() =>
  import("@/components/praxia/screens/ScreenOrder").then((m) => ({ default: m.ScreenOrder }))
);
const ScreenOrderReview = lazy(() =>
  import("@/components/praxia/screens/ScreenOrderReview").then((m) => ({ default: m.ScreenOrderReview }))
);
const ScreenBatchValuation = lazy(() =>
  import("@/components/praxia/screens/ScreenBatchValuation").then((m) => ({ default: m.ScreenBatchValuation }))
);
const ScreenAlerts = lazy(() =>
  import("@/components/praxia/screens/ScreenAlerts").then((m) => ({ default: m.ScreenAlerts }))
);
const ScreenCompare = lazy(() =>
  import("@/components/praxia/screens/ScreenCompare").then((m) => ({ default: m.ScreenCompare }))
);
const ScreenNews = lazy(() =>
  import("@/components/praxia/screens/ScreenNews").then((m) => ({ default: m.ScreenNews }))
);
const ChatSheet = lazy(() =>
  import("@/components/praxia/ChatSheet").then((m) => ({ default: m.ChatSheet }))
);
const PortfolioInsightsModal = lazy(() =>
  import("@/components/praxia/PortfolioInsightsModal").then((m) => ({ default: m.PortfolioInsightsModal }))
);
import { useStockQuotes } from "@/hooks/useStockQuotes";
import { useInvestorProfile } from "@/hooks/useInvestorProfile";
import { useTransactions } from "@/hooks/useTransactions";
import { useUIPreferences } from "@/hooks/useUIPreferences";
import { useAIProvider } from "@/hooks/useAIProvider";
import { useAlerts } from "@/hooks/useAlerts";
import { totalPortfolioValue } from "@/lib/portfolio";
import type {
  AIProviderConfig,
  OrderType,
  Stock,
  TransactionType,
} from "@/types/stock";

type Screen = "home" | "market" | "stock" | "order" | "review" | "activity" | "profile" | "batch" | "alerts" | "compare" | "news";

function ScreenFallback() {
  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(244,236,223,0.45)",
        fontFamily: '"Manrope", sans-serif',
        fontSize: 12,
        letterSpacing: 0.4,
      }}
    >
      Carregando…
    </div>
  );
}

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
  const {
    alerts,
    activeAlerts,
    permission: notifPermission,
    requestPermission: requestNotifPermission,
    createAlert,
    removeAlert,
    resetAlert,
    checkAlerts,
  } = useAlerts();

  const [bootScreen, setBootScreen] = useState<"quiz" | "app">(() => {
    if (profile) return "app";
    return "quiz";
  });

  const [screen, setScreen] = useState<Screen>("home");
  const [activeTicker, setActiveTicker] = useState<string | null>(null);
  const [activeFallback, setActiveFallback] = useState<Stock | null>(null);
  const [orderDraft, setOrderDraft] = useState<OrderDraft | null>(null);
  const [pendingType, setPendingType] = useState<TransactionType>("buy");
  const [quickWatch, setQuickWatch] = useState<Stock | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [alertSheetStock, setAlertSheetStock] = useState<Stock | null>(null);
  const [compareTickers, setCompareTickers] = useState<string[]>([]);

  const toggleCompareTicker = useCallback((ticker: string) => {
    setCompareTickers((prev) => {
      if (prev.includes(ticker)) return prev.filter((t) => t !== ticker);
      if (prev.length >= 4) return prev;
      return [...prev, ticker];
    });
  }, []);

  const addToCompareAndOpen = useCallback(
    (ticker: string) => {
      setCompareTickers((prev) => {
        if (prev.includes(ticker)) return prev;
        if (prev.length >= 4) return prev;
        return [...prev, ticker];
      });
      setScreen("compare");
    },
    []
  );

  // Whenever stocks change (live polling updates them), re-run alert checks.
  useEffect(() => {
    if (stocks.length === 0) return;
    checkAlerts(stocks);
  }, [stocks, checkAlerts]);

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
          onOpenProfile={() => setScreen("profile")}
          onOpenChat={() => setChatOpen(true)}
          onOpenAlerts={() => setScreen("alerts")}
          onOpenNews={() => setScreen("news")}
          activeAlertCount={activeAlerts.length}
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
          onOpenBatchValuation={() => setScreen("batch")}
          onLogout={onLogout}
          onClearLocalData={clearAllLocal}
        />
      )}

      <Suspense fallback={<ScreenFallback />}>
        {screen === "batch" && (
          <ScreenBatchValuation accent={accent} onBack={() => setScreen("profile")} />
        )}

        {screen === "alerts" && (
          <ScreenAlerts
            accent={accent}
            alerts={alerts}
            permission={notifPermission}
            onBack={() => setScreen("home")}
            onRequestPermission={() => {
              void requestNotifPermission();
            }}
            onRemove={removeAlert}
            onReset={resetAlert}
          />
        )}

        {screen === "compare" && (
          <ScreenCompare
            accent={accent}
            stocks={stocks}
            selectedTickers={compareTickers}
            profile={profile}
            onBack={() => setScreen("home")}
            onRemoveTicker={(t) => toggleCompareTicker(t)}
            onAddTicker={() => setScreen("market")}
          />
        )}

        {screen === "news" && (
          <ScreenNews
            accent={accent}
            profile={profile}
            stocks={stocks}
            onBack={() => setScreen("home")}
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
            onCreateAlert={(s) => setAlertSheetStock(s)}
            onCompare={(ticker) => addToCompareAndOpen(ticker)}
            isInCompareList={compareTickers.includes(activeStock.ticker)}
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
      </Suspense>

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

      {quickWatch && (
        <QuickWatch
          accent={accent}
          stock={quickWatch}
          open
          onClose={() => setQuickWatch(null)}
          onBuy={() => startOrder(quickWatch, "buy")}
          onSell={() => startOrder(quickWatch, "sell")}
          onSeeDetail={() => openStock(quickWatch)}
        />
      )}

      {chatOpen && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      <AlertSheet
        open={alertSheetStock !== null}
        accent={accent}
        stock={alertSheetStock}
        onClose={() => setAlertSheetStock(null)}
        onCreate={async ({ type, value, note }) => {
          if (!alertSheetStock) return;
          if (notifPermission === "default") await requestNotifPermission();
          createAlert({ ticker: alertSheetStock.ticker, type, value, note });
        }}
      />

      {insightsOpen && (
        <Suspense fallback={null}>
          <PortfolioInsightsModal
            open={insightsOpen}
            onClose={() => setInsightsOpen(false)}
            stocks={stocks}
            profile={profile}
            accent={accent}
          />
        </Suspense>
      )}
    </AppShell>
  );
}

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [bootStep, setBootStep] = useState<"onboardingA" | "onboardingB" | "login" | "app">(() => {
    const hasProfile = !!localStorage.getItem("praxia-investor-profile");
    if (hasProfile) return "login";
    return "onboardingA";
  });

  if (authenticated || bootStep === "app") {
    return (
      <PraxiaApp
        username="admin"
        onLogout={() => {
          setAuthenticated(false);
          setBootStep("login");
        }}
      />
    );
  }

  if (bootStep === "onboardingA") {
    return (
      <ScreenOnboarding
        onStart={() => setBootStep("onboardingB")}
        onLogin={() => setBootStep("login")}
      />
    );
  }

  if (bootStep === "onboardingB") {
    return (
      <ScreenOnboardingB
        onCreateAccount={() => setBootStep("app")}
        onLogin={() => setBootStep("login")}
      />
    );
  }

  return (
    <LoginScreen
      onLogin={() => {
        setAuthenticated(true);
        setBootStep("app");
      }}
    />
  );
}

export default App;
