import { useEffect, useMemo, useState } from "react";
import { PraxiaTokens, fmt } from "./tokens";
import { PraxiaCard } from "./PraxiaCard";
import { AIBadge } from "./AIBadge";
import { useRelatorios } from "@/hooks/useRelatorios";
import type { Relatorio } from "@/types/stock";
import { fetchFundamentalsFromAI, quartersFromAI } from "@/lib/fundamentals";

interface StockReportsSectionProps {
  ticker: string;
  maxQuarters?: number;
  /** Preço atual da ação, repassado pro fallback IA fazer cálculos consistentes. */
  currentPrice?: number;
}

function formatBigNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)} bi`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)} mi`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)} mil`;
  return fmt.num(value);
}

export function StockReportsSection({
  ticker,
  maxQuarters = 4,
  currentPrice,
}: StockReportsSectionProps) {
  const T = PraxiaTokens;
  const tickers = useMemo(() => [ticker], [ticker]);
  const { relatorios, loading, error, refetch } = useRelatorios(tickers);
  const [aiQuarters, setAiQuarters] = useState<Relatorio[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const realQuarters: Relatorio[] = useMemo(
    () =>
      relatorios
        .filter((r) => r.ticker.toUpperCase() === ticker.toUpperCase())
        .slice(0, maxQuarters),
    [relatorios, ticker, maxQuarters]
  );

  // Quando não há nenhum relatório oficial, busca via IA — ela tenta os 2
  // últimos trimestres conhecidos + projeção do próximo. Tudo marcado.
  // Evitamos setState síncrono no body do efeito agendando via microtask.
  useEffect(() => {
    let cancelled = false;
    if (loading) return;
    if (realQuarters.length > 0) {
      // limpa o aiQuarters via microtask para não disparar set-state-in-effect
      Promise.resolve().then(() => {
        if (!cancelled) setAiQuarters(null);
      });
      return;
    }
    Promise.resolve().then(() => {
      if (cancelled) return;
      setAiLoading(true);
      fetchFundamentalsFromAI(ticker, currentPrice).then((ai) => {
        if (cancelled) return;
        setAiQuarters(ai ? quartersFromAI(ai).slice(0, maxQuarters) : []);
        setAiLoading(false);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [ticker, loading, realQuarters.length, maxQuarters, currentPrice]);

  const recent: Relatorio[] = realQuarters.length > 0 ? realQuarters : aiQuarters ?? [];
  const isAIFallback = realQuarters.length === 0 && (aiQuarters?.length ?? 0) > 0;

  return (
    <PraxiaCard padding={14} style={{ marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: T.display,
            fontWeight: 600,
            fontSize: 13,
            color: T.ink,
          }}
        >
          Resultados trimestrais
          {isAIFallback && <AIBadge confianca="media" reference="Pesquisado/projetado por IA" />}
        </div>
        <button
          onClick={() => refetch()}
          disabled={loading}
          style={{
            marginLeft: "auto",
            padding: "4px 10px",
            borderRadius: 6,
            border: `0.5px solid ${T.hairline}`,
            background: "transparent",
            color: T.ink50,
            fontFamily: T.mono,
            fontSize: 10,
            letterSpacing: 0.5,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "..." : "ATUALIZAR"}
        </button>
      </div>

      {(loading || aiLoading) && recent.length === 0 && (
        <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.ink50 }}>
          {aiLoading ? "Pesquisando últimos trimestres via IA…" : "Carregando relatórios…"}
        </div>
      )}

      {error && recent.length === 0 && !aiLoading && (
        <div style={{ fontFamily: T.body, fontSize: 12, color: T.down }}>
          Não foi possível buscar os relatórios. {error}
        </div>
      )}

      {!loading && !aiLoading && !error && recent.length === 0 && (
        <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.ink50, lineHeight: 1.5 }}>
          Sem relatórios disponíveis para {ticker}.
        </div>
      )}

      {recent.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {recent.map((r, idx) => {
            const positive = r.resultado === "positivo";
            const isProjecao = r.tipo === "projecao";
            const date = new Date(r.dataFim);
            const isoDate = isNaN(date.getTime())
              ? r.dataFim
              : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
            return (
              <div
                key={`${r.periodo}-${idx}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr 1fr",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: isProjecao
                    ? `${T.gold}0d`
                    : "rgba(244,236,223,0.03)",
                  border: isProjecao
                    ? `0.5px dashed ${T.goldDim}`
                    : `0.5px solid ${T.hairline}`,
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: T.display,
                      fontWeight: 600,
                      fontSize: 13,
                      color: T.ink,
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    {r.periodo}
                    {r.aiEstimated && (
                      <AIBadge
                        confianca={isProjecao ? "baixa" : "media"}
                        reference={r.referencia ?? "Pesquisado por IA"}
                      />
                    )}
                  </div>
                  <div style={{ fontFamily: T.body, fontSize: 10, color: T.ink30 }}>
                    {isProjecao ? "projeção" : isoDate}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: T.mono, fontSize: 10, color: T.ink30, letterSpacing: 0.4 }}>
                    RECEITA
                  </div>
                  <div
                    style={{
                      fontFamily: T.mono,
                      fontSize: 13,
                      color: T.ink,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    R$ {formatBigNumber(r.receita)}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: T.mono, fontSize: 10, color: T.ink30, letterSpacing: 0.4 }}>
                    LUCRO LÍQ.
                  </div>
                  <div
                    style={{
                      fontFamily: T.mono,
                      fontSize: 13,
                      color: positive ? T.up : T.down,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    R$ {formatBigNumber(r.lucroLiquido)}
                  </div>
                </div>
                {r.comentario && (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      marginTop: 4,
                      fontFamily: T.body,
                      fontSize: 11.5,
                      color: T.ink70,
                      lineHeight: 1.4,
                    }}
                  >
                    {r.comentario}
                  </div>
                )}
              </div>
            );
          })}
          <div
            style={{
              marginTop: 4,
              fontFamily: T.body,
              fontSize: 10.5,
              color: T.ink30,
              textAlign: "right",
            }}
          >
            {isAIFallback
              ? "fonte: pesquisa/projeção IA · cache 12h"
              : "fonte: Yahoo Finance · cache 24h"}
          </div>
        </div>
      )}
    </PraxiaCard>
  );
}
