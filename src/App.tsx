import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { LoginScreen } from "@/components/LoginScreen";
import { AppShell } from "@/components/praxia/AppShell";
import { BottomNav, type NavTab } from "@/components/praxia/BottomNav";
import { FloatingPraButton } from "@/components/praxia/FloatingPraButton";
import { CookieConsentBanner } from "@/components/praxia/CookieConsentBanner";
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
const ScreenAnalysis = lazy(() =>
  import("@/components/praxia/screens/ScreenAnalysis").then((m) => ({ default: m.ScreenAnalysis }))
);
const ScreenDividends = lazy(() =>
  import("@/components/praxia/screens/ScreenDividends").then((m) => ({ default: m.ScreenDividends }))
);
const ScreenLegalDoc = lazy(() =>
  import("@/components/praxia/screens/ScreenLegalDoc").then((m) => ({ default: m.ScreenLegalDoc }))
);
const ScreenDeleteAccount = lazy(() =>
  import("@/components/praxia/screens/ScreenDeleteAccount").then((m) => ({ default: m.ScreenDeleteAccount }))
);
const ChatSheet = lazy(() =>
  import("@/components/praxia/ChatSheet").then((m) => ({ default: m.ChatSheet }))
);
const PortfolioInsightsModal = lazy(() =>
  import("@/components/praxia/PortfolioInsightsModal").then((m) => ({ default: m.PortfolioInsightsModal }))
);
const OptimizeDividendsModal = lazy(() =>
  import("@/components/praxia/OptimizeDividendsModal").then((m) => ({ default: m.OptimizeDividendsModal }))
);
const ScreenRebalance = lazy(() =>
  import("@/components/praxia/screens/ScreenRebalance").then((m) => ({ default: m.ScreenRebalance }))
);
const ScreenTaxReport = lazy(() =>
  import("@/components/praxia/screens/ScreenTaxReport").then((m) => ({ default: m.ScreenTaxReport }))
);
import { useStockQuotes } from "@/hooks/useStockQuotes";
import { useInvestorProfile } from "@/hooks/useInvestorProfile";
import { useTransactions } from "@/hooks/useTransactions";
import { useUIPreferences } from "@/hooks/useUIPreferences";
import { useAIProvider } from "@/hooks/useAIProvider";
import { useAlerts } from "@/hooks/useAlerts";
import { useAuth } from "@/hooks/useAuth";
import { useDividendCalendar } from "@/hooks/useDividendCalendar";
import { totalPortfolioValue } from "@/lib/portfolio";
import type {
  AIProviderConfig,
  OrderType,
  Stock,
  TransactionType,
} from "@/types/stock";

type Screen = "home" | "market" | "analysis" | "stock" | "order" | "review" | "activity" | "profile" | "batch" | "alerts" | "compare" | "news" | "dividends" | "rebalance" | "tax-report" | "privacy" | "terms" | "delete-account";

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
    triggeredAlerts,
    permission: notifPermission,
    requestPermission: requestNotifPermission,
    createAlert,
    removeAlert,
    resetAlert,
    checkAlerts,
  } = useAlerts();
  // Lift do calendario de dividendos para o app raiz — fornece dados para o
  // digest semanal (WeeklyDigestCard) sem duplicar fetches Yahoo nas telas.
  const { rawHistoryByTicker } = useDividendCalendar(stocks);

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
  const [optimizeOpen, setOptimizeOpen] = useState(false);
  const [optimizeAnnual, setOptimizeAnnual] = useState(0);

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

  const showNav = ["home", "market", "analysis", "profile"].includes(screen);
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
          onOpenInsights={() => setScreen("analysis")}
          onOpenProfile={() => setScreen("profile")}
          onOpenChat={() => setChatOpen(true)}
          onOpenAlerts={() => setScreen("alerts")}
          onOpenNews={() => setScreen("news")}
          activeAlertCount={activeAlerts.length}
          transactions={transactions}
          triggeredAlerts={triggeredAlerts}
          dividendHistoryByTicker={rawHistoryByTicker}
          onNavigate={(target) => {
            // O DigestScreenTarget e um subset do Screen union — todos os valores
            // sao screens validos da app.
            setScreen(target);
          }}
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
        <ScreenActivity
          accent={accent}
          transactions={transactions}
          onOpenTaxReport={() => setScreen("tax-report")}
        />
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
          onOpenActivity={() => setScreen("activity")}
          onOpenDividends={() => setScreen("dividends")}
          onOpenPrivacy={() => setScreen("privacy")}
          onOpenTerms={() => setScreen("terms")}
          onOpenDeleteAccount={() => setScreen("delete-account")}
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

        {screen === "dividends" && (
          <ScreenDividends
            accent={accent}
            stocks={stocks}
            onBack={() => setScreen("profile")}
            onOptimize={(annual) => {
              setOptimizeAnnual(annual);
              setOptimizeOpen(true);
            }}
          />
        )}

        {screen === "analysis" && (
          <ScreenAnalysis
            accent={accent}
            stocks={stocks}
            profile={profile}
            activeAlertCount={activeAlerts.length}
            onBack={() => setScreen("home")}
            onAddStock={() => setScreen("market")}
            onOpenStock={openStock}
            onOpenAlerts={() => setScreen("alerts")}
            onOpenCompare={(ticker) => addToCompareAndOpen(ticker)}
            onOpenRebalance={() => setScreen("rebalance")}
          />
        )}

        {screen === "tax-report" && (
          <ScreenTaxReport
            accent={accent}
            transactions={transactions}
            onBack={() => setScreen("activity")}
          />
        )}

        {screen === "rebalance" && (
          <ScreenRebalance
            accent={accent}
            stocks={stocks}
            profile={profile}
            onBack={() => setScreen("analysis")}
            onApplyTransaction={async (ticker, type, shares, price) =>
              applyTransaction(ticker, type, shares, price)
            }
            onRecord={record}
          />
        )}

        {screen === "privacy" && (
          <ScreenLegalDoc accent={accent} doc="privacy" onBack={() => setScreen("profile")} />
        )}

        {screen === "terms" && (
          <ScreenLegalDoc accent={accent} doc="terms" onBack={() => setScreen("profile")} />
        )}

        {screen === "delete-account" && (
          <ScreenDeleteAccount
            accent={accent}
            onBack={() => setScreen("profile")}
            onErased={() => {
              clearAllLocal();
              onLogout();
            }}
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
            onOpenBatch={() => setScreen("batch")}
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
            onOpenRebalance={() => { setInsightsOpen(false); setScreen("rebalance"); }}
          />
        </Suspense>
      )}

      {optimizeOpen && (
        <Suspense fallback={null}>
          <OptimizeDividendsModal
            open={optimizeOpen}
            onClose={() => setOptimizeOpen(false)}
            stocks={stocks}
            profile={profile}
            annualProjected={optimizeAnnual}
            accent={accent}
          />
        </Suspense>
      )}

      <CookieConsentBanner
        accent={accent}
        onOpenPrivacy={() => setScreen("privacy")}
      />
    </AppShell>
  );
}

function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [bootStep, setBootStep] = useState<"onboardingA" | "onboardingB" | "login" | "app">(() => {
    const hasProfile = !!localStorage.getItem("praxia-investor-profile");
    if (hasProfile) return "login";
    return "onboardingA";
  });

  // Quando a sessao Supabase chega, salta direto pra app.
  useEffect(() => {
    if (user && bootStep !== "app") setBootStep("app");
  }, [user, bootStep]);

  // Loading inicial — evita flash do LoginScreen enquanto o supabase-js
  // recupera a sessao do localStorage.
  if (authLoading) {
    return (
      <div
        style={{
          height: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a10",
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

  if (user) {
    // Username friendly: parte antes do @ no email.
    const friendly = user.email ? user.email.split("@")[0] : "voce";
    return (
      <PraxiaApp
        username={friendly}
        onLogout={async () => {
          await signOut();
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
        onCreateAccount={() => setBootStep("login")}
        onLogin={() => setBootStep("login")}
      />
    );
  }

  return (
    <LoginScreen />
  );
}

export default App;
