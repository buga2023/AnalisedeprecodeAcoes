import { PraxiaTokens, fmt } from "./tokens";
import { PraxiaCard } from "./PraxiaCard";
import { Icon } from "./Icon";
import type { PortfolioScoreBreakdown } from "@/lib/portfolioScore";

interface PortfolioScoreHeroProps {
  score: PortfolioScoreBreakdown;
  totalValue: number;
  todayChange: number;
  todayPct: number;
  accent?: string;
}

export function PortfolioScoreHero({
  score,
  totalValue,
  todayChange,
  todayPct,
  accent = PraxiaTokens.accent,
}: PortfolioScoreHeroProps) {
  const T = PraxiaTokens;
  const rounded = Math.round(score.total);
  const color = rounded >= 70 ? T.up : rounded >= 50 ? T.warn : T.down;

  return (
    <PraxiaCard
      raised
      padding={18}
      style={{
        background: `
          radial-gradient(120% 90% at 80% -10%, ${accent}2b 0%, transparent 58%),
          linear-gradient(160deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.015) 100%)
        `,
        border: `0.5px solid ${T.hairlineStrong}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            border: `1px solid ${color}88`,
            background: `radial-gradient(circle at 50% 50%, ${color}20 0%, transparent 66%)`,
            display: "grid",
            placeItems: "center",
            boxShadow: `0 12px 28px ${color}18`,
            flexShrink: 0,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontFamily: T.display,
                color,
                fontSize: 32,
                fontWeight: 600,
                lineHeight: 0.95,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {rounded}
            </div>
            <div style={{ fontFamily: T.mono, color: T.ink50, fontSize: 9 }}>
              /100
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: T.displaySC,
              fontSize: 11,
              letterSpacing: 1.2,
              color: T.ink50,
              textTransform: "uppercase",
            }}
          >
            <Icon.shield size={14} color={accent} />
            Saúde da carteira
          </div>
          <div
            style={{
              marginTop: 6,
              fontFamily: T.display,
              fontSize: 21,
              fontWeight: 600,
              color: T.ink,
              letterSpacing: -0.3,
            }}
          >
            {scoreLabel(rounded)}
          </div>
          <div
            style={{
              marginTop: 4,
              fontFamily: T.body,
              fontSize: 12.5,
              lineHeight: 1.45,
              color: T.ink70,
            }}
          >
            Score ponderado por valor investido, com bônus de diversificação e penalidade por concentração setorial.
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Metric label="Patrimônio" value={fmt.brl(totalValue)} />
        <Metric
          label="Hoje"
          value={`${todayChange >= 0 ? "+" : "-"}${fmt.brl(Math.abs(todayChange))}`}
          sub={fmt.pct(todayPct)}
          color={todayChange >= 0 ? T.up : T.down}
        />
      </div>

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        <ScoreBar label="Qualidade dos ativos" value={score.base * 0.7} max={70} color={accent} />
        <ScoreBar label="Diversificação" value={score.diversification} max={30} color={T.up} />
        <ScoreBar label="Penalidade concentração" value={score.overweightPenalty} max={30} color={T.down} inverse />
      </div>
    </PraxiaCard>
  );
}

function scoreLabel(score: number): string {
  if (score >= 70) return "Carteira saudável";
  if (score >= 50) return "Em desenvolvimento";
  return "Necessita atenção";
}

function Metric({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  const T = PraxiaTokens;
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 14,
        border: `0.5px solid ${T.hairline}`,
        background: "rgba(255,255,255,0.035)",
      }}
    >
      <div style={{ fontFamily: T.body, fontSize: 10.5, color: T.ink50 }}>{label}</div>
      <div
        style={{
          marginTop: 3,
          fontFamily: T.mono,
          fontSize: 13,
          fontWeight: 600,
          color: color ?? T.ink,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ marginTop: 2, fontFamily: T.mono, fontSize: 10, color: color ?? T.ink50 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function ScoreBar({
  label,
  value,
  max,
  color,
  inverse = false,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  inverse?: boolean;
}) {
  const T = PraxiaTokens;
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: T.body, fontSize: 11.5, color: T.ink70 }}>{label}</span>
        <span style={{ fontFamily: T.mono, fontSize: 10.5, color: inverse ? T.down : T.ink50 }}>
          {inverse ? "-" : "+"}
          {value.toFixed(1)}
        </span>
      </div>
      <div style={{ height: 5, borderRadius: 4, overflow: "hidden", background: T.hairline }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: 4,
            background: color,
          }}
        />
      </div>
    </div>
  );
}
