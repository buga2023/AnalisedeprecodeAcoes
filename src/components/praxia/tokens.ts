/**
 * Praxia design tokens — v0 "Engraved" direction.
 *
 * Direção: private banking (BTG) + clareza fintech (XP). Paleta onyx + vellum
 * com dourado discreto como único acento. Tipografia serif (Cormorant/Playfair)
 * como protagonista — tech genérico está fora.
 *
 * Os nomes de tokens (bg, surface, ink, accent, etc.) são mantidos para que
 * todo o código já existente continue funcionando sem refactor — apenas os
 * VALORES mudaram. Tokens novos (gold, vellum, onyx, etc.) ficam disponíveis
 * para usos específicos.
 */
export const PraxiaTokens = {
  // === Surfaces (onyx warm) ==============================================
  /** Fundo principal: near-black com leve calor. */
  bg: "#0a0a10",
  /** Variação levemente mais quente para gradientes radiais. */
  bgDeep: "#06060a",
  /** Sub-superfície com tom marrom escuro (para depth atrás de cards). */
  surface: "#13110d",
  surface2: "#1a1610",
  surfaceInk: "rgba(244,236,223,0.04)",

  // Linhas finas — usadas como divisores e bordas de cards
  hairline: "rgba(244,236,223,0.10)",
  hairlineStrong: "rgba(244,236,223,0.18)",
  /** Régua dourada — companion line abaixo do wordmark */
  rule: "rgba(200,162,92,0.55)",

  // === Ink (texto sobre fundo escuro) — parchment warm white ===============
  ink: "#f4ecdf",
  ink70: "rgba(244,236,223,0.72)",
  ink50: "rgba(244,236,223,0.52)",
  ink30: "rgba(244,236,223,0.30)",

  // === Paper (modo claro / inversão) ======================================
  /** Cream / vellum — usado para backgrounds invertidos */
  paper: "#f1eadb",
  /** Espresso brown-black — texto sobre paper */
  paperInk: "#1a1610",

  // === Semantic (compras/vendas/avisos) ===================================
  // Verde mais maduro (menos neon), vermelho mais terroso, âmbar dourado
  up: "#7fb796",
  down: "#c87371",
  warn: "#c8a25c",

  // === Accent (dourado discreto, alias para os tokens existentes) =========
  /** Champagne gold — único acento do sistema */
  accent: "#c8a25c",
  accentSoft: "rgba(200,162,92,0.18)",
  accentGlow: "rgba(200,162,92,0.40)",
  /** Aliases semânticos para uso explícito */
  gold: "#c8a25c",
  goldDim: "rgba(200,162,92,0.55)",
  goldFaint: "rgba(200,162,92,0.20)",

  // === Tipografia ========================================================
  /** Display: serif premium — Cormorant Garamond. Para títulos e wordmark. */
  display: '"Cormorant Garamond", "EB Garamond", Georgia, serif',
  /** Small-caps serif — Cormorant SC. Para PRAXIA/MENU/seções */
  displaySC: '"Cormorant SC", "Cormorant Garamond", Georgia, serif',
  /** Variação estabelecida — Playfair Display para detalhes. */
  displayAlt: '"Playfair Display", "Cormorant Garamond", Georgia, serif',
  /** Body: Manrope (mantido — funciona bem ao lado de serif) */
  body: '"Manrope", system-ui, sans-serif',
  /** Numérico/metadados: JetBrains Mono (mantido) */
  mono: '"JetBrains Mono", ui-monospace, monospace',
} as const;

export type PraxiaTokensType = typeof PraxiaTokens;

/**
 * Variações de "accent" disponíveis ao usuário. Mantemos a API com 5 opções,
 * mas a paleta agora é toda em tons sóbrios (champagne / brass / brushed)
 * pra não fugir da direção Engraved.
 */
export const ACCENT_OPTIONS = [
  { value: "#c8a25c", label: "Champagne" },
  { value: "#b08846", label: "Brass" },
  { value: "#d4b97e", label: "Vellum" },
  { value: "#a89070", label: "Brushed" },
  { value: "#cf9858", label: "Amber" },
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
