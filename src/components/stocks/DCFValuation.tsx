import React, { useMemo } from "react";
import { Calculator, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { calculateGrahamValue, getValuationStatus } from "@/lib/calculators";
import type { Stock } from "@/types/stock";

interface DCFValuationProps {
    stocks: Stock[];
}

/**
 * Modelo DCF Simplificado (Fluxo de Caixa Descontado)
 * Baseado em LPA como proxy do FCF e crescimento estimado pelo ROE
 *
 * Premissas:
 * - FCF proxy = LPA (lucro por acao)
 * - Taxa de crescimento = min(ROE, 15%) nos primeiros 5 anos
 * - Crescimento perpetuo = 3% (acompanha inflacao)
 * - Taxa de desconto (WACC) = SELIC + Equity Risk Premium (~15%)
 * - Terminal Value = FCF_5 * (1 + g_perpetuo) / (WACC - g_perpetuo)
 */
function calculateDCF(stock: Stock): {
    intrinsicValue: number;
    upside: number;
    fcfProjections: number[];
    terminalValue: number;
    wacc: number;
    growthRate: number;
} {
    const lpa = stock.lpa;
    const roe = stock.roe;
    const price = stock.price;

    if (lpa <= 0 || price <= 0) {
        return {
            intrinsicValue: 0,
            upside: 0,
            fcfProjections: [],
            terminalValue: 0,
            wacc: 0.15,
            growthRate: 0,
        };
    }

    // Premissas
    const wacc = 0.15; // 15% WACC para mercado brasileiro
    const perpetualGrowth = 0.03; // 3% crescimento perpetuo
    const growthRate = Math.min(Math.max(roe, 0.02), 0.15); // Limita entre 2% e 15%
    const projectionYears = 5;

    // Projecao dos fluxos de caixa (usando LPA como proxy)
    const fcfProjections: number[] = [];
    let currentFCF = lpa;

    for (let i = 0; i < projectionYears; i++) {
        currentFCF = currentFCF * (1 + growthRate);
        fcfProjections.push(currentFCF);
    }

    // Terminal Value (Gordon Growth Model)
    const terminalFCF = fcfProjections[projectionYears - 1] * (1 + perpetualGrowth);
    const terminalValue = terminalFCF / (wacc - perpetualGrowth);

    // Valor presente dos fluxos projetados
    let pvFCF = 0;
    for (let i = 0; i < projectionYears; i++) {
        pvFCF += fcfProjections[i] / Math.pow(1 + wacc, i + 1);
    }

    // Valor presente do Terminal Value
    const pvTerminal = terminalValue / Math.pow(1 + wacc, projectionYears);

    // Valor intrinseco total
    const intrinsicValue = pvFCF + pvTerminal;
    const upside = price > 0 ? (intrinsicValue - price) / price : 0;

    return {
        intrinsicValue: Math.max(intrinsicValue, 0),
        upside,
        fcfProjections,
        terminalValue,
        wacc,
        growthRate,
    };
}

function formatCurrency(value: number): string {
    return value.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function getValuationLabel(upside: number): {
    label: string;
    color: string;
    bgColor: string;
} {
    if (upside > 0.2) {
        return {
            label: "Subvalorizada",
            color: "text-emerald-400",
            bgColor: "bg-emerald-500/10 border-emerald-500/20",
        };
    }
    if (upside > -0.1) {
        return {
            label: "Preco Justo",
            color: "text-blue-400",
            bgColor: "bg-blue-500/10 border-blue-500/20",
        };
    }
    return {
        label: "Sobrevalorizada",
        color: "text-rose-400",
        bgColor: "bg-rose-500/10 border-rose-500/20",
    };
}

export const DCFValuation: React.FC<DCFValuationProps> = ({ stocks }) => {
    const valuations = useMemo(() => {
        return stocks
            .filter((s) => s.lpa > 0)
            .map((stock) => {
                const dcf = calculateDCF(stock);
                const graham = calculateGrahamValue(stock.lpa, stock.vpa);
                const grahamStatus = getValuationStatus(stock.price, graham);
                return { stock, dcf, graham, grahamStatus };
            })
            .sort((a, b) => b.dcf.upside - a.dcf.upside);
    }, [stocks]);

    // Estatisticas gerais
    const summary = useMemo(() => {
        if (valuations.length === 0)
            return { avgUpside: 0, undervalued: 0, overvalued: 0, fair: 0 };

        const avgUpside =
            valuations.reduce((sum, v) => sum + v.dcf.upside, 0) / valuations.length;
        const undervalued = valuations.filter((v) => v.dcf.upside > 0.2).length;
        const overvalued = valuations.filter((v) => v.dcf.upside < -0.1).length;
        const fair = valuations.length - undervalued - overvalued;

        return { avgUpside, undervalued, overvalued, fair };
    }, [valuations]);

    if (stocks.length === 0) return null;

    // Score gauge - media ponderada do upside (0-100)
    const gaugeScore = Math.min(
        Math.max(Math.round((summary.avgUpside + 0.5) * 100), 0),
        100
    );
    const circumference = 2 * Math.PI * 45;
    const strokeDash = (gaugeScore / 100) * circumference;

    return (
        <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="border-b border-border/50 bg-muted/30 px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-primary" />
                    Modelo DCF (Fluxo de Caixa Descontado)
                </h2>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    WACC: 15% | g: 3%
                </span>
            </div>

            <div className="p-6">
                {/* Overview com gauge */}
                <div className="flex flex-col md:flex-row items-center gap-6 mb-6">
                    {/* Gauge circular */}
                    <div className="relative w-36 h-36 shrink-0">
                        <svg className="w-full h-full" viewBox="0 0 100 100">
                            <circle
                                className="text-slate-800"
                                cx="50"
                                cy="50"
                                r="45"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="8"
                            />
                            <circle
                                className="text-primary"
                                cx="50"
                                cy="50"
                                r="45"
                                fill="none"
                                stroke="currentColor"
                                strokeDasharray={`${strokeDash} ${circumference}`}
                                strokeLinecap="round"
                                strokeWidth="8"
                                transform="rotate(-90 50 50)"
                                style={{ transition: "stroke-dasharray 1s ease-out" }}
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-black text-white">
                                {gaugeScore}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-black uppercase">
                                Valuation
                            </span>
                        </div>
                    </div>

                    {/* Resumo */}
                    <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                            <h3 className="text-xl font-black text-white">
                                {summary.avgUpside >= 0.15
                                    ? "Portfolio Atrativo"
                                    : summary.avgUpside >= -0.05
                                        ? "Portfolio Justo"
                                        : "Portfolio Caro"}
                            </h3>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Upside medio de{" "}
                            <span
                                className={`font-black ${summary.avgUpside >= 0 ? "text-emerald-400" : "text-rose-400"
                                    }`}
                            >
                                {summary.avgUpside >= 0 ? "+" : ""}
                                {(summary.avgUpside * 100).toFixed(1)}%
                            </span>{" "}
                            baseado no modelo DCF com WACC de 15%.
                        </p>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                                <p className="text-lg font-black text-emerald-400">
                                    {summary.undervalued}
                                </p>
                                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400/70">
                                    Subvalorizada
                                </p>
                            </div>
                            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                                <p className="text-lg font-black text-blue-400">
                                    {summary.fair}
                                </p>
                                <p className="text-[10px] font-black uppercase tracking-wider text-blue-400/70">
                                    Preco Justo
                                </p>
                            </div>
                            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-center">
                                <p className="text-lg font-black text-rose-400">
                                    {summary.overvalued}
                                </p>
                                <p className="text-[10px] font-black uppercase tracking-wider text-rose-400/70">
                                    Sobrevalorizada
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabela de valuations individuais */}
                {valuations.length > 0 && (
                    <div className="rounded-xl border border-border/30 overflow-hidden">
                        <div className="bg-muted/20 px-4 py-2.5 border-b border-border/20">
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">
                                Valuation Individual por DCF
                            </p>
                        </div>
                        <div className="divide-y divide-border/20">
                            {valuations.slice(0, 8).map(({ stock, dcf, graham }) => {
                                const valuationInfo = getValuationLabel(dcf.upside);
                                return (
                                    <div
                                        key={stock.ticker}
                                        className="px-4 py-3 flex items-center justify-between hover:bg-primary/5 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-xs">
                                                {stock.ticker.slice(0, 2)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-white">
                                                    {stock.ticker}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground">
                                                    Preco: R$ {formatCurrency(stock.price)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            {/* DCF Value */}
                                            <div className="text-right">
                                                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                                                    DCF
                                                </p>
                                                <p className="text-sm font-black text-white">
                                                    R$ {formatCurrency(dcf.intrinsicValue)}
                                                </p>
                                            </div>

                                            {/* Graham Value */}
                                            <div className="text-right">
                                                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                                                    Graham
                                                </p>
                                                <p className="text-sm font-black text-blue-400">
                                                    R$ {formatCurrency(graham)}
                                                </p>
                                            </div>

                                            {/* Upside */}
                                            <div className="text-right min-w-[70px]">
                                                <div className="flex items-center justify-end gap-1">
                                                    {dcf.upside >= 0 ? (
                                                        <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
                                                    ) : (
                                                        <ArrowDownRight className="h-3.5 w-3.5 text-rose-400" />
                                                    )}
                                                    <span
                                                        className={`text-sm font-black ${dcf.upside >= 0
                                                            ? "text-emerald-400"
                                                            : "text-rose-400"
                                                            }`}
                                                    >
                                                        {dcf.upside >= 0 ? "+" : ""}
                                                        {(dcf.upside * 100).toFixed(1)}%
                                                    </span>
                                                </div>
                                                <span
                                                    className={`text-[10px] font-black uppercase tracking-wider ${valuationInfo.color}`}
                                                >
                                                    {valuationInfo.label}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {valuations.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                        <Calculator className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm font-medium">
                            Adicione acoes com LPA positivo para ver a analise DCF.
                        </p>
                    </div>
                )}

                {/* Rodape com premissas */}
                <div className="mt-4 p-3 rounded-lg bg-slate-900/50 border border-border/20">
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1">
                        Premissas do Modelo
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Modelo DCF com 5 anos de projecao | Taxa de crescimento baseada no
                        ROE (limitada a 15%) | WACC = 15% | Crescimento perpetuo = 3% |
                        Terminal Value via Gordon Growth Model | LPA utilizado como proxy do
                        Fluxo de Caixa Livre por acao.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default DCFValuation;
