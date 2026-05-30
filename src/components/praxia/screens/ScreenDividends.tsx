import { useMemo } from "react";
import { PraxiaTokens, fmt } from "../tokens";
import { PraxiaBackground } from "../PraxiaBackground";
import { PraxiaCard } from "../PraxiaCard";
import { GlassButton } from "../GlassButton";
import { Icon } from "../Icon";
import { FeatureHintBanner } from "@/components/praxia/FeatureHintBanner";
import { useDividendCalendar } from "@/hooks/useDividendCalendar";
import type { Stock } from "@/types/stock";

interface ScreenDividendsProps {
  accent?: string;
  stocks: Stock[];
  onBack: () => void;
  /** Callback recebe o total anual projetado para o pai abrir o modal de otimização. */
  onOptimize?: (annualProjected: number) => void;
}

const MONTH_LABELS_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function formatMonthLabel(monthKey: string): { mes: string; ano: string } {
  // monthKey vem como "YYYY-MM"
  const [year, month] = monthKey.split("-");
  const idx = Math.max(0, Math.min(11, Number(month) - 1));
  return { mes: MONTH_LABELS_PT[idx], ano: year };
}

export function ScreenDividends({
  accent = PraxiaTokens.accent,
  stocks,
  onBack,
  onOptimize,
}: ScreenDividendsProps) {
  const T = PraxiaTokens;
  const { buckets, byTicker, annualTotal, loading, error, refetch } = useDividendCalendar(stocks);

  const monthlyAverage = useMemo(() => annualTotal / 12, [annualTotal]);

  const eligibleStocks = stocks.filter((s) => s.quantity > 0);
  const hasProjection = annualTotal > 0;

  return (
    <div
      className="praxia-scroll"
      style={{
        position: "relative",
        height: "100dvh",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      <PraxiaBackground accent={accent} />
      <div
        style={{
          position: "relative",
          zIndex: 2,
          padding: "54px 16px 120px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 4,
          }}
        >
          <GlassButton onClick={onBack} ariaLabel="Voltar">
            <Icon.arrowLeft size={16} color={T.ink70} />
          </GlassButton>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: T.display,
                fontSize: 22,
                fontWeight: 600,
                color: T.ink,
                letterSpacing: -0.4,
              }}
            >
              Calendário de dividendos
            </div>
            <div
              style={{
                fontFamily: T.body,
                fontSize: 11.5,
                color: T.ink50,
                marginTop: 2,
                letterSpacing: 0.2,
              }}
            >
              Projeção dos próximos 12 meses · baseado no histórico
            </div>
          </div>
          <GlassButton onClick={() => void refetch()} ariaLabel="Atualizar">
            <Icon.refresh size={16} color={T.ink70} />
          </GlassButton>
        </div>

        <FeatureHintBanner hintKey="dividends" accent={accent} />

        {/* Empty state: sem ações na carteira */}
        {eligibleStocks.length === 0 && (
          <PraxiaCard padding={20}>
            <div
              style={{
                fontFamily: T.body,
                fontSize: 13,
                color: T.ink70,
                lineHeight: 1.55,
              }}
            >
              Você ainda não tem ações com posição na carteira. Adicione tickers
              em <strong style={{ color: T.ink }}>Mercado</strong> para ver
              quanto de provento esperar nos próximos 12 meses.
            </div>
          </PraxiaCard>
        )}

        {/* Erro */}
        {error && (
          <PraxiaCard
            padding={14}
            style={{
              background: `${T.down}10`,
              border: `0.5px solid ${T.down}55`,
            }}
          >
            <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.ink }}>
              {error}
            </div>
          </PraxiaCard>
        )}

        {/* Resumo */}
        {eligibleStocks.length > 0 && (
          <PraxiaCard padding={18} raised>
            <div
              style={{
                fontFamily: T.body,
                fontSize: 11,
                color: T.ink50,
                letterSpacing: 0.6,
                textTransform: "uppercase",
              }}
            >
              Total projetado · 12 meses
            </div>
            <div
              style={{
                fontFamily: T.display,
                fontSize: 30,
                fontWeight: 600,
                color: hasProjection ? T.ink : T.ink50,
                letterSpacing: -0.6,
                marginTop: 6,
                lineHeight: 1.1,
              }}
            >
              {fmt.brl(annualTotal)}
            </div>
            <div
              style={{
                marginTop: 10,
                display: "flex",
                gap: 18,
                fontFamily: T.body,
                fontSize: 12.5,
                color: T.ink70,
              }}
            >
              <div>
                <div style={{ fontSize: 10.5, color: T.ink50, letterSpacing: 0.4 }}>
                  Média mensal
                </div>
                <div style={{ fontFamily: T.mono, color: T.ink, marginTop: 2 }}>
                  {fmt.brl(monthlyAverage)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: T.ink50, letterSpacing: 0.4 }}>
                  Tickers projetando
                </div>
                <div style={{ fontFamily: T.mono, color: T.ink, marginTop: 2 }}>
                  {Object.values(byTicker).filter((p) => p.some((b) => b.amount > 0)).length}
                </div>
              </div>
            </div>

            {!hasProjection && !loading && (
              <div
                style={{
                  marginTop: 14,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: T.surfaceInk,
                  fontFamily: T.body,
                  fontSize: 12,
                  color: T.ink70,
                  lineHeight: 1.5,
                }}
              >
                Nenhum dos seus tickers tem histórico de pagamento. Empresas
                como PETR4, ITSA4, BBAS3 e FIIs (XXXX11) costumam aparecer aqui.
              </div>
            )}

            {hasProjection && onOptimize && (
              <button
                type="button"
                onClick={() => onOptimize(annualTotal)}
                style={{
                  marginTop: 14,
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${accent}26, ${accent}10)`,
                  border: `0.5px solid ${accent}55`,
                  color: T.ink,
                  fontFamily: T.body,
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: 0.2,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Icon.invest size={14} color={accent} />
                Otimizar renda passiva com IA
              </button>
            )}
          </PraxiaCard>
        )}

        {/* Loading */}
        {loading && eligibleStocks.length > 0 && (
          <div
            style={{
              fontFamily: T.body,
              fontSize: 12,
              color: T.ink50,
              textAlign: "center",
              padding: "12px 0",
              letterSpacing: 0.4,
            }}
          >
            Buscando histórico…
          </div>
        )}

        {/* Lista de meses */}
        {eligibleStocks.length > 0 &&
          buckets.map((bucket) => {
            const { mes, ano } = formatMonthLabel(bucket.month);
            const tickersThatPay = Object.entries(byTicker)
              .map(([ticker, projection]) => {
                const monthBucket = projection.find((b) => b.month === bucket.month);
                return { ticker, amount: monthBucket?.amount ?? 0 };
              })
              .filter((row) => row.amount > 0)
              .sort((a, b) => b.amount - a.amount);

            const isEmpty = bucket.amount === 0;

            return (
              <PraxiaCard
                key={bucket.month}
                padding={14}
                style={{
                  opacity: isEmpty ? 0.55 : 1,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: T.display,
                        fontSize: 17,
                        fontWeight: 600,
                        color: T.ink,
                        letterSpacing: -0.2,
                      }}
                    >
                      {mes}
                    </div>
                    <div
                      style={{
                        fontFamily: T.body,
                        fontSize: 10.5,
                        color: T.ink50,
                        letterSpacing: 0.4,
                      }}
                    >
                      {ano}
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: T.mono,
                      fontSize: 15,
                      color: isEmpty ? T.ink30 : T.ink,
                      fontWeight: 600,
                    }}
                  >
                    {fmt.brl(bucket.amount)}
                  </div>
                </div>

                {tickersThatPay.length > 0 && (
                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      borderTop: `0.5px solid ${T.hairline}`,
                      paddingTop: 10,
                    }}
                  >
                    {tickersThatPay.map((row) => (
                      <div
                        key={row.ticker}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontFamily: T.body,
                          fontSize: 12,
                          color: T.ink70,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: T.mono,
                            fontWeight: 600,
                            color: T.ink,
                            fontSize: 11.5,
                            letterSpacing: 0.3,
                          }}
                        >
                          {row.ticker}
                        </span>
                        <span style={{ fontFamily: T.mono, color: T.ink70 }}>
                          {fmt.brl(row.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </PraxiaCard>
            );
          })}

        <div
          style={{
            fontFamily: T.body,
            fontSize: 10.5,
            color: T.ink30,
            textAlign: "center",
            paddingTop: 4,
            letterSpacing: 0.3,
          }}
        >
          Projeção estimada · histórico via Yahoo Finance · cache de 7 dias
        </div>
      </div>
    </div>
  );
}
