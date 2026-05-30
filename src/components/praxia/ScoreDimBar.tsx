import { PraxiaTokens } from "./tokens";

/** Barra de uma dimensão do score (pts/max + barra + detalhe). Reusada em ações e FIIs. */
export function ScoreDimBar({ label, pts, max, detail, accent }: {
  label: string; pts: number; max: number; detail: string; accent: string;
}) {
  const T = PraxiaTokens;
  const pct = max > 0 ? Math.round((pts / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 3,
        }}
      >
        <div
          style={{ fontFamily: T.body, fontSize: 11, color: T.ink70, fontWeight: 500 }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: T.mono,
            fontSize: 10,
            color: pts === max ? T.up : pts > 0 ? T.warn : T.ink30,
            fontWeight: 600,
          }}
        >
          {pts}/{max} pts
        </div>
      </div>
      <div
        style={{
          height: 4,
          borderRadius: 3,
          background: T.hairline,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: 3,
            background: pts === max ? T.up : pts > 0 ? accent : T.down,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <div
        style={{
          marginTop: 2,
          fontFamily: T.mono,
          fontSize: 9,
          color: T.ink30,
          letterSpacing: 0.2,
        }}
      >
        {detail}
      </div>
    </div>
  );
}
