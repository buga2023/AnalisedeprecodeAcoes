import { PraxiaTokens, fmt } from "./tokens";
import { PraxiaCard } from "./PraxiaCard";
import { Icon } from "./Icon";
import { StatusTag } from "./Tag";

interface WeeklyPerformanceCardProps {
  accent?: string;
  /** 7 numeric values, oldest → newest. Required length 7. */
  values: number[];
  /** Day-of-week labels, default S M T W T F S. */
  labels?: [string, string, string, string, string, string, string];
  /** Index 0–6 of the highlighted bar (defaults to last). */
  activeIdx?: number;
}

const DEFAULT_LABELS: [string, string, string, string, string, string, string] = [
  "S",
  "M",
  "T",
  "W",
  "T",
  "F",
  "S",
];

/**
 * Vertical bar chart "S M T W T F S" with the active day highlighted by
 * a vertical band, a stem line, a white-dot marker, and a floating
 * tooltip above with the active value. Matches the Praxia Design canvas
 * BarWeekChart spec (perf-cards.jsx).
 */
function BarWeekChart({
  values,
  labels = DEFAULT_LABELS,
  activeIdx,
  color,
  w = 186,
  h = 130,
}: {
  values: number[];
  labels?: WeeklyPerformanceCardProps["labels"];
  activeIdx?: number;
  color: string;
  w?: number;
  h?: number;
}) {
  const T = PraxiaTokens;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const padTop = 26;
  const padBottom = 36;
  const usable = h - padTop - padBottom;
  const colW = w / values.length;
  const ai = activeIdx ?? values.length - 1;
  const safeLabels = labels ?? DEFAULT_LABELS;

  const normY = (v: number) => {
    const denom = max - min * 0.5 || 1;
    return padTop + (1 - (v - min * 0.5) / denom) * usable;
  };

  return (
    <div style={{ position: "relative", width: w, height: h }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {values.map((v, i) => {
          const cy = normY(v);
          const cx = colW * i + colW / 2;
          const active = i === ai;
          return (
            <g key={i}>
              {active && (
                <rect
                  x={cx - 18}
                  y={padTop - 6}
                  width={36}
                  height={usable + 12}
                  rx={18}
                  fill={`${color}11`}
                  stroke={`${color}33`}
                  strokeWidth="0.5"
                />
              )}
              <line
                x1={cx}
                y1={padTop + usable}
                x2={cx}
                y2={cy}
                stroke={active ? color : "rgba(255,255,255,0.18)"}
                strokeWidth={active ? 2 : 1}
              />
              <circle
                cx={cx}
                cy={cy}
                r={active ? 5 : 3.5}
                fill={active ? "#fff" : color}
                stroke={active ? color : "none"}
                strokeWidth={active ? 2 : 0}
              />
              <circle
                cx={cx}
                cy={padTop + usable + 18}
                r={11}
                fill={active ? color : "rgba(255,255,255,0.06)"}
                stroke={active ? "none" : "rgba(255,255,255,0.08)"}
                strokeWidth="0.5"
              />
              <text
                x={cx}
                y={padTop + usable + 22}
                textAnchor="middle"
                fontSize={11}
                fontWeight={active ? 700 : 500}
                fill={active ? "#fff" : T.ink50}
                fontFamily={T.body}
              >
                {safeLabels[i]}
              </text>
            </g>
          );
        })}
      </svg>
      {/* Floating tooltip on active bar */}
      {(() => {
        const cx = colW * ai + colW / 2;
        const cy = normY(values[ai]);
        return (
          <div
            style={{
              position: "absolute",
              left: cx - 40,
              top: Math.max(0, cy - 32),
              minWidth: 80,
              height: 22,
              padding: "0 8px",
              borderRadius: 11,
              background: "#0a1230",
              border: `0.5px solid ${T.hairlineStrong}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: T.mono,
              fontSize: 11,
              color: T.ink,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
              boxShadow: `0 6px 18px rgba(0,0,0,0.5), 0 0 0 0.5px ${color}33`,
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            {fmt.compact(values[ai])}
            <div
              style={{
                position: "absolute",
                bottom: -3,
                left: "50%",
                marginLeft: -3,
                width: 6,
                height: 6,
                background: "#0a1230",
                transform: "rotate(45deg)",
                borderRight: `0.5px solid ${T.hairlineStrong}`,
                borderBottom: `0.5px solid ${T.hairlineStrong}`,
              }}
            />
          </div>
        );
      })()}
    </div>
  );
}

export function WeeklyPerformanceCard({
  accent = PraxiaTokens.accent,
  values,
  labels,
  activeIdx,
}: WeeklyPerformanceCardProps) {
  const T = PraxiaTokens;

  // Variação semanal (primeiro vs último).
  const first = values[0] || 0;
  const last = values[values.length - 1] || 0;
  const weekPct = first > 0 ? ((last - first) / first) * 100 : 0;
  const positive = weekPct >= 0;

  // Variação versus a "semana anterior" — comparada à média da primeira metade.
  const prevAvg =
    values.slice(0, Math.floor(values.length / 2)).reduce((a, b) => a + b, 0) /
      Math.max(1, Math.floor(values.length / 2)) || 1;
  const currAvg =
    values
      .slice(Math.floor(values.length / 2))
      .reduce((a, b) => a + b, 0) /
      Math.max(1, values.length - Math.floor(values.length / 2)) || 1;
  const ppDelta = prevAvg > 0 ? ((currAvg - prevAvg) / prevAvg) * 100 : 0;

  return (
    <PraxiaCard
      padding={18}
      style={{
        background: "linear-gradient(160deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            flexShrink: 0,
            background: "rgba(255,255,255,0.06)",
            border: `0.5px solid ${T.hairline}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: accent,
          }}
        >
          <Icon.trend size={16} color={accent} />
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: T.display,
              fontSize: 18,
              fontWeight: 600,
              color: T.ink,
              letterSpacing: -0.3,
            }}
          >
            Performance semanal
          </div>
          <div style={{ fontFamily: T.body, fontSize: 12, color: T.ink50, marginTop: 2 }}>
            Acompanhe seu rendimento dia a dia.
          </div>
        </div>
        <StatusTag
          color={positive ? "rgba(66,232,163,0.18)" : "rgba(255,107,129,0.18)"}
          text={positive ? T.up : T.down}
        >
          Semana ▾
        </StatusTag>
      </div>

      <div style={{ marginTop: 14, display: "flex", alignItems: "flex-end", gap: 16 }}>
        <div style={{ paddingBottom: 36 }}>
          <div
            style={{
              fontFamily: T.display,
              fontSize: 36,
              fontWeight: 600,
              color: T.ink,
              letterSpacing: -1.2,
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {positive ? "+" : ""}
            {weekPct.toFixed(1)}%
          </div>
          <div
            style={{
              marginTop: 6,
              fontFamily: T.body,
              fontSize: 11.5,
              color: T.ink50,
              maxWidth: 110,
              lineHeight: 1.35,
            }}
          >
            {ppDelta >= 0 ? "Esta semana superou a anterior em " : "Esta semana ficou abaixo da anterior em "}
            <b style={{ color: ppDelta >= 0 ? T.up : T.down }}>{Math.abs(ppDelta).toFixed(1)}pp</b>.
          </div>
        </div>
        <div style={{ flex: 1, marginRight: -8 }}>
          <BarWeekChart
            values={values}
            labels={labels}
            activeIdx={activeIdx}
            color={accent}
            w={186}
            h={130}
          />
        </div>
      </div>
    </PraxiaCard>
  );
}
