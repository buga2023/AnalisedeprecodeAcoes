import { lazy, Suspense, useState } from "react";
import { LoginScreen } from "@/components/LoginScreen";
import { StocksTable } from "@/components/stocks/StocksTable";
import { StockForm } from "@/components/stocks/StockForm";
import { MarketTicker } from "@/components/stocks/MarketTicker";
import { RiskMetrics } from "@/components/stocks/RiskMetrics";
import { DCFValuation } from "@/components/stocks/DCFValuation";
import { CotacaoStatus } from "@/components/stocks/CotacaoStatus";
import { DashboardIntegrado } from "@/components/stocks/DashboardIntegrado";
import { RelatoriosPanel } from "@/components/stocks/RelatoriosPanel";
import { LayoutDashboard, TrendingUp, RefreshCw, Wifi, X } from "lucide-react";
import { useStockQuotes } from "@/hooks/useStockQuotes";
import { useRelatorios } from "@/hooks/useRelatorios";
import { Button } from "@/components/ui/button";
import type { Stock } from "@/types/stock";

const AIInsights = lazy(() => import("@/components/stocks/AIInsights"));
const StockChart = lazy(() =>
  import("@/components/stocks/StockChart").then((module) => ({ default: module.StockChart }))
);

function AppContent() {
  const {
    stocks,
    isRefreshing,
    error,
    clearError,
    addStock,
    removeStock,
    refreshAll,
    refreshStock,
    manualRefresh,
    lastRefreshed,
  } = useStockQuotes();
  const {
    relatorios,
    loading: relatoriosLoading,
    error: relatoriosError,
    refetch: refetchRelatorios,
  } = useRelatorios(stocks.map((stock) => stock.ticker));

  const [lastAdded, setLastAdded] = useState<Stock | null>(null);
  const [chartTicker, setChartTicker] = useState<string | null>(null);

  const handleAddStock = async (
    ticker: string,
    cost: number,
    quantity: number,
    overrides?: { lpa?: number; vpa?: number }
  ): Promise<boolean> => {
    const result = await addStock(ticker, cost, quantity, overrides);
    if (result) {
      setLastAdded(result);
      return true;
    }
    return false;
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-primary-foreground">
      {/* Blue gradient glow effect */}
      <div className="pointer-events-none fixed left-0 top-0 -z-10 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
      <div className="pointer-events-none fixed right-0 bottom-0 -z-10 h-[400px] w-[400px] rounded-full bg-blue-600/5 blur-[100px]" />

      <div className="mx-auto max-w-6xl px-4 py-8 md:py-12 space-y-12">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary border border-primary/20">
              <TrendingUp className="h-4 w-4" />
              <span>Plataforma de Elite</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white">
              STOCKS<span className="text-primary italic">AI</span>
            </h1>
            <p className="max-w-md text-muted-foreground leading-relaxed">
              Analise sua carteira com a inteligência do Value Investing.
              Cotações automáticas e gratuitas via Yahoo Finance.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Connection status - Agora fixo como Conectado via Yahoo */}
            <div className="flex items-center gap-2 bg-card/50 backdrop-blur-sm border border-border px-3 py-2 rounded-lg text-xs">
              <Wifi className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-muted-foreground font-medium">
                Cotações Ativas
              </span>
            </div>

            {/* Refresh button */}
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 border-border"
              onClick={refreshAll}
              disabled={isRefreshing || stocks.length === 0}
              title="Atualizar todas as cotações"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>

            {/* Stock count */}
            <div className="flex items-center gap-4 bg-card/50 backdrop-blur-sm border border-border p-4 rounded-xl">
              <div className="rounded-full bg-primary/20 p-2">
                <LayoutDashboard className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase">Total Analisado</p>
                <p className="text-2xl font-bold">{stocks.length} Ativos</p>
              </div>
            </div>
          </div>
        </header>

        {/* API Error banner */}
        {error && (
          <div className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400 animate-in fade-in duration-300">
            <span>{error}</span>
            <button onClick={clearError} className="ml-4 hover:text-rose-300">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <section className="animate-in fade-in slide-in-from-bottom-2 duration-400">
          <MarketTicker />
        </section>

        <section className="animate-in fade-in slide-in-from-bottom-3 duration-450">
          <CotacaoStatus
            stocks={stocks}
            lastRefreshed={lastRefreshed}
            isRefreshing={isRefreshing}
            onRefresh={manualRefresh}
          />
        </section>

        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <StockForm onAddStock={handleAddStock} lastAdded={lastAdded} />
        </section>

        {/* AI Insights */}
        {stocks.length > 0 && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Suspense fallback={<div className="h-24 rounded-xl border border-border/50 bg-card/60 animate-pulse" />}>
              <AIInsights stocks={stocks} />
            </Suspense>
          </section>
        )}

        {/* Risk Metrics & DCF Valuation - side by side on large screens */}
        {stocks.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-5 duration-600">
            <section>
              <RiskMetrics stocks={stocks} />
            </section>
            <section>
              <DCFValuation stocks={stocks} />
            </section>
          </div>
        )}

        {stocks.length > 0 && (
          <DashboardIntegrado stocks={stocks} relatorios={relatorios} />
        )}

        {stocks.length > 0 && (
          <RelatoriosPanel
            stocks={stocks}
            relatorios={relatorios}
            loading={relatoriosLoading}
            error={relatoriosError}
            onRefresh={refetchRelatorios}
          />
        )}

        <main className="animate-in fade-in slide-in-from-bottom-6 duration-700">
          <div className="rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden">
            <div className="border-b border-border/50 bg-muted/30 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                Visualização de Mercado
              </h2>
              {isRefreshing && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Atualizando...
                </div>
              )}
            </div>
            <div className="p-0">
              <StocksTable
                stocks={stocks}
                onRefreshStock={refreshStock}
                onRemoveStock={removeStock}
                onShowChart={(ticker) => setChartTicker(ticker === chartTicker ? null : ticker)}
              />
            </div>
          </div>
        </main>

        {/* Stock Chart */}
        {chartTicker && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Suspense fallback={<div className="h-80 rounded-xl border border-border/50 bg-card/60 animate-pulse" />}>
              <StockChart
                ticker={chartTicker}
                onClose={() => setChartTicker(null)}
              />
            </Suspense>
          </section>
        )}
        <footer className="text-center text-sm text-muted-foreground pt-12 border-t border-border/30">
          <div className="flex justify-center gap-6 mb-4">
            <span className="hover:text-primary transition-colors cursor-pointer">Documentação</span>
            <span className="hover:text-primary transition-colors cursor-pointer">Termos</span>
            <span className="hover:text-primary transition-colors cursor-pointer">Privacidade</span>
          </div>
          <p>© {new Date().getFullYear()} STOCKS AI ENGINE. Todos os direitos reservados.</p>
        </footer>
      </div>
    </div>
  );
}

function App() {
  const [authenticated, setAuthenticated] = useState(false);

  if (!authenticated) {
    return <LoginScreen onLogin={() => setAuthenticated(true)} />;
  }

  return <AppContent />;
}

export default App;
