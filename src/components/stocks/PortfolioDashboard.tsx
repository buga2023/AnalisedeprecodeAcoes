import React, { useMemo } from "react";
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Target, Award, AlertTriangle } from "lucide-react";
import { calculateGrahamValue, calculateROI, calculateMarginOfSafety, getValuationStatus } from "@/lib/calculators";
import type { Stock } from "@/types/stock";

interface PortfolioDashboardProps {
    stocks: Stock[];
}

function formatCurrency(value: number): string {
    return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface StatCardProps {
    label: string;
    value: string;
    subValue?: string;
    icon: React.ReactNode;
    color?: "green" | "red" | "blue" | "amber" | "white";
}

const StatCard: React.FC<StatCardProps> = ({ label, value, subValue, icon, color = "white" }) => {
    const colorClasses = {
        green: "text-emerald-400",
        red: "text-rose-400",
        blue: "text-blue-400",
        amber: "text-amber-400",
        white: "text-white",
    };

    const bgClasses = {
        green: "bg-emerald-500/10 border-emerald-500/20",
        red: "bg-rose-500/10 border-rose-500/20",
        blue: "bg-blue-500/10 border-blue-500/20",
        amber: "bg-amber-500/10 border-amber-500/20",
        white: "bg-primary/10 border-primary/20",
    };

    return (
        <div className={`rounded-xl border p-4 ${bgClasses[color]} backdrop-blur-sm`}>
            <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
                <div className={`p-1.5 rounded-lg ${bgClasses[color]}`}>
                    {icon}
                </div>
            </div>
            <p className={`text-2xl font-black ${colorClasses[color]}`}>{value}</p>
            {subValue && (
                <p className="text-xs text-muted-foreground font-bold mt-1">{subValue}</p>
            )}
        </div>
    );
};

export const PortfolioDashboard: React.FC<PortfolioDashboardProps> = ({ stocks }) => {
    const metrics = useMemo(() => {
        const withPosition = stocks.filter((s) => s.quantity > 0 && s.cost > 0);

        const totalInvested = withPosition.reduce((sum, s) => sum + s.cost * s.quantity, 0);
        const totalCurrent = withPosition.reduce((sum, s) => sum + s.price * s.quantity, 0);
        const totalGain = totalCurrent - totalInvested;
        const totalROI = totalInvested > 0 ? (totalGain / totalInvested) : 0;

        // Best and worst performing
        let best: { ticker: string; roi: number } | null = null;
        let worst: { ticker: string; roi: number } | null = null;
        for (const s of withPosition) {
            const roi = calculateROI(s.price, s.cost);
            if (!best || roi > best.roi) best = { ticker: s.ticker, roi };
            if (!worst || roi < worst.roi) worst = { ticker: s.ticker, roi };
        }

        // Valuation breakdown
        let undervalued = 0;
        let overvalued = 0;
        let fairValue = 0;
        for (const s of stocks) {
            const vi = calculateGrahamValue(s.lpa, s.vpa);
            const status = getValuationStatus(s.price, vi);
            if (status === "Subvalorizada") undervalued++;
            else if (status === "Sobrevalorizada") overvalued++;
            else fairValue++;
        }

        // Average margin of safety
        let totalMargin = 0;
        let marginCount = 0;
        for (const s of stocks) {
            const vi = calculateGrahamValue(s.lpa, s.vpa);
            if (vi > 0) {
                totalMargin += calculateMarginOfSafety(s.price, vi);
                marginCount++;
            }
        }
        const avgMargin = marginCount > 0 ? totalMargin / marginCount : 0;

        return {
            totalInvested,
            totalCurrent,
            totalGain,
            totalROI,
            best,
            worst,
            undervalued,
            overvalued,
            fairValue,
            avgMargin,
            positionCount: withPosition.length,
        };
    }, [stocks]);

    if (stocks.length === 0) return null;

    const gainColor = metrics.totalGain >= 0 ? "green" : "red";

    return (
        <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="border-b border-border/50 bg-muted/30 px-6 py-4">
                <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Resumo da Carteira
                </h2>
            </div>
            <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Total Invested */}
                    <StatCard
                        label="Total Investido"
                        value={`R$ ${formatCurrency(metrics.totalInvested)}`}
                        subValue={`${metrics.positionCount} posições`}
                        icon={<DollarSign className="h-4 w-4 text-primary" />}
                        color="white"
                    />

                    {/* Current Value */}
                    <StatCard
                        label="Valor Atual"
                        value={`R$ ${formatCurrency(metrics.totalCurrent)}`}
                        subValue={`${metrics.totalGain >= 0 ? "+" : ""}R$ ${formatCurrency(metrics.totalGain)}`}
                        icon={metrics.totalGain >= 0
                            ? <TrendingUp className="h-4 w-4 text-emerald-400" />
                            : <TrendingDown className="h-4 w-4 text-rose-400" />
                        }
                        color={gainColor}
                    />

                    {/* Total ROI */}
                    <StatCard
                        label="ROI Total"
                        value={`${metrics.totalROI >= 0 ? "+" : ""}${(metrics.totalROI * 100).toFixed(2)}%`}
                        subValue={`Margem média: ${(metrics.avgMargin * 100).toFixed(1)}%`}
                        icon={<Target className="h-4 w-4 text-blue-400" />}
                        color={metrics.totalROI >= 0 ? "green" : "red"}
                    />

                    {/* Best / Worst */}
                    <div className="rounded-xl border bg-card/50 border-border/30 p-4 backdrop-blur-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground mb-3">Destaques</p>
                        {metrics.best && (
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-1.5">
                                    <Award className="h-3.5 w-3.5 text-emerald-400" />
                                    <span className="text-xs font-black text-emerald-400">{metrics.best.ticker}</span>
                                </div>
                                <span className="text-xs font-black text-emerald-400">
                                    +{(metrics.best.roi * 100).toFixed(1)}%
                                </span>
                            </div>
                        )}
                        {metrics.worst && (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                                    <span className="text-xs font-black text-rose-400">{metrics.worst.ticker}</span>
                                </div>
                                <span className="text-xs font-black text-rose-400">
                                    {(metrics.worst.roi * 100).toFixed(1)}%
                                </span>
                            </div>
                        )}
                        {!metrics.best && !metrics.worst && (
                            <p className="text-xs text-muted-foreground">Adicione preço médio para ver</p>
                        )}
                    </div>
                </div>

                {/* Valuation distribution bar */}
                {stocks.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border/30">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Distribuição de Valuation</p>
                            <p className="text-[10px] text-muted-foreground font-bold">{stocks.length} ativos</p>
                        </div>
                        <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
                            {metrics.undervalued > 0 && (
                                <div
                                    className="bg-emerald-500 rounded-full transition-all duration-500"
                                    style={{ width: `${(metrics.undervalued / stocks.length) * 100}%` }}
                                    title={`${metrics.undervalued} subvalorizadas`}
                                />
                            )}
                            {metrics.fairValue > 0 && (
                                <div
                                    className="bg-blue-500 rounded-full transition-all duration-500"
                                    style={{ width: `${(metrics.fairValue / stocks.length) * 100}%` }}
                                    title={`${metrics.fairValue} preço justo`}
                                />
                            )}
                            {metrics.overvalued > 0 && (
                                <div
                                    className="bg-rose-500 rounded-full transition-all duration-500"
                                    style={{ width: `${(metrics.overvalued / stocks.length) * 100}%` }}
                                    title={`${metrics.overvalued} sobrevalorizadas`}
                                />
                            )}
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                            <div className="flex items-center gap-1.5">
                                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                <span className="text-[10px] text-muted-foreground font-bold">
                                    Subvalorizada ({metrics.undervalued})
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="h-2 w-2 rounded-full bg-blue-500" />
                                <span className="text-[10px] text-muted-foreground font-bold">
                                    Justo ({metrics.fairValue})
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="h-2 w-2 rounded-full bg-rose-500" />
                                <span className="text-[10px] text-muted-foreground font-bold">
                                    Sobrevalorizada ({metrics.overvalued})
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
