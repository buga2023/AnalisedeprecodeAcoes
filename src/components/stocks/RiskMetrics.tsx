import React, { useMemo } from "react";
import { Shield, AlertTriangle, Activity, TrendingDown } from "lucide-react";
import type { Stock } from "@/types/stock";

interface RiskMetricsProps {
    stocks: Stock[];
}

function formatPercent(value: number): string {
    return (value * 100).toFixed(2) + "%";
}

/**
 * Calcula a volatilidade historica do portfolio baseada nas variacoes %
 * Usa o desvio padrao das variacoes como proxy
 */
function calculatePortfolioVolatility(stocks: Stock[]): number {
    if (stocks.length === 0) return 0;

    const changes = stocks
        .filter((s) => s.changePercent !== 0)
        .map((s) => s.changePercent / 100);

    if (changes.length === 0) return 0;

    const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
    const variance =
        changes.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / changes.length;
    const dailyVol = Math.sqrt(variance);

    // Anualiza a volatilidade (sqrt(252) dias uteis)
    return dailyVol * Math.sqrt(252);
}

/**
 * Calcula o Value at Risk (VaR) parametrico a 95% de confianca
 * VaR = Portfolio Value * z-score * volatilidade * sqrt(horizonte)
 * z-score 95% = 1.645
 */
function calculateVaR(
    stocks: Stock[],
    confidenceLevel: number = 0.95
): { varPercent: number; varAbsolute: number; portfolioValue: number } {
    const portfolioValue = stocks.reduce(
        (sum, s) => sum + s.price * (s.quantity > 0 ? s.quantity : 1),
        0
    );

    if (portfolioValue === 0 || stocks.length === 0) {
        return { varPercent: 0, varAbsolute: 0, portfolioValue: 0 };
    }

    const volatility = calculatePortfolioVolatility(stocks);

    // z-score para nível de confiança
    const zScores: Record<number, number> = {
        0.9: 1.282,
        0.95: 1.645,
        0.99: 2.326,
    };
    const z = zScores[confidenceLevel] ?? 1.645;

    // VaR diário
    const varPercent = z * volatility / Math.sqrt(252);
    const varAbsolute = portfolioValue * varPercent;

    return { varPercent, varAbsolute, portfolioValue };
}

/**
 * Calcula o Sharpe Ratio simplificado
 * Sharpe = (Retorno medio - Taxa livre) / Volatilidade
 */
function calculateSharpeRatio(stocks: Stock[]): number {
    if (stocks.length === 0) return 0;

    const changes = stocks
        .filter((s) => s.changePercent !== 0)
        .map((s) => s.changePercent / 100);

    if (changes.length === 0) return 0;

    const meanReturn = changes.reduce((a, b) => a + b, 0) / changes.length;
    const riskFreeRate = 0.1375 / 252; // SELIC ~13.75% ao ano, diário
    const volatility = calculatePortfolioVolatility(stocks);

    if (volatility === 0) return 0;

    return ((meanReturn - riskFreeRate) * 252) / volatility;
}

/**
 * Identifica a concentracao de risco
 */
function calculateConcentration(stocks: Stock[]): {
    topHolding: string;
    topPercent: number;
    herfindahl: number;
} {
    const withPosition = stocks.filter((s) => s.quantity > 0);
    if (withPosition.length === 0) {
        return { topHolding: "N/A", topPercent: 0, herfindahl: 0 };
    }

    const totalValue = withPosition.reduce(
        (sum, s) => sum + s.price * s.quantity,
        0
    );

    if (totalValue === 0) {
        return { topHolding: "N/A", topPercent: 0, herfindahl: 0 };
    }

    let maxTicker = withPosition[0].ticker;
    let maxValue = 0;
    let herfindahl = 0;

    for (const s of withPosition) {
        const value = s.price * s.quantity;
        const weight = value / totalValue;
        herfindahl += weight * weight;

        if (value > maxValue) {
            maxValue = value;
            maxTicker = s.ticker;
        }
    }

    return {
        topHolding: maxTicker,
        topPercent: maxValue / totalValue,
        herfindahl,
    };
}

function getRiskLevel(
    varPercent: number,
    volatility: number
): { label: string; color: string; bgColor: string } {
    const riskScore = varPercent * 100 + volatility * 50;

    if (riskScore > 8) {
        return {
            label: "ALTO",
            color: "text-rose-400",
            bgColor: "bg-rose-500/10 border-rose-500/20",
        };
    }
    if (riskScore > 4) {
        return {
            label: "MODERADO",
            color: "text-amber-400",
            bgColor: "bg-amber-500/10 border-amber-500/20",
        };
    }
    return {
        label: "BAIXO",
        color: "text-emerald-400",
        bgColor: "bg-emerald-500/10 border-emerald-500/20",
    };
}

export const RiskMetrics: React.FC<RiskMetricsProps> = ({ stocks }) => {
    const metrics = useMemo(() => {
        const volatility = calculatePortfolioVolatility(stocks);
        const var95 = calculateVaR(stocks, 0.95);
        const var99 = calculateVaR(stocks, 0.99);
        const sharpe = calculateSharpeRatio(stocks);
        const concentration = calculateConcentration(stocks);
        const riskLevel = getRiskLevel(var95.varPercent, volatility);

        // Beta simplificado - media ponderada dos changePercent
        const avgBeta = stocks.length > 0
            ? stocks.reduce((sum, s) => {
                const weight = (s.quantity > 0 ? s.quantity * s.price : s.price) /
                    stocks.reduce((t, st) => t + (st.quantity > 0 ? st.quantity * st.price : st.price), 0);
                // Proxy: volatilidade individual vs media
                return sum + Math.abs(s.changePercent) * weight;
            }, 0) / (stocks.reduce((sum, s) => sum + Math.abs(s.changePercent), 0) / stocks.length || 1)
            : 1;

        return {
            volatility,
            var95,
            var99,
            sharpe,
            concentration,
            riskLevel,
            beta: Math.min(Math.max(avgBeta, 0), 3),
        };
    }, [stocks]);

    if (stocks.length === 0) return null;

    const varBarWidth = Math.min(metrics.var95.varPercent * 100 * 10, 100);
    const volBarWidth = Math.min(metrics.volatility * 100, 100);

    return (
        <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="border-b border-border/50 bg-muted/30 px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Metricas de Risco
                </h2>
                <div
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${metrics.riskLevel.bgColor} ${metrics.riskLevel.color}`}
                >
                    Risco {metrics.riskLevel.label}
                </div>
            </div>

            <div className="p-6 space-y-6">
                {/* VaR e Volatilidade - cards principais */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Value at Risk */}
                    <div className="rounded-xl border border-border/30 bg-card/50 p-4 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-rose-400" />
                                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">
                                    Value at Risk (95%)
                                </p>
                            </div>
                            <span className="text-xs font-black text-rose-400">
                                {formatPercent(metrics.var95.varPercent)}
                            </span>
                        </div>
                        <div className="w-full bg-slate-800/50 h-2 rounded-full overflow-hidden mb-3">
                            <div
                                className="bg-gradient-to-r from-rose-500 to-rose-400 h-2 rounded-full transition-all duration-700 ease-out"
                                style={{ width: `${varBarWidth}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">
                                Perda max. diaria
                            </span>
                            <span className="font-bold text-white">
                                R$ {metrics.var95.varAbsolute.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="mt-2 flex justify-between text-xs">
                            <span className="text-muted-foreground">VaR 99%</span>
                            <span className="font-bold text-rose-400/80">
                                {formatPercent(metrics.var99.varPercent)}
                            </span>
                        </div>
                    </div>

                    {/* Volatilidade */}
                    <div className="rounded-xl border border-border/30 bg-card/50 p-4 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Activity className="h-4 w-4 text-primary" />
                                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">
                                    Volatilidade Anualizada
                                </p>
                            </div>
                            <span className="text-xs font-black text-white">
                                {formatPercent(metrics.volatility)}
                            </span>
                        </div>
                        <div className="w-full bg-slate-800/50 h-2 rounded-full overflow-hidden mb-3">
                            <div
                                className="bg-gradient-to-r from-blue-500 to-primary h-2 rounded-full transition-all duration-700 ease-out"
                                style={{ width: `${volBarWidth}%` }}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-0.5">
                                    Sharpe Ratio
                                </p>
                                <p
                                    className={`text-sm font-black ${metrics.sharpe > 1
                                            ? "text-emerald-400"
                                            : metrics.sharpe > 0
                                                ? "text-amber-400"
                                                : "text-rose-400"
                                        }`}
                                >
                                    {metrics.sharpe.toFixed(2)}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-0.5">
                                    Beta Estimado
                                </p>
                                <p className="text-sm font-black text-white">
                                    {metrics.beta.toFixed(2)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Concentracao e Exposicao */}
                <div className="rounded-xl border border-border/30 bg-slate-900/50 p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <TrendingDown className="h-4 w-4 text-amber-400" />
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">
                            Mapeamento de Exposicao
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Concentracao */}
                        <div className="p-3 rounded-lg bg-card/30 border border-border/20">
                            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1">
                                Maior Posicao
                            </p>
                            <p className="text-sm font-black text-primary">
                                {metrics.concentration.topHolding}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                                {formatPercent(metrics.concentration.topPercent)} do portfolio
                            </p>
                        </div>

                        {/* Diversificacao */}
                        <div className="p-3 rounded-lg bg-card/30 border border-border/20">
                            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1">
                                Indice HHI
                            </p>
                            <p
                                className={`text-sm font-black ${metrics.concentration.herfindahl > 0.25
                                        ? "text-rose-400"
                                        : metrics.concentration.herfindahl > 0.15
                                            ? "text-amber-400"
                                            : "text-emerald-400"
                                    }`}
                            >
                                {(metrics.concentration.herfindahl * 10000).toFixed(0)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                                {metrics.concentration.herfindahl > 0.25
                                    ? "Concentrado"
                                    : metrics.concentration.herfindahl > 0.15
                                        ? "Moderado"
                                        : "Diversificado"}
                            </p>
                        </div>

                        {/* Valor do Portfolio */}
                        <div className="p-3 rounded-lg bg-card/30 border border-border/20">
                            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1">
                                Valor Exposto
                            </p>
                            <p className="text-sm font-black text-white">
                                R${" "}
                                {metrics.var95.portfolioValue.toLocaleString("pt-BR", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                                {stocks.length} ativos monitorados
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RiskMetrics;
