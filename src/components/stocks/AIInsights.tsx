import React, { useState, useCallback, useEffect, useRef } from "react";
import {
    Sparkles,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    Zap,
    Shield,
    Target,
    BarChart3,
    RefreshCw,
    Key,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    fetchAIInsights,
} from "@/lib/ai";
import type { AIResponse } from "@/lib/ai";
import { useAIProvider } from "@/hooks/useAIProvider";
import { AIProviderSettings } from "./AIProviderSettings";
import type { Stock } from "@/types/stock";

interface AIInsightsProps {
    stocks: Stock[];
}

const insightConfig = {
    alta: {
        icon: TrendingUp,
        iconColor: "text-emerald-400",
        borderColor: "border-emerald-500/20",
        bgColor: "bg-emerald-500/5",
    },
    baixa: {
        icon: TrendingDown,
        iconColor: "text-rose-400",
        borderColor: "border-rose-500/20",
        bgColor: "bg-rose-500/5",
    },
    neutro: {
        icon: BarChart3,
        iconColor: "text-blue-400",
        borderColor: "border-blue-500/20",
        bgColor: "bg-blue-500/5",
    },
    alerta: {
        icon: AlertTriangle,
        iconColor: "text-amber-400",
        borderColor: "border-amber-500/20",
        bgColor: "bg-amber-500/5",
    },
};

const confidenceColors = {
    alta: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    media: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    baixa: "text-muted-foreground bg-slate-500/10 border-slate-500/20",
};

const sentimentConfig = {
    otimista: { label: "OTIMISTA", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
    pessimista: { label: "PESSIMISTA", color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20" },
    neutro: { label: "NEUTRO", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
};

export const AIInsights: React.FC<AIInsightsProps> = ({ stocks }) => {
    const { providerConfig, hasConfig } = useAIProvider();
    const [showKeyConfig, setShowKeyConfig] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [response, setResponse] = useState<AIResponse | null>(null);
    const [lastAnalyzedTickers, setLastAnalyzedTickers] = useState<string>("");
    const hasAutoFetched = useRef(false);

    // Preparar dados do portfolio para enviar ao Groq
    const preparePortfolioData = useCallback(() => {
        return stocks.map((s) => ({
            ticker: s.ticker,
            preco: s.price,
            variacao: s.change,
            variacaoPercent: s.changePercent,
            lpa: s.lpa,
            vpa: s.vpa,
            roe: s.roe,
            dividendYield: s.dividendYield,
            pl: s.pl,
            pvp: s.pvp,
            debtToEbitda: s.debtToEbitda,
            margemLiquida: s.netMargin,
            score: s.score,
        }));
    }, [stocks]);

    // Buscar insights do Groq
    const fetchInsights = useCallback(async () => {
        if (stocks.length === 0) return;
        if (!providerConfig) {
            setShowKeyConfig(true);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const portfolioData = preparePortfolioData();
            const result = await fetchAIInsights(providerConfig, portfolioData);
            setResponse(result);
            setLastAnalyzedTickers(stocks.map((s) => s.ticker).join(","));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erro ao gerar insights.");
        } finally {
            setIsLoading(false);
        }
    }, [providerConfig, stocks, preparePortfolioData]);

    // Auto-fetch na primeira vez que temos stocks
    useEffect(() => {
        if (
            stocks.length > 0 &&
            !hasAutoFetched.current &&
            !response &&
            !isLoading
        ) {
            hasAutoFetched.current = true;
            fetchInsights();
        }
    }, [stocks, response, isLoading, fetchInsights]);

    const toggleConfig = () => {
        setShowKeyConfig(!showKeyConfig);
    };

    if (stocks.length === 0) return null;

    const currentTickers = stocks.map((s) => s.ticker).join(",");
    const hasNewStocks = response && currentTickers !== lastAnalyzedTickers;

    return (
        <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl overflow-hidden">
            {/* Header com efeito premium */}
            <div className="relative border-b border-border/50 bg-gradient-to-r from-slate-900 via-slate-900 to-primary/10 px-6 py-4 overflow-hidden">
                <div className="relative z-10 flex items-center justify-between">
                    <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Insights de IA
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary/60 ml-1">
                            Groq
                        </span>
                    </h2>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary"
                            onClick={fetchInsights}
                            disabled={isLoading}
                            title="Atualizar insights"
                        >
                            <RefreshCw
                                className={`h-3.5 w-3.5 mr-1 ${isLoading ? "animate-spin" : ""}`}
                            />
                            {isLoading ? "Analisando..." : "Atualizar"}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={toggleConfig}
                            title="Configurar IA"
                        >
                            <Key className="h-3.5 w-3.5" />
                        </Button>
                        {!isLoading && (
                            <div className="flex items-center gap-1.5">
                                <span className={`size-2 rounded-full ${hasConfig ? 'bg-emerald-400' : 'bg-primary/50'} animate-pulse`} />
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    {hasConfig ? providerConfig?.provider : 'Sem Chave'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="absolute -right-10 -top-10 size-40 bg-primary/10 rounded-full blur-3xl" />
            </div>

            <div className="p-6 space-y-4">
                {/* Config da IA */}
                {showKeyConfig && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        <AIProviderSettings />
                    </div>
                )}

                {/* Info sobre Chave da API */}
                {!hasConfig && !showKeyConfig && !response && !isLoading && (
                    <div className="flex flex-col items-center gap-4 px-6 py-10 rounded-xl bg-primary/5 border border-primary/20 text-center">
                        <div className="p-3 rounded-full bg-primary/10">
                            <Key className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white">IA Não Configurada</h3>
                            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                                Configure seu provedor preferido (OpenAI, Claude ou Gemini) para receber analises detalhadas do seu portfolio.
                            </p>
                        </div>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="border-primary/30 text-primary hover:bg-primary/10"
                            onClick={() => setShowKeyConfig(true)}
                        >
                            Configurar Agora
                        </Button>
                    </div>
                )}

                {/* Estado: Carregando */}
                {isLoading && (
                    <div className="flex flex-col items-center py-10">
                        <div className="relative mb-4">
                            <div className="size-16 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                            <Sparkles className="h-6 w-6 text-primary absolute inset-0 m-auto" />
                        </div>
                        <p className="text-sm font-bold text-white mb-1">
                            Groq analisando seu portfolio...
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Processando {stocks.length} ativos com inteligencia artificial
                        </p>
                    </div>
                )}

                {/* Estado: Erro */}
                {error && !isLoading && (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4 text-rose-400" />
                            <p className="text-sm font-bold text-rose-400">Erro na analise</p>
                        </div>
                        <p className="text-xs text-rose-400/80 mb-3">{error}</p>
                        <div className="flex gap-2">
                          <Button
                              variant="outline"
                              size="sm"
                              className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs"
                              onClick={fetchInsights}
                          >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Tentar novamente
                          </Button>
                          {!hasConfig && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-primary/30 text-primary hover:bg-primary/10 text-xs"
                                onClick={() => setShowKeyConfig(true)}
                            >
                                <Key className="h-3 w-3 mr-1" />
                                Configurar IA
                            </Button>
                          )}
                        </div>
                    </div>
                )}

                {/* Estado: Com resultado */}
                {response && !isLoading && (
                    <>
                        {/* Resumo do sentimento */}
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-900/50 border border-border/20">
                            <Zap className="h-5 w-5 text-primary shrink-0" />
                            <div className="flex-1">
                                <p className="text-sm text-slate-300 leading-relaxed">
                                    {response.resumo}
                                </p>
                            </div>
                            {response.sentimento && (
                                <span
                                    className={`shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${sentimentConfig[response.sentimento]?.bg ?? sentimentConfig.neutro.bg
                                        } ${sentimentConfig[response.sentimento]?.color ?? sentimentConfig.neutro.color}`}
                                >
                                    {sentimentConfig[response.sentimento]?.label ?? "NEUTRO"}
                                </span>
                            )}
                        </div>

                        {/* Aviso de ativos novos */}
                        {hasNewStocks && (
                            <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                <p className="text-xs text-amber-400 font-bold">
                                    Portfolio atualizado. Clique em "Atualizar" para nova analise.
                                </p>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-[10px] text-amber-400 hover:text-amber-300"
                                    onClick={fetchInsights}
                                >
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    Atualizar
                                </Button>
                            </div>
                        )}

                        {/* Lista de insights */}
                        <div className="space-y-3">
                            {response.insights.map((insight, index) => {
                                const tipo = insight.tipo as keyof typeof insightConfig;
                                const config = insightConfig[tipo] ?? insightConfig.neutro;
                                const Icon = config.icon;
                                const confianca = insight.confianca as keyof typeof confidenceColors;

                                return (
                                    <div
                                        key={`${insight.titulo}-${index}`}
                                        className={`rounded-xl border ${config.borderColor} ${config.bgColor} p-4 transition-all duration-300 hover:border-primary/30 hover:bg-primary/5 group`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="mt-0.5 p-1.5 rounded-lg bg-card/50 border border-border/20 shrink-0">
                                                <Icon className={`h-4 w-4 ${config.iconColor}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                    <h4 className="text-sm font-black text-white group-hover:text-primary transition-colors">
                                                        {insight.titulo}
                                                    </h4>
                                                    {insight.ticker && (
                                                        <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary">
                                                            {insight.ticker}
                                                        </span>
                                                    )}
                                                    <span
                                                        className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${confidenceColors[confianca] ?? confidenceColors.media
                                                            }`}
                                                    >
                                                        {insight.confianca}
                                                    </span>
                                                    <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-card/50 border border-border/30 text-muted-foreground">
                                                        {insight.categoria}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground leading-relaxed">
                                                    {insight.descricao}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-border/20">
                    <div className="flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground font-bold">
                            Analise meramente informativa. Nao constitui recomendacao de investimento.
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Target className="h-3.5 w-3.5 text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                            Powered by Groq / Llama 3.3 70B
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIInsights;
