import { useState } from "react";
import { LoginScreen } from "@/components/LoginScreen";
import { StocksTable } from "@/components/stocks/StocksTable";
import { StockForm } from "@/components/stocks/StockForm";
import { StockChart } from "@/components/stocks/StockChart";
import { MarketTicker } from "@/components/stocks/MarketTicker";
import { LayoutDashboard, TrendingUp, RefreshCw, Settings, Key, Wifi, WifiOff, X } from "lucide-react";
import { useStockQuotes } from "@/hooks/useStockQuotes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Stock } from "@/types/stock";

function AppContent() {
  const {
    stocks,
    token,
    updateToken,
    isRefreshing,
    error,
    clearError,
    addStock,
    removeStock,
    refreshAll,
    refreshStock,
  } = useStockQuotes();

  const [showSettings, setShowSettings] = useState(false);
  const [tokenInput, setTokenInput] = useState(token);
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

  const handleSaveToken = () => {
    updateToken(tokenInput.trim());
    setShowSettings(false);
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
              Cotações em tempo real via brapi.dev.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Connection status */}
            <div className="flex items-center gap-2 bg-card/50 backdrop-blur-sm border border-border px-3 py-2 rounded-lg text-xs">
              {token ? (
                <Wifi className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-amber-400" />
              )}
              <span className="text-muted-foreground font-medium">
                {token ? "API conectada" : "Sem token"}
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

            {/* Settings button */}
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 border-border"
              onClick={() => setShowSettings(!showSettings)}
              title="Configurações da API"
            >
              <Settings className="h-4 w-4" />
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

        {/* Settings panel */}
        {showSettings && (
          <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl p-6 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2 mb-4">
              <Key className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-bold">Configuração da API</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Cadastre-se em <span className="text-primary font-medium">brapi.dev</span> para obter um token gratuito.
              Sem token, apenas alguns tickers de teste funcionam (PETR4, VALE3, etc).
            </p>
            <div className="flex gap-3 items-end">
              <div className="flex-1 grid gap-2">
                <Label htmlFor="api-token" className="text-[10px] font-black uppercase tracking-widest text-primary">
                  Token da API
                </Label>
                <Input
                  id="api-token"
                  type="password"
                  placeholder="Cole seu token aqui"
                  className="bg-slate-950/50 border-border focus:border-primary focus:ring-1 focus:ring-primary h-10 font-mono text-sm"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                />
              </div>
              <Button onClick={handleSaveToken} className="h-10 bg-primary hover:bg-blue-600 font-bold">
                Salvar
              </Button>
              {token && (
                <Button
                  variant="outline"
                  className="h-10 text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                  onClick={() => { updateToken(""); setTokenInput(""); }}
                >
                  Remover
                </Button>
              )}
            </div>
          </div>
        )}

        <section className="animate-in fade-in slide-in-from-bottom-2 duration-400">
          <MarketTicker />
        </section>

        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <StockForm onAddStock={handleAddStock} lastAdded={lastAdded} token={token} />
        </section>

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
            <StockChart
              ticker={chartTicker}
              token={token}
              onClose={() => setChartTicker(null)}
            />
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
