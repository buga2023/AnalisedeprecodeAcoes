import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Autocomplete } from "@/components/ui/autocomplete";
import { TrendingUp, TrendingDown, PlusCircle, Calculator, Loader2, AlertCircle, Search } from "lucide-react";
import { calculateGrahamValue, calculateROI, getValuationStatus, calculateMarginOfSafety } from "@/lib/calculators";
import { fetchStockQuote } from "@/lib/api";
import { useStockSearch } from "@/hooks/useStockSearch";
import type { Stock } from "@/types/stock";

interface StockFormProps {
    onAddStock: (ticker: string, cost: number, quantity: number, overrides?: { lpa?: number; vpa?: number }) => Promise<boolean>;
    lastAdded?: Stock | null;
    token?: string;
}

interface FetchedData {
    ticker: string;
    price: number;
    lpa: number;
    vpa: number;
}

export const StockForm: React.FC<StockFormProps> = ({ onAddStock, lastAdded, token }) => {
    const [tickerInput, setTickerInput] = useState("");
    const [cost, setCost] = useState("");
    const [quantity, setQuantity] = useState("");
    const [lpaOverride, setLpaOverride] = useState("");
    const [vpaOverride, setVpaOverride] = useState("");
    const [fetchedData, setFetchedData] = useState<FetchedData | null>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { results, search, clearResults } = useStockSearch();

    const handleTickerChange = useCallback(
        (value: string) => {
            setTickerInput(value.toUpperCase());
            search(value);
            if (fetchedData && fetchedData.ticker !== value.toUpperCase()) {
                setFetchedData(null);
                setLpaOverride("");
                setVpaOverride("");
            }
            setError(null);
        },
        [search, fetchedData]
    );

    const handleTickerSelect = useCallback(
        async (ticker: string) => {
            setTickerInput(ticker);
            clearResults();
            setError(null);
            setFetchedData(null);
            setLpaOverride("");
            setVpaOverride("");
            setIsFetching(true);

            try {
                const quote = await fetchStockQuote(ticker, token || undefined);
                setFetchedData({
                    ticker: quote.symbol,
                    price: quote.regularMarketPrice,
                    lpa: quote.earningsPerShare ?? 0,
                    vpa: quote.bookValue ?? 0,
                });
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : `Não foi possível buscar dados de "${ticker}".`
                );
            } finally {
                setIsFetching(false);
            }
        },
        [token, clearResults]
    );

    // Effective values (override or fetched)
    const effectiveLpa = lpaOverride !== "" ? parseFloat(lpaOverride) || 0 : (fetchedData?.lpa ?? 0);
    const effectiveVpa = vpaOverride !== "" ? parseFloat(vpaOverride) || 0 : (fetchedData?.vpa ?? 0);
    const effectivePrice = fetchedData?.price ?? 0;
    const effectiveCost = parseFloat(cost) || 0;
    const effectiveQuantity = parseInt(quantity) || 0;

    // Real-time calculations
    const grahamVI = useMemo(() => calculateGrahamValue(effectiveLpa, effectiveVpa), [effectiveLpa, effectiveVpa]);
    const roi = useMemo(() => calculateROI(effectivePrice, effectiveCost), [effectivePrice, effectiveCost]);
    const margin = useMemo(() => calculateMarginOfSafety(effectivePrice, grahamVI), [effectivePrice, grahamVI]);
    const valuation = useMemo(() => (grahamVI > 0 ? getValuationStatus(effectivePrice, grahamVI) : null), [effectivePrice, grahamVI]);

    const canAdd = fetchedData !== null && !isFetching && !isAdding;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canAdd || !fetchedData) return;

        setIsAdding(true);
        setError(null);

        const overrides: { lpa?: number; vpa?: number } = {};
        if (lpaOverride !== "") overrides.lpa = parseFloat(lpaOverride) || 0;
        if (vpaOverride !== "") overrides.vpa = parseFloat(vpaOverride) || 0;

        const success = await onAddStock(
            fetchedData.ticker,
            effectiveCost,
            effectiveQuantity,
            Object.keys(overrides).length > 0 ? overrides : undefined
        );

        if (success) {
            setTickerInput("");
            setCost("");
            setQuantity("");
            setLpaOverride("");
            setVpaOverride("");
            setFetchedData(null);
        } else {
            setError(`Não foi possível adicionar "${fetchedData.ticker}". Tente novamente.`);
        }

        setIsAdding(false);
    };

    // Preview from last added stock (shown when no fetched data)
    const showLastAdded = !fetchedData && lastAdded;

    return (
        <Card className="w-full border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl overflow-hidden border-t-4 border-t-primary">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl font-black tracking-tight">
                    <PlusCircle className="h-6 w-6 text-primary" />
                    Analisar Novo Ativo
                </CardTitle>
                <CardDescription className="text-muted-foreground font-medium">
                    Busque ações brasileiras (B3) ou internacionais (NYSE/NASDAQ) pelo ticker.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Row 1: Ticker search + Quantity + Cost + Button */}
                    <div className="grid gap-6 md:grid-cols-4 items-end">
                        <div className="grid gap-2">
                            <Label htmlFor="ticker" className="text-[10px] font-black uppercase tracking-widest text-primary">
                                <Search className="inline h-3 w-3 mr-1" />
                                Buscar Ticker
                            </Label>
                            <Autocomplete
                                id="ticker"
                                value={tickerInput}
                                onChange={handleTickerChange}
                                onSelect={handleTickerSelect}
                                suggestions={results}
                                placeholder="Ex: PETR4, AAPL, VALE3..."
                                disabled={isFetching || isAdding}
                                className="bg-slate-950/50 border-border focus:border-primary focus:ring-1 focus:ring-primary h-12 font-bold"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="quantity" className="text-[10px] font-black uppercase tracking-widest text-primary">
                                Quantidade
                            </Label>
                            <Input
                                id="quantity"
                                type="number"
                                min="0"
                                step="1"
                                placeholder="0"
                                className="bg-slate-950/50 border-border focus:border-primary focus:ring-1 focus:ring-primary h-12 font-bold"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                disabled={isAdding}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="cost" className="text-[10px] font-black uppercase tracking-widest text-primary">
                                Preço Médio <span className="text-muted-foreground">(custo)</span>
                            </Label>
                            <div className="relative group">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold group-focus-within:text-primary transition-colors">R$</span>
                                <Input
                                    id="cost"
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    className="bg-slate-950/50 border-border focus:border-primary focus:ring-1 focus:ring-primary h-12 pl-10 font-bold"
                                    value={cost}
                                    onChange={(e) => setCost(e.target.value)}
                                    disabled={isAdding}
                                />
                            </div>
                        </div>
                        <Button
                            type="submit"
                            disabled={!canAdd}
                            className="h-12 bg-primary hover:bg-blue-600 text-white font-black uppercase tracking-widest shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all hover:translate-y-[-2px] active:translate-y-[0px]"
                        >
                            {isAdding ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Adicionando...
                                </>
                            ) : (
                                <>
                                    <Calculator className="mr-2 h-5 w-5" />
                                    Adicionar à Carteira
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Loading indicator */}
                    {isFetching && (
                        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary animate-in fade-in duration-300">
                            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                            Buscando dados de <span className="font-bold">{tickerInput}</span>...
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400 animate-in fade-in duration-300">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Fetched data preview with editable fields */}
                    {fetchedData && (
                        <div className="animate-in fade-in zoom-in-95 duration-500">
                            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 space-y-6">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em]">
                                        Dados carregados: <span className="text-primary">{fetchedData.ticker}</span>
                                    </p>
                                    <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                                        API
                                    </Badge>
                                </div>

                                {/* Editable fields row */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="grid gap-1.5">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                            Preço Atual
                                        </Label>
                                        <div className="rounded-lg border border-border/50 bg-slate-950/30 px-3 py-2.5 text-lg font-bold text-white">
                                            R$ {fetchedData.price.toFixed(2)}
                                        </div>
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="lpa-override" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                            LPA <span className="text-primary/60">(editável)</span>
                                        </Label>
                                        <Input
                                            id="lpa-override"
                                            type="number"
                                            step="0.01"
                                            placeholder={fetchedData.lpa.toFixed(2)}
                                            className="bg-slate-950/30 border-border/50 focus:border-primary focus:ring-1 focus:ring-primary h-11 font-bold"
                                            value={lpaOverride}
                                            onChange={(e) => setLpaOverride(e.target.value)}
                                        />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="vpa-override" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                            VPA <span className="text-primary/60">(editável)</span>
                                        </Label>
                                        <Input
                                            id="vpa-override"
                                            type="number"
                                            step="0.01"
                                            placeholder={fetchedData.vpa.toFixed(2)}
                                            className="bg-slate-950/30 border-border/50 focus:border-primary focus:ring-1 focus:ring-primary h-11 font-bold"
                                            value={vpaOverride}
                                            onChange={(e) => setVpaOverride(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Real-time valuation preview */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center items-center pt-4 border-t border-border/30">
                                    <div className="space-y-2">
                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em]">Estimativa de Graham</p>
                                        <p className="text-3xl font-black text-white">
                                            {grahamVI > 0 ? `R$ ${grahamVI.toFixed(2)}` : "—"}
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em]">Resultado ROI</p>
                                        <div className="flex items-center justify-center gap-2">
                                            {effectiveCost > 0 ? (
                                                <>
                                                    {roi >= 0 ? <TrendingUp className="h-6 w-6 text-emerald-400" /> : <TrendingDown className="h-6 w-6 text-rose-400" />}
                                                    <p className={`text-3xl font-black ${roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {(roi * 100).toFixed(2)}%
                                                    </p>
                                                </>
                                            ) : (
                                                <p className="text-3xl font-black text-muted-foreground">—</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em]">Sinal de Valuation</p>
                                        <div className="flex justify-center">
                                            {valuation ? (
                                                <Badge
                                                    className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest shadow-xl border-2 ${margin > 0.1
                                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                                                        : margin < -0.1
                                                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
                                                            : "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20"
                                                        }`}
                                                >
                                                    {valuation}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground font-black text-lg">—</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Last added stock preview (when no fetched data) */}
                    {showLastAdded && lastAdded && (
                        <div className="animate-in fade-in zoom-in-95 duration-500">
                            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-8 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-2 opacity-10">
                                    <TrendingUp className="h-24 w-24 text-primary" />
                                </div>
                                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em] mb-4">
                                    Último ativo adicionado: <span className="text-primary">{lastAdded.ticker}</span> — R$ {lastAdded.price.toFixed(2)}
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center items-center relative z-10">
                                    <div className="space-y-2 border-r border-border/50 last:border-0">
                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em]">Estimativa de Graham</p>
                                        <p className="text-3xl font-black text-white">
                                            R$ {calculateGrahamValue(lastAdded.lpa, lastAdded.vpa).toFixed(2)}
                                        </p>
                                    </div>
                                    <div className="space-y-2 border-r border-border/50 last:border-0">
                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em]">Resultado ROI</p>
                                        <div className="flex items-center justify-center gap-2">
                                            {calculateROI(lastAdded.price, lastAdded.cost) >= 0
                                                ? <TrendingUp className="h-6 w-6 text-emerald-400" />
                                                : <TrendingDown className="h-6 w-6 text-rose-400" />}
                                            <p className={`text-3xl font-black ${calculateROI(lastAdded.price, lastAdded.cost) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {(calculateROI(lastAdded.price, lastAdded.cost) * 100).toFixed(2)}%
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em]">Sinal de Valuation</p>
                                        <div className="flex justify-center">
                                            <Badge
                                                className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest shadow-xl border-2 ${calculateMarginOfSafety(lastAdded.price, calculateGrahamValue(lastAdded.lpa, lastAdded.vpa)) > 0.1
                                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                                                    : calculateMarginOfSafety(lastAdded.price, calculateGrahamValue(lastAdded.lpa, lastAdded.vpa)) < -0.1
                                                        ? "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
                                                        : "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20"
                                                    }`}
                                            >
                                                {getValuationStatus(lastAdded.price, calculateGrahamValue(lastAdded.lpa, lastAdded.vpa))}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </form>
            </CardContent>
        </Card>
    );
};
