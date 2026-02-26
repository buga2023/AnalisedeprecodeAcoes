import { TrendingDown, TrendingUp, Coins, DollarSign, Gem, RefreshCw } from "lucide-react";
import { useMarketQuotes } from "@/hooks/useMarketQuotes";
import { Button } from "@/components/ui/button";

export function MarketTicker() {
    const { quotes, isLoading, error, refresh } = useMarketQuotes();

    const getIcon = (type: string) => {
        switch (type) {
            case 'crypto': return <Coins className="h-4 w-4 text-amber-500" />;
            case 'commodity': return <Gem className="h-4 w-4 text-emerald-400" />;
            default: return <DollarSign className="h-4 w-4 text-blue-400" />;
        }
    };

    const formatPrice = (price: number, type: string) => {
        if (type === 'crypto') {
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
        }
        if (type === 'commodity' || type === 'currency-usd') {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
        }
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
    };

    if (error) {
        return (
            <div className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
                <span>Erro ao carregar mercado: {error}</span>
                <Button variant="ghost" size="icon" onClick={refresh} className="h-6 w-6 text-rose-400 hover:text-rose-300">
                    <RefreshCw className="h-4 w-4" />
                </Button>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                    Mercados Globais
                </h3>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={refresh}
                    disabled={isLoading}
                    className="h-6 w-6 text-muted-foreground hover:text-white"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                {isLoading && quotes.length === 0 ? (
                    Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="min-w-[160px] h-[72px] rounded-xl bg-card border border-border/50 animate-pulse flex-shrink-0" />
                    ))
                ) : (
                    quotes.map((quote) => {
                        const isPositive = quote.pctChange >= 0;
                        return (
                            <div
                                key={quote.code}
                                className="min-w-[160px] flex-shrink-0 flex flex-col justify-between rounded-xl border border-border/50 bg-card/60 p-3 hover:bg-card/80 transition-colors"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="bg-primary/10 p-1.5 rounded-lg border border-primary/20">
                                        {getIcon(quote.type)}
                                    </div>
                                    <span className="text-xs font-semibold text-muted-foreground truncate" title={quote.name}>
                                        {quote.code}
                                    </span>
                                </div>

                                <div className="flex items-end justify-between">
                                    <span className="text-sm font-bold text-white">
                                        {formatPrice(quote.price, quote.type)}
                                    </span>
                                    <div className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${isPositive ? 'text-emerald-400 bg-emerald-400/10' : 'text-rose-400 bg-rose-400/10'}`}>
                                        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                        <span>{Math.abs(quote.pctChange).toFixed(2)}%</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
