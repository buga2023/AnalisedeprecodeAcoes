import { PraxiaTokens, fmt } from "./tokens";
import { PraxiaCard } from "./PraxiaCard";
import type { Stock } from "@/types/stock";
import { calculateFIIScore, getFIIScoreLabel, estimateMonthlyYield } from "@/lib/fiiScore";

interface FIIDetailStatsProps {
  stock: Stock;
  accent?: string;
}

interface StatCellProps {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  accent?: string;
}

function StatCell({ label, value, sub, highlight, accent }: StatCellProps) {
  const T = PraxiaTokens;
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 10,
        background: highlight ? `${accent ?? T.gold}12` : "rgba(255,255,255,0.04)",
        border: `0.5px solid ${highlight ? (accent ?? T.gold) + "44" : T.hairline}`,
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.ink30, letterSpacing: 0.6, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontFamily: T.mono, fontSize: 16, fontWeight: 700, color: highlight ? (accent ?? T.gold) : T.ink }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: T.body, fontSize: 11, color: T.ink50 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export function FIIDetailStats({ stock, accent = PraxiaTokens.gold }: FIIDetailStatsProps) {
  const T = PraxiaTokens;
  const { dividendYield, pvp, sector, price, score } = stock;

  const { breakdown } = calculateFIIScore({
    dividendYield,
    pvp,
    segment: sector,
  });

  const monthlyYield = estimateMonthlyYield(dividendYield, price);
  const dyPct = dividendYield * 100;
  const scoreLabel = getFIIScoreLabel(score);
  const scoreColor = score >= 80 ? T.up : score >= 55 ? T.gold : T.down;

  return (
    <PraxiaCard padding={16} style={{ marginTop: 12 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontFamily: T.display, fontSize: 14, fontWeight: 600, color: T.ink }}>
          Métricas FII
        </div>
        <div
          style={{
            padding: "3px 10px",
            borderRadius: 999,
            background: `${scoreColor}1a`,
            border: `0.5px solid ${scoreColor}55`,
            fontFamily: T.mono,
            fontSize: 11,
            fontWeight: 700,
            color: scoreColor,
          }}
        >
          {score} · {scoreLabel}
        </div>
      </div>

      {/* Stats grid 2×2 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        <StatCell
          label="DY Anual"
          value={fmt.pct(dyPct / 100)}
          sub={`~${fmt.brl(monthlyYield)}/cota/mês`}
          highlight
          accent={accent}
        />
        <StatCell
          label="P/VP"
          value={pvp > 0 ? pvp.toFixed(2) : "—"}
          sub={pvp > 0 && pvp < 1 ? "Abaixo do patrimonial" : pvp > 1 ? "Acima do patrimonial" : undefined}
        />
        <StatCell
          label="Segmento"
          value={sector && sector !== "—" ? sector : "FII"}
        />
        <StatCell
          label="Preço / cota"
          value={fmt.brl(price)}
          sub={`Variação ${stock.changePercent >= 0 ? "+" : ""}${fmt.pct(stock.changePercent / 100)}`}
        />
      </div>

      {/* Score breakdown bars */}
      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.ink30, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8 }}>
        Composição do Score
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <ScoreBar label="DY" pts={breakdown.dyScore} max={40} accent={accent} />
        <ScoreBar label="P/VP" pts={breakdown.pvpScore} max={30} accent={T.ink50} />
        <ScoreBar label="Segmento" pts={breakdown.segmentScore} max={15} accent={T.ink50} />
        <ScoreBar label="Liquidez" pts={breakdown.liquidityScore} max={15} accent={T.ink30} note="heurística" />
      </div>

      <div
        style={{
          marginTop: 12,
          fontFamily: T.body,
          fontSize: 11,
          color: T.ink30,
          lineHeight: 1.4,
        }}
      >
        Score FII usa DY, P/VP e segmento. Vacância e dados de gestora indisponíveis no Yahoo Finance.
      </div>
    </PraxiaCard>
  );
}

function ScoreBar({
  label,
  pts,
  max,
  accent,
  note,
}: {
  label: string;
  pts: number;
  max: number;
  accent: string;
  note?: string;
}) {
  const T = PraxiaTokens;
  const pct = max > 0 ? (pts / max) * 100 : 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 60, fontFamily: T.body, fontSize: 11.5, color: T.ink70, flexShrink: 0 }}>
        {label}
      </div>
      <div
        style={{
          flex: 1,
          height: 5,
          borderRadius: 999,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: accent,
            borderRadius: 999,
            transition: "width 0.5s ease",
          }}
        />
      </div>
      <div style={{ width: 38, textAlign: "right", fontFamily: T.mono, fontSize: 11, color: T.ink50, flexShrink: 0 }}>
        {pts}/{max}
      </div>
      {note && (
        <div style={{ fontFamily: T.body, fontSize: 10, color: T.ink30, flexShrink: 0 }}>
          {note}
        </div>
      )}
    </div>
  );
}
