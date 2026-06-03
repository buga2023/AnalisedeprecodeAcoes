/**
 * Score 0–100 para FIIs (Fundos Imobiliários).
 * Graham não se aplica a FIIs — fórmula própria baseada em:
 *   DY anual   40 pts
 *   P/VP       30 pts
 *   Segmento   15 pts  (heurística pela categoria)
 *   Liquidez   15 pts  (graceful degradation — sem dado: 8 pts neutro)
 */

import type { ScoreBreakdown } from "@/types/stock";

export interface FIIScoreInput {
  dividendYield: number;   // fração Yahoo (0.10 = 10%)
  pvp: number;             // Preço / Valor Patrimonial
  segment?: string;        // "Logística", "Shopping", "Recebíveis", etc.
}

export interface FIIScoreBreakdown {
  dyScore: number;         // max 40
  pvpScore: number;        // max 30
  segmentScore: number;    // max 15
  liquidityScore: number;  // max 15
}

// Segmentos premium → maior estabilidade e liquidez historicamente.
const PREMIUM_SEGMENTS = new Set(["Logística", "Lajes Corp.", "Shopping"]);
const PAPER_SEGMENTS = new Set(["Recebíveis", "Papel"]);

function segmentScore(segment?: string): number {
  if (!segment) return 8;
  if (PREMIUM_SEGMENTS.has(segment)) return 15;
  if (PAPER_SEGMENTS.has(segment)) return 10;
  if (segment === "FII") return 8;
  return 8;
}

export function calculateFIIScore(input: FIIScoreInput): {
  total: number;
  breakdown: FIIScoreBreakdown;
  stockBreakdown: ScoreBreakdown;
} {
  const dy = input.dividendYield; // fração (0.10 = 10%)

  // DY anual (40 pts)
  let dyScore = 0;
  if (dy > 0.12) dyScore = 40;
  else if (dy > 0.08) dyScore = 28;
  else if (dy > 0.06) dyScore = 18;
  else if (dy > 0.04) dyScore = 8;

  // P/VP (30 pts) — abaixo do valor patrimonial é melhor
  let pvpScore = 0;
  const pvp = input.pvp;
  if (pvp > 0) {
    if (pvp < 0.90) pvpScore = 30;
    else if (pvp < 1.0) pvpScore = 22;
    else if (pvp < 1.15) pvpScore = 14;
    else if (pvp < 1.30) pvpScore = 6;
  }

  const segScore = segmentScore(input.segment);
  // Liquidez: sem dado concreto do Yahoo → 8 pts neutro (50% do máximo)
  const liquidityScore = 8;

  const total = Math.min(100, dyScore + pvpScore + segScore + liquidityScore);

  const breakdown: FIIScoreBreakdown = {
    dyScore,
    pvpScore,
    segmentScore: segScore,
    liquidityScore,
  };

  // Adapta para o shape ScoreBreakdown usado pelo resto do app
  // (campos de ações — zeramos os que não se aplicam a FIIs).
  const stockBreakdown: ScoreBreakdown = {
    priceScore: pvpScore,         // P/VP representa "preço justo"
    profitabilityScore: dyScore,  // DY é o retorno do FII
    healthScore: segScore,        // qualidade do segmento
    dividendScore: dyScore,       // idem — campo redundante mas compatível
    valuationScore: liquidityScore,
  };

  return { total, breakdown: breakdown, stockBreakdown };
}

/** Label amigável para score FII. */
export function getFIIScoreLabel(score: number): string {
  if (score >= 80) return "Atrativo";
  if (score >= 55) return "Observação";
  return "Avaliar";
}

/** DY mensal estimado = (DY anual × preço) / 12 */
export function estimateMonthlyYield(dividendYield: number, price: number): number {
  if (price <= 0 || dividendYield <= 0) return 0;
  return (dividendYield * price) / 12;
}
