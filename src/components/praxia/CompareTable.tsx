import { PraxiaTokens, fmt } from "./tokens";
import { StockAvatar } from "./StockAvatar";
import type { Stock } from "@/types/stock";
import { calculateGrahamValue, calculateMarginOfSafety } from "@/lib/calculators";

interface CompareTableProps {
  stocks: Stock[];
  accent?: string;
  winnerTicker?: string;
  onRemove?: (ticker: string) => void;
}

type Direction = "higher" | "lower";

interface Row {
  label: string;
  values: (number | null)[];
  format: (v: number) => string;
  best: Direction;
  /** true if 0 means "no data" instead of a real value */
  zeroIsNA?: boolean;
}

function bestIndex(values: (number | null)[], best: Direction, zeroIsNA?: boolean): number {
  const candidates = values
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => v !== null && !Number.isNaN(v!) && (!zeroIsNA || v !== 0));
  if (candidates.length === 0) return -1;
  candidates.sort((a, b) => (best === "higher" ? b.v! - a.v! : a.v! - b.v!));
  return candidates[0].i;
}

export function CompareTable({
  stocks,
  accent = PraxiaTokens.accent,
  winnerTicker,
  onRemove,
}: CompareTableProps) {
  const T = PraxiaTokens;

  const rows: Row[] = [
    {
      label: "Preço",
      values: stocks.map((s) => s.price),
      format: fmt.brl,
      best: "lower",
      zeroIsNA: true,
    },
    {
      label: "Score (0–100)",
      values: stocks.map((s) => s.score),
      format: (v) => `${Math.round(v)}`,
      best: "higher",
    },
    {
      label: "P/L",
      values: stocks.map((s) => (s.pl > 0 ? s.pl : null)),
      format: (v) => `${v.toFixed(1)}x`,
      best: "lower",
    },
    {
      label: "P/VP",
      values: stocks.map((s) => (s.pvp > 0 ? s.pvp : null)),
      format: (v) => v.toFixed(2),
      best: "lower",
    },
    {
      label: "ROE",
      values: stocks.map((s) => s.roe),
      format: (v) => `${(v * 100).toFixed(1)}%`,
      best: "higher",
    },
    {
      label: "Dividend Yield",
      values: stocks.map((s) => (s.dividendYield > 0 ? s.dividendYield : null)),
      format: (v) => `${(v * 100).toFixed(2)}%`,
      best: "higher",
    },
    {
      label: "Dív/EBITDA",
      values: stocks.map((s) => (s.debtToEbitda > 0 ? s.debtToEbitda : null)),
      format: (v) => `${v.toFixed(1)}x`,
      best: "lower",
    },
    {
      label: "Margem líquida",
      values: stocks.map((s) => (s.netMargin > 0 ? s.netMargin : null)),
      format: (v) => `${(v * 100).toFixed(1)}%`,
      best: "higher",
    },
    {
      label: "Graham VI",
      values: stocks.map((s) => {
        const v = calculateGrahamValue(s.lpa, s.vpa);
        return v > 0 ? v : null;
      }),
      format: fmt.brl,
      best: "higher",
    },
    {
      label: "Margem segurança",
      values: stocks.map((s) => {
        const v = calculateGrahamValue(s.lpa, s.vpa);
        return v > 0 ? calculateMarginOfSafety(s.price, v) * 100 : null;
      }),
      format: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`,
      best: "higher",
    },
  ];

  return (
    <div
      style={{
        borderRadius: 18,
        background: "linear-gradient(160deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.01) 100%)",
        border: `0.5px solid ${T.hairline}`,
        overflow: "hidden",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `1.1fr repeat(${stocks.length}, 1fr)`,
          alignItems: "stretch",
          background: "rgba(255,255,255,0.02)",
          borderBottom: `0.5px solid ${T.hairline}`,
        }}
      >
        <div
          style={{
            padding: "10px 12px",
            fontFamily: T.body,
            fontSize: 10.5,
            letterSpacing: 0.6,
            color: T.ink50,
            textTransform: "uppercase",
            display: "flex",
            alignItems: "center",
          }}
        >
          Métrica
        </div>
        {stocks.map((s) => {
          const isWinner = winnerTicker && s.ticker === winnerTicker;
          return (
            <div
              key={s.ticker}
              style={{
                padding: "10px 8px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                position: "relative",
                background: isWinner ? `${accent}14` : "transparent",
                borderLeft: `0.5px solid ${T.hairline}`,
              }}
            >
              <StockAvatar ticker={s.ticker} color={s.brandColor} size={30} />
              <div
                style={{
                  fontFamily: T.display,
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: T.ink,
                  letterSpacing: 0.4,
                }}
              >
                {s.ticker}
              </div>
              {isWinner && (
                <span
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    padding: "2px 5px",
                    borderRadius: 4,
                    background: accent,
                    color: "white",
                    fontFamily: T.mono,
                    fontSize: 8,
                    fontWeight: 700,
                    letterSpacing: 0.6,
                  }}
                  title="Mais alinhado ao seu perfil"
                >
                  TOP
                </span>
              )}
              {onRemove && (
                <button
                  onClick={() => onRemove(s.ticker)}
                  aria-label={`Remover ${s.ticker}`}
                  style={{
                    position: "absolute",
                    top: 4,
                    left: 4,
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    border: "none",
                    background: "rgba(255,107,129,0.18)",
                    color: T.down,
                    cursor: "pointer",
                    fontFamily: T.mono,
                    fontSize: 10,
                    fontWeight: 700,
                    lineHeight: 1,
                    padding: 0,
                  }}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Metric rows */}
      {rows.map((row, ri) => {
        const winnerIdx = bestIndex(row.values, row.best, row.zeroIsNA);
        return (
          <div
            key={row.label}
            style={{
              display: "grid",
              gridTemplateColumns: `1.1fr repeat(${stocks.length}, 1fr)`,
              borderBottom: ri === rows.length - 1 ? "none" : `0.5px solid ${T.hairline}`,
            }}
          >
            <div
              style={{
                padding: "10px 12px",
                fontFamily: T.body,
                fontSize: 12,
                color: T.ink70,
                display: "flex",
                alignItems: "center",
              }}
            >
              {row.label}
            </div>
            {row.values.map((v, vi) => {
              const isBest = vi === winnerIdx;
              return (
                <div
                  key={vi}
                  style={{
                    padding: "10px 6px",
                    fontFamily: T.mono,
                    fontSize: 12.5,
                    fontWeight: isBest ? 700 : 500,
                    color: v === null ? T.ink30 : isBest ? PraxiaTokens.up : T.ink,
                    textAlign: "center",
                    fontVariantNumeric: "tabular-nums",
                    background: isBest ? "rgba(66,232,163,0.08)" : "transparent",
                    borderLeft: `0.5px solid ${T.hairline}`,
                  }}
                >
                  {v === null ? "—" : row.format(v)}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
