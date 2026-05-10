import React, { useState } from "react";
import {
  Bot,
  Loader2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Minus,
  FileBarChart,
  GitCompareArrows,
  Key,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { analisarAcaoComIA, type AnaliseIA, type DadosQuantitativos } from "@/lib/ai";
import { useAIProvider } from "@/hooks/useAIProvider";

type Status = "idle" | "loading-scraping" | "loading-ai" | "error" | "success";

interface AIAnalysisPanelProps {
  ticker: string;
  nomeEmpresa: string;
  cotacao: number;
  precoTeto: number;
  margemSeguranca: number;
  score: number;
  pl: number;
  pvp: number;
  roe: number;
  dividendYield: number;
  debtToEbitda: number;
  netMargin: number;
}

// Cores por tipo de recomendacao
const REC_STYLES = {
  COMPRAR: {
    border: "border-emerald-500/40",
    text: "text-emerald-400",
    bg: "bg-emerald-950/30",
    icon: TrendingUp,
    label: "COMPRAR",
  },
  SEGURAR: {
    border: "border-yellow-500/40",
    text: "text-yellow-400",
    bg: "bg-yellow-950/30",
    icon: Minus,
    label: "SEGURAR",
  },
  VENDER: {
    border: "border-rose-500/40",
    text: "text-rose-400",
    bg: "bg-rose-950/30",
    icon: TrendingDown,
    label: "VENDER",
  },
} as const;

export const AIAnalysisPanel: React.FC<AIAnalysisPanelProps> = ({
  ticker,
  nomeEmpresa,
  cotacao,
  precoTeto,
  margemSeguranca,
  score,
  pl,
  pvp,
  roe,
  dividendYield,
  debtToEbitda,
  netMargin,
}) => {
  const { providerConfig, hasConfig } = useAIProvider();
  const [status, setStatus] = useState<Status>("idle");
  const [analise, setAnalise] = useState<AnaliseIA | null>(null);
  const [erro, setErro] = useState<string>("");

  const executarAnalise = async () => {
    if (!providerConfig) {
      setErro("IA nao configurada. Configure seu provedor preferido no painel de insights acima.");
      setStatus("error");
      return;
    }

    setStatus("loading-scraping");
    setErro("");
    setAnalise(null);

    try {
      const dados: DadosQuantitativos = {
        cotacao,
        precoTeto,
        margemSeguranca,
        score,
        pl,
        pvp,
        roe,
        dividendYield,
        debtToEbitda,
        netMargin,
      };

      const timeoutId = setTimeout(() => setStatus("loading-ai"), 2000);

      const resultado = await analisarAcaoComIA(
        providerConfig,
        ticker,
        nomeEmpresa,
        dados
      );

      clearTimeout(timeoutId);
      setAnalise(resultado);
      setStatus("success");
    } catch (err) {
      setErro(
        err instanceof Error ? err.message : "Erro desconhecido ao analisar."
      );
      setStatus("error");
    }
  };

  // Info sobre chave (opcional agora)
  const renderStatusInfo = () => {
    if (hasConfig) return null;
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10 mb-2">
        <Key className="h-3 w-3 text-primary/60" />
        <p className="text-[10px] text-muted-foreground">
          IA nao configurada. Clique no ícone de chave no painel de insights para configurar.
        </p>
      </div>
    );
  };

  // ─── Estado: Idle ───
  if (status === "idle") {
    return (
      <div className="flex flex-col gap-2">
        {renderStatusInfo()}
        <Button
          onClick={executarAnalise}
          variant="outline"
          size="sm"
          disabled={!hasConfig}
          className="h-8 gap-2 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 text-xs font-bold transition-all w-fit disabled:opacity-50"
        >
          <Bot className="h-3.5 w-3.5" />
          Analisar com IA
        </Button>
      </div>
    );
  }

  // ─── Estado: Loading ───
  if (status === "loading-scraping" || status === "loading-ai") {
    return (
      <div className="flex items-center gap-3 px-4 py-4 rounded-xl bg-primary/5 border border-primary/20 animate-in fade-in duration-300">
        <div className="relative">
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold text-white">
            {status === "loading-scraping"
              ? `Coletando dados de ${ticker}...`
              : `Analisando ${ticker} com IA...`}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {status === "loading-scraping"
              ? "Buscando dados de RI no Investidor10 / StatusInvest"
              : `Processando com ${providerConfig?.provider.toUpperCase()}`}
          </span>
        </div>
      </div>
    );
  }

  // ─── Estado: Erro ───
  if (status === "error") {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 animate-in fade-in duration-300">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-4 w-4 text-rose-400" />
          <p className="text-sm font-bold text-rose-400">
            Erro ao analisar {ticker}
          </p>
        </div>
        <p className="text-xs text-rose-400/80 mb-3">{erro}</p>
        <Button
          variant="outline"
          size="sm"
          className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs h-7"
          onClick={executarAnalise}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  // ─── Estado: Sucesso ───
  if (status === "success" && analise) {
    const recStyle = REC_STYLES[analise.recomendacao] ?? REC_STYLES.SEGURAR;
    const RecIcon = recStyle.icon;

    return (
      <div className="rounded-xl border border-border/40 bg-slate-900/60 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-400">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <FileBarChart className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-white">
              Analise IA
            </span>
            {analise.periodoAnalisado && (
              <span className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                {analise.periodoAnalisado}
              </span>
            )}
          </div>
          {analise.fonte && (
            <a
              href={analise.fonte}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
            >
              Fonte
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        <div className="p-4 space-y-4">
          {/* Resultado Trimestral */}
          {analise.resumoTrimestral && (
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                Resultado Trimestral
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                {analise.resumoTrimestral}
              </p>
            </div>
          )}

          {/* Comparacao com trimestre anterior */}
          {analise.comparacaoTrimestre && (
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <GitCompareArrows className="h-3 w-3" />
                Comparacao Trimestral
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                {analise.comparacaoTrimestre}
              </p>
            </div>
          )}

          {/* Red Flags */}
          {analise.redFlags && analise.redFlags.length > 0 && (
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-400/80 mb-1.5 flex items-center gap-1.5">
                <ShieldAlert className="h-3 w-3" />
                Red Flags
              </h4>
              <ul className="space-y-1">
                {analise.redFlags.map((flag, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs text-amber-400/70"
                  >
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400/50 shrink-0" />
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recomendacao */}
          <div
            className={`rounded-lg border-2 ${recStyle.border} ${recStyle.bg} p-3`}
          >
            <div className="flex items-center gap-2 mb-1">
              <RecIcon className={`h-4 w-4 ${recStyle.text}`} />
              <span
                className={`text-sm font-black uppercase tracking-wide ${recStyle.text}`}
              >
                {recStyle.label}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {analise.justificativa}
            </p>
          </div>

          {/* Footer: Reanalisar */}
          <div className="flex items-center justify-between pt-2 border-t border-border/20">
            <span className="text-[10px] text-muted-foreground">
              Analise meramente informativa. Nao constitui recomendacao de investimento.
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary"
              onClick={executarAnalise}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Reanalisar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default AIAnalysisPanel;
