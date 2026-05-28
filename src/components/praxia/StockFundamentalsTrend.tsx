import { useEffect, useMemo, useRef, useState } from "react";
import { PraxiaTokens, fmt } from "./tokens";
import { PraxiaCard } from "./PraxiaCard";
import { Sparkline, AreaChart } from "./Charts";
import { DeltaPill } from "./Tag";
import { Icon } from "./Icon";
import { useFundamentalsHistory } from "@/hooks/useFundamentalsHistory";
import type { FundamentalQuarter } from "@/types/stock";

interface StockFundamentalsTrendProps {
  ticker: string;
  accent?: string;
}

type MetricKey = "roe" | "netMargin" | "debtToEbitda" | "dy";

interface MetricConfig {
  key: MetricKey;
  label: string;
  tooltip: string;
  /** Formatador do valor para exibicao. */
  format: (v: number) => string;
  /** Direcao "boa" da metrica — usado para colorir trend. */
  higherIsBetter: boolean;
}

const METRICS: MetricConfig[] = [
  {
    key: "roe",
    label: "ROE",
    tooltip: "Retorno sobre Patrimonio Liquido anualizado (lucro liquido x 4 / PL).",
    format: (v) => fmt.pct(v * 100),
    higherIsBetter: true,
  },
  {
    key: "netMargin",
    label: "Margem Liq.",
    tooltip: "Lucro liquido / receita liquida do trimestre.",
    format: (v) => fmt.pct(v * 100),
    higherIsBetter: true,
  },
  {
    key: "debtToEbitda",
    label: "Div / EBITDA",
    tooltip: "Divida total / EBITDA TTM (rolling 4 trimestres).",
    format: (v) => `${v.toFixed(2)}x`,
    higherIsBetter: false,
  },
  {
    key: "dy",
    label: "DY",
    tooltip: "Dividend Yield TTM. Yahoo publica so o valor corrente — sem serie historica.",
    format: (v) => fmt.pct(v * 100),
    higherIsBetter: true,
  },
];

type Range = "1Y" | "3Y" | "5Y";

function applyRange(quarters: FundamentalQuarter[], range: Range): FundamentalQuarter[] {
  const n = range === "1Y" ? 4 : range === "3Y" ? 12 : 20;
  return quarters.slice(-n);
}

function getValues(quarters: FundamentalQuarter[], key: MetricKey): number[] {
  return quarters.map((q) => q[key]).filter((v): v is number => typeof v === "number");
}

function deltaPctYoY(quarters: FundamentalQuarter[], key: MetricKey): number | null {
  const series = quarters.map((q) => q[key]);
  // Ultimo valor existente e o de 4 trimestres antes (1y).
  const lastIdx = series
    .map((v, i) => (typeof v === "number" ? i : -1))
    .filter((i) => i >= 0)
    .pop();
  if (lastIdx === undefined || lastIdx < 0) return null;
  const yagoIdx = lastIdx - 4;
  if (yagoIdx < 0) return null;
  const last = series[lastIdx];
  const yago = series[yagoIdx];
  if (typeof last !== "number" || typeof yago !== "number" || yago === 0) return null;
  return ((last - yago) / Math.abs(yago)) * 100;
}

function trendColor(values: number[], higherIsBetter: boolean): string {
  if (values.length < 3) return PraxiaTokens.ink50;
  // Sinal simples: ultimo > primeiro = subindo.
  const first = values[0];
  const last = values[values.length - 1];
  const rising = last > first;
  if ((rising && higherIsBetter) || (!rising && !higherIsBetter)) return PraxiaTokens.up;
  if ((rising && !higherIsBetter) || (!rising && higherIsBetter)) return PraxiaTokens.down;
  return PraxiaTokens.ink50;
}

export function StockFundamentalsTrend({
  ticker,
  accent = PraxiaTokens.accent,
}: StockFundamentalsTrendProps) {
  const T = PraxiaTokens;
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  const [expanded, setExpanded] = useState<MetricKey | null>(null);
  const [range, setRange] = useState<Range>("3Y");

  // Lazy mount: so dispara o fetch quando entra no viewport.
  useEffect(() => {
    if (!sectionRef.current) return;
    if (inView) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "120px 0px" }
    );
    io.observe(sectionRef.current);
    return () => io.disconnect();
  }, [inView]);

  const { history, loading, error, fromCache } = useFundamentalsHistory(ticker, inView);

  const ranged = useMemo(() => (history ? applyRange(history, range) : []), [history, range]);

  return (
    <div ref={sectionRef}>
      <PraxiaCard padding={16}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <div
            style={{
              fontFamily: T.mono,
              fontSize: 10.5,
              color: T.ink50,
              letterSpacing: 0.7,
              textTransform: "uppercase",
            }}
          >
            Tendencia de fundamentos
          </div>
          <div
            style={{
              fontFamily: T.display,
              fontSize: 16,
              fontWeight: 600,
              color: T.ink,
              marginTop: 4,
              letterSpacing: -0.2,
            }}
          >
            {ticker.toUpperCase()} · ultimos trimestres
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {(["1Y", "3Y", "5Y"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                background: range === r ? `${accent}26` : "transparent",
                border: `0.5px solid ${range === r ? accent : T.hairline}`,
                color: range === r ? T.ink : T.ink50,
                fontFamily: T.mono,
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: 0.4,
                cursor: "pointer",
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Carregando */}
      {!history && (loading || !inView) && (
        <div
          style={{
            marginTop: 14,
            padding: "20px 0",
            textAlign: "center",
            fontFamily: T.body,
            fontSize: 12,
            color: T.ink50,
            letterSpacing: 0.4,
          }}
        >
          {inView ? "Carregando trimestres do Yahoo…" : "Role para baixo para carregar."}
        </div>
      )}

      {error && !history && (
        <div
          style={{
            marginTop: 14,
            padding: "12px 14px",
            borderRadius: 10,
            background: `${T.down}10`,
            border: `0.5px solid ${T.down}55`,
            fontFamily: T.body,
            fontSize: 12.5,
            color: T.ink,
          }}
        >
          {error}
        </div>
      )}

      {history && history.length === 0 && (
        <div
          style={{
            marginTop: 14,
            padding: "16px 14px",
            borderRadius: 10,
            background: T.surfaceInk,
            border: `0.5px solid ${T.hairline}`,
            fontFamily: T.body,
            fontSize: 12.5,
            color: T.ink70,
            lineHeight: 1.55,
          }}
        >
          Yahoo Finance nao publica historico trimestral para {ticker.toUpperCase()} no momento.
        </div>
      )}

      {history && history.length > 0 && (
        <div
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          {METRICS.map((m) => {
            const values = getValues(ranged, m.key);
            const delta = deltaPctYoY(ranged, m.key);
            const lastValue = values.length > 0 ? values[values.length - 1] : undefined;
            const lineColor = trendColor(values, m.higherIsBetter);
            const isExpanded = expanded === m.key;

            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setExpanded(isExpanded ? null : m.key)}
                title={m.tooltip}
                style={{
                  padding: "12px 12px 14px",
                  borderRadius: 12,
                  background: isExpanded ? `${accent}10` : T.surfaceInk,
                  border: `0.5px solid ${isExpanded ? accent : T.hairline}`,
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  minHeight: 96,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: 9.5,
                      color: T.ink50,
                      letterSpacing: 0.6,
                      textTransform: "uppercase",
                    }}
                  >
                    {m.label}
                  </span>
                  {delta !== null && (
                    <DeltaPill value={Number(delta.toFixed(2))} />
                  )}
                </div>

                <div
                  style={{
                    fontFamily: T.display,
                    fontSize: 20,
                    fontWeight: 600,
                    color: typeof lastValue === "number" ? T.ink : T.ink30,
                    letterSpacing: -0.3,
                    lineHeight: 1.1,
                  }}
                >
                  {typeof lastValue === "number" ? m.format(lastValue) : "—"}
                </div>

                <div style={{ marginTop: "auto" }}>
                  {values.length >= 2 ? (
                    <Sparkline values={values} w={120} h={28} color={lineColor} strokeWidth={1.6} />
                  ) : (
                    <div
                      style={{
                        height: 28,
                        fontFamily: T.body,
                        fontSize: 10.5,
                        color: T.ink30,
                        letterSpacing: 0.3,
                      }}
                    >
                      sem serie
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Overlay expandido */}
      {expanded && history && history.length > 0 && (
        <div
          style={{
            marginTop: 14,
            padding: "14px 14px 16px",
            borderRadius: 12,
            background: T.surface2,
            border: `0.5px solid ${accent}55`,
          }}
        >
          {(() => {
            const m = METRICS.find((x) => x.key === expanded);
            if (!m) return null;
            const values = getValues(ranged, m.key);
            const labels = ranged
              .filter((q) => typeof q[m.key] === "number")
              .map((q) => q.periodo);
            const lineColor = trendColor(values, m.higherIsBetter);
            const lastValue = values[values.length - 1];
            const firstValue = values[0];
            const diffAbs = typeof lastValue === "number" && typeof firstValue === "number"
              ? lastValue - firstValue
              : null;

            return (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div>
                    <div
                      style={{
                        fontFamily: T.display,
                        fontSize: 18,
                        fontWeight: 600,
                        color: T.ink,
                        letterSpacing: -0.3,
                      }}
                    >
                      {m.label}
                    </div>
                    <div
                      style={{
                        fontFamily: T.body,
                        fontSize: 11.5,
                        color: T.ink50,
                        marginTop: 2,
                        maxWidth: 280,
                        lineHeight: 1.45,
                      }}
                    >
                      {m.tooltip}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpanded(null)}
                    aria-label="Fechar"
                    style={{ background: "transparent", border: "none", color: T.ink50, cursor: "pointer" }}
                  >
                    <Icon.close size={14} color={T.ink50} />
                  </button>
                </div>

                {values.length >= 2 ? (
                  <div style={{ marginTop: 12 }}>
                    <AreaChart
                      values={values}
                      w={320}
                      h={140}
                      color={lineColor}
                      fillId={`fundtrend-${m.key}`}
                      strokeWidth={2}
                    />
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: 6,
                        fontFamily: T.mono,
                        fontSize: 10,
                        color: T.ink50,
                      }}
                    >
                      <span>{labels[0]}</span>
                      <span>{labels[labels.length - 1]}</span>
                    </div>
                    {diffAbs !== null && (
                      <div
                        style={{
                          marginTop: 10,
                          fontFamily: T.body,
                          fontSize: 12.5,
                          color: T.ink70,
                        }}
                      >
                        {labels.length} trimestres · variacao {m.format(diffAbs)} no periodo
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      marginTop: 10,
                      fontFamily: T.body,
                      fontSize: 12,
                      color: T.ink50,
                      letterSpacing: 0.3,
                    }}
                  >
                    Sem serie suficiente para esta metrica.
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      <div
        style={{
          marginTop: 12,
          fontFamily: T.body,
          fontSize: 10,
          color: T.ink30,
          letterSpacing: 0.3,
        }}
      >
        Fonte: Yahoo Finance{history && history.length > 0 ? " · " : ""}
        {fromCache ? "cache 7d" : ""}
      </div>
      </PraxiaCard>
    </div>
  );
}
