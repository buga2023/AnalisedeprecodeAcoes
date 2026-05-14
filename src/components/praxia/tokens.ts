export const PraxiaTokens = {
  bg: "#05071a",
  bgDeep: "#020314",
  surface: "#0d1330",
  surface2: "#161e44",
  surfaceInk: "rgba(255,255,255,0.04)",
  hairline: "rgba(255,255,255,0.08)",
  hairlineStrong: "rgba(255,255,255,0.14)",

  ink: "#ffffff",
  ink70: "rgba(255,255,255,0.72)",
  ink50: "rgba(255,255,255,0.52)",
  ink30: "rgba(255,255,255,0.32)",

  up: "#42e8a3",
  down: "#ff6b81",
  warn: "#ffc857",

  accent: "#5b7cff",
  accentSoft: "rgba(91,124,255,0.18)",
  accentGlow: "rgba(91,124,255,0.45)",

  display: '"Sora", system-ui, sans-serif',
  body: '"Manrope", system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
} as const;

export type PraxiaTokensType = typeof PraxiaTokens;

export const ACCENT_OPTIONS = [
  { value: "#5b7cff", label: "Elétrico" },
  { value: "#42e8a3", label: "Verde" },
  { value: "#a78bfa", label: "Roxo" },
  { value: "#ff8a4d", label: "Laranja" },
  { value: "#f3b94d", label: "Âmbar" },
] as const;

export const fmt = {
  /** R$ currency, pt-BR locale */
  brl: (n: number) =>
    n.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  /** Plain number with pt-BR thousands separators */
  num: (n: number) => n.toLocaleString("pt-BR"),
  /** Signed percentage with 2 decimals */
  pct: (n: number) => (n >= 0 ? "+" : "") + n.toFixed(2) + "%",
  /** Compact number for axis labels (e.g. 1.2K, 4.3M) */
  compact: (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1e9) return (n / 1e9).toFixed(1) + "B";
    if (abs >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (abs >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return n.toFixed(0);
  },
};

/**
 * Deterministic pseudo-random series for sparklines/area charts.
 * Used as a graceful fallback when real history isn't available yet.
 */
export function genSeries(
  seed: number,
  n = 60,
  base = 100,
  vol = 0.022,
  trend = 0.001,
): number[] {
  let v = base;
  const arr: number[] = [];
  let s = seed * 9301;
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280 - 0.5;
    v = Math.max(1, v * (1 + r * vol + trend));
    arr.push(v);
  }
  return arr;
}

/**
 * Smooth Catmull-Rom -> Bezier path generator for sparklines & area charts.
 * Returns the SVG path string `d`.
 */
export function smoothPath(values: number[], w: number, h: number, pad = 4): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = (w - pad * 2) / (values.length - 1);
  const pts = values.map(
    (v, i): [number, number] => [pad + i * stepX, pad + (1 - (v - min) / range) * (h - pad * 2)],
  );
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}
