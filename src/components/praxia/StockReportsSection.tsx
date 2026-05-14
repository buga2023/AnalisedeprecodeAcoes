import { useMemo } from "react";
import { PraxiaTokens, fmt } from "./tokens";
import { PraxiaCard } from "./PraxiaCard";
import { useRelatorios } from "@/hooks/useRelatorios";
import type { Relatorio } from "@/types/stock";

interface StockReportsSectionProps {
  ticker: string;
  maxQuarters?: number;
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
}: StockReportsSectionProps) {
  const T = PraxiaTokens;
  const tickers = useMemo(() => [ticker], [ticker]);
  const { relatorios, loading, error, refetch } = useRelatorios(tickers);

  const recent: Relatorio[] = useMemo(
    () =>
      relatorios
        .filter((r) => r.ticker.toUpperCase() === ticker.toUpperCase())
        .slice(0, maxQuarters),
    [relatorios, ticker, maxQuarters]
  );

  return (
    <PraxiaCard padding={14} style={{ marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 13, color: T.ink }}>
          Resultados trimestrais
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

      {loading && recent.length === 0 && (
        <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.ink50 }}>
          Carregando relatórios…
        </div>
      )}

      {error && recent.length === 0 && (
        <div style={{ fontFamily: T.body, fontSize: 12, color: T.down }}>
          Não foi possível buscar os relatórios. {error}
        </div>
      )}

      {!loading && !error && recent.length === 0 && (
        <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.ink50, lineHeight: 1.5 }}>
          Sem relatórios disponíveis para {ticker}.
        </div>
      )}

      {recent.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {recent.map((r, idx) => {
            const positive = r.resultado === "positivo";
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
                  background: "rgba(255,255,255,0.03)",
                  border: `0.5px solid ${T.hairline}`,
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: T.display,
                      fontWeight: 600,
                      fontSize: 13,
                      color: T.ink,
                    }}
                  >
                    {r.periodo}
                  </div>
                  <div style={{ fontFamily: T.body, fontSize: 10, color: T.ink30 }}>{isoDate}</div>
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
            fonte: BrAPI/Yahoo · cache 24h
          </div>
        </div>
      )}
    </PraxiaCard>
  );
}
