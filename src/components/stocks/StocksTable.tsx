import React, { useState, useMemo } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, ArrowRight, RefreshCw, Trash2, Clock, LineChart, ArrowUpDown, ArrowUp, ArrowDown, Filter } from "lucide-react";
import { calculateGrahamValue, calculateROI, calculateMarginOfSafety, getValuationStatus } from "@/lib/calculators";
import type { Stock } from "@/types/stock";

interface StocksTableProps {
    stocks: Stock[];
    onRefreshStock?: (ticker: string) => void;
    onRemoveStock?: (ticker: string) => void;
    onShowChart?: (ticker: string) => void;
}

type SortKey = "ticker" | "price" | "change" | "cost" | "roi" | "graham" | "margin" | "status" | "quantity" | "total";
type SortDir = "asc" | "desc";
type ValuationFilter = "all" | "Subvalorizada" | "Sobrevalorizada" | "Justo";

function formatTimeAgo(isoString: string): string {
    const diff = Date.now() - new Date(isoString).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return "agora";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h`;
}

function formatCurrency(value: number): string {
    return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_ORDER: Record<string, number> = { Subvalorizada: 0, Justo: 1, Sobrevalorizada: 2 };

export const StocksTable: React.FC<StocksTableProps> = ({ stocks, onRefreshStock, onRemoveStock, onShowChart }) => {
    const [sortKey, setSortKey] = useState<SortKey>("ticker");
    const [sortDir, setSortDir] = useState<SortDir>("asc");
    const [filter, setFilter] = useState<ValuationFilter>("all");

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDir(key === "ticker" ? "asc" : "desc");
        }
    };

    const SortIcon = ({ col }: { col: SortKey }) => {
        if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
        return sortDir === "asc"
            ? <ArrowUp className="h-3 w-3 ml-1 text-primary" />
            : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
    };

    // Enrich stocks with computed values for sorting
    const enriched = useMemo(() => stocks.map((stock) => {
        const vi = calculateGrahamValue(stock.lpa, stock.vpa);
        const margin = calculateMarginOfSafety(stock.price, vi);
        const roi = stock.cost > 0 ? calculateROI(stock.price, stock.cost) : null;
        const status = getValuationStatus(stock.price, vi);
        const totalValue = stock.price * stock.quantity;
        const totalCost = stock.cost * stock.quantity;
        const totalGain = totalValue - totalCost;
        return { stock, vi, margin, roi, status, totalValue, totalCost, totalGain };
    }), [stocks]);

    // Filter
    const filtered = useMemo(() => {
        if (filter === "all") return enriched;
        return enriched.filter((e) => e.status === filter);
    }, [enriched, filter]);

    // Sort
    const sorted = useMemo(() => {
        const arr = [...filtered];
        const dir = sortDir === "asc" ? 1 : -1;
        arr.sort((a, b) => {
            switch (sortKey) {
                case "ticker": return dir * a.stock.ticker.localeCompare(b.stock.ticker);
                case "price": return dir * (a.stock.price - b.stock.price);
                case "change": return dir * (a.stock.changePercent - b.stock.changePercent);
                case "quantity": return dir * (a.stock.quantity - b.stock.quantity);
                case "cost": return dir * (a.stock.cost - b.stock.cost);
                case "total": return dir * (a.totalValue - b.totalValue);
                case "roi": return dir * ((a.roi ?? -999) - (b.roi ?? -999));
                case "graham": return dir * (a.vi - b.vi);
                case "margin": return dir * (a.margin - b.margin);
                case "status": return dir * ((STATUS_ORDER[a.status] ?? 1) - (STATUS_ORDER[b.status] ?? 1));
                default: return 0;
            }
        });
        return arr;
    }, [filtered, sortKey, sortDir]);

    const FILTERS: { label: string; value: ValuationFilter; className: string }[] = [
        { label: "Todos", value: "all", className: "text-white" },
        { label: "Subvalorizadas", value: "Subvalorizada", className: "text-emerald-400" },
        { label: "Justo", value: "Justo", className: "text-blue-400" },
        { label: "Sobrevalorizadas", value: "Sobrevalorizada", className: "text-rose-400" },
    ];

    const ThButton: React.FC<{ col: SortKey; children: React.ReactNode; className?: string }> = ({ col, children, className }) => (
        <TableHead
            className={`text-[10px] font-black uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-primary transition-colors select-none ${className ?? ""}`}
            onClick={() => handleSort(col)}
        >
            <div className="flex items-center">
                {children}
                <SortIcon col={col} />
            </div>
        </TableHead>
    );

    return (
        <div className="w-full">
            {/* Filter bar */}
            {stocks.length > 0 && (
                <div className="flex items-center gap-2 px-6 py-3 border-b border-border/30">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-1">Filtro:</span>
                    {FILTERS.map((f) => (
                        <button
                            key={f.value}
                            onClick={() => setFilter(f.value)}
                            className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border transition-all ${
                                filter === f.value
                                    ? "border-primary/50 bg-primary/10 text-primary"
                                    : "border-transparent hover:border-border/50 " + f.className + "/60 hover:bg-card"
                            }`}
                        >
                            {f.label}
                            {f.value !== "all" && (
                                <span className="ml-1 opacity-50">
                                    ({enriched.filter((e) => f.value === "all" || e.status === f.value).length})
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            <Table>
                <TableHeader className="bg-muted/50 border-b border-border/50">
                    <TableRow className="hover:bg-transparent">
                        <ThButton col="ticker" className="w-[100px] text-primary py-4 px-6">Ativo</ThButton>
                        <ThButton col="price">Preço</ThButton>
                        <ThButton col="change">Variação</ThButton>
                        <ThButton col="quantity">Qtd</ThButton>
                        <ThButton col="cost">P. Médio</ThButton>
                        <ThButton col="total">Total</ThButton>
                        <ThButton col="roi">ROI</ThButton>
                        <ThButton col="graham">Graham</ThButton>
                        <ThButton col="margin">Margem</ThButton>
                        <ThButton col="status">Status</ThButton>
                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-primary py-4 px-6">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sorted.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={11} className="text-center py-20">
                                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                    <p className="text-sm font-medium">
                                        {stocks.length === 0 ? "Sua carteira está vazia." : "Nenhum ativo corresponde ao filtro."}
                                    </p>
                                    <p className="text-xs">
                                        {stocks.length === 0
                                            ? "Digite um ticker no painel acima para buscar dados automaticamente."
                                            : "Tente alterar o filtro de classificação."
                                        }
                                    </p>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : (
                        sorted.map(({ stock, vi, margin, roi, status, totalValue, totalGain }) => (
                            <TableRow
                                key={stock.ticker}
                                className="group border-b border-border/30 hover:bg-primary/5 transition-all duration-300"
                            >
                                <TableCell className="py-4 px-6">
                                    <div className="flex flex-col">
                                        <span className="text-base font-black tracking-tight text-white group-hover:text-primary transition-colors">{stock.ticker}</span>
                                        {stock.lastUpdated && (
                                            <span className="text-[10px] text-muted-foreground font-bold group-hover:text-primary/50 flex items-center gap-1">
                                                <Clock className="h-2.5 w-2.5" />
                                                {formatTimeAgo(stock.lastUpdated)}
                                            </span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="font-mono font-bold text-white text-sm">R$ {formatCurrency(stock.price)}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1.5">
                                        <div className={`p-1 rounded-md ${stock.change >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                                            {stock.change >= 0 ? <TrendingUp className="h-3 w-3 text-emerald-400" /> : <TrendingDown className="h-3 w-3 text-rose-400" />}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className={`text-xs font-bold ${stock.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                                {stock.change >= 0 ? "+" : ""}{stock.change.toFixed(2)}
                                            </span>
                                            <span className={`text-[10px] ${stock.changePercent >= 0 ? "text-emerald-400/70" : "text-rose-400/70"}`}>
                                                {stock.changePercent >= 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%
                                            </span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="font-mono text-sm text-muted-foreground">
                                    {stock.quantity > 0 ? stock.quantity : "—"}
                                </TableCell>
                                <TableCell className="font-mono text-sm text-muted-foreground/80">
                                    {stock.cost > 0 ? `R$ ${formatCurrency(stock.cost)}` : "—"}
                                </TableCell>
                                <TableCell>
                                    {stock.quantity > 0 && stock.cost > 0 ? (
                                        <div className="flex flex-col">
                                            <span className="font-mono text-sm font-bold text-white">R$ {formatCurrency(totalValue)}</span>
                                            <span className={`text-[10px] font-bold ${totalGain >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                                {totalGain >= 0 ? "+" : ""}R$ {formatCurrency(totalGain)}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground/50">—</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {roi !== null ? (
                                        <div className="flex items-center gap-1.5">
                                            <div className={`p-1 rounded-md ${roi >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                                                {roi >= 0 ? <TrendingUp className="h-3 w-3 text-emerald-400" /> : <TrendingDown className="h-3 w-3 text-rose-400" />}
                                            </div>
                                            <span className={`text-sm font-black ${roi >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                                {(roi * 100).toFixed(2)}%
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground/50">—</span>
                                    )}
                                </TableCell>
                                <TableCell className="font-bold text-white/90 text-sm">R$ {formatCurrency(vi)}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1.5">
                                        <div className={`h-1.5 w-1.5 rounded-full ${margin > 0 ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.6)]'}`} />
                                        <span className={`text-sm font-black ${margin > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                            {(margin * 100).toFixed(2)}%
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest border-2 shadow-lg ${status === "Subvalorizada"
                                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                                : status === "Sobrevalorizada"
                                                    ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                                    : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                            }`}
                                    >
                                        {status}
                                        <ArrowRight className="ml-1.5 h-3 w-3 opacity-50" />
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right py-4 px-6">
                                    <div className="flex items-center justify-end gap-1">
                                        {onShowChart && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                onClick={() => onShowChart(stock.ticker)}
                                                title="Ver gráfico"
                                            >
                                                <LineChart className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                        {onRefreshStock && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                onClick={() => onRefreshStock(stock.ticker)}
                                                title="Atualizar cotação"
                                            >
                                                <RefreshCw className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                        {onRemoveStock && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-rose-400"
                                                onClick={() => onRemoveStock(stock.ticker)}
                                                title="Remover ação"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
};

export default StocksTable;
