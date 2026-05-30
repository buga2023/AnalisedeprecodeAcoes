/**
 * Scoring de FIIs (Fase 8) — fórmula própria, sem Graham/ROE.
 * Pesos: DY 40 · P/VP 30 · Vacância 15 · Segmento 15.
 * Dimensão sem dado (vacância não scrapeada, DY/P-VP ausentes) é OMITIDA e o
 * score renormaliza sobre os pesos disponíveis → escala /100.
 * Mapeia ScoreBreakdown: dividendScore=DY, valuationScore=P/VP, healthScore=vacância,
 * profitabilityScore=segmento, priceScore=0.
 */
import type { ScoreBreakdown } from "@/types/stock";

export interface FIIScoreInput {
  /** DY anual em % (ex.: 9.2). <=0 = sem dado. */
  dividendYield: number;
  /** Preço / VPA. <=0 = sem dado. */
  pvp: number;
  /** Vacância em %. undefined = sem dado. */
  vacancyRate?: number;
  /** Segmento de detectFIISegment. */
  segment?: string;
}

const RESILIENT = new Set(["Logística", "Papel/Recebíveis", "Renda Urbana"]);
const CYCLICAL = new Set(["Shopping", "Lajes Corporativas", "Lajes/Híbrido", "Híbrido"]);

export function calculateFIIScore(input: FIIScoreInput): { total: number; breakdown: ScoreBreakdown } {
  const { dividendYield, pvp, vacancyRate, segment } = input;

  const dyPresent = dividendYield > 0;
  let dyPts = 0;
  if (dividendYield > 8) dyPts = 40;
  else if (dividendYield >= 6) dyPts = 30;
  else if (dividendYield >= 4) dyPts = 18;
  else if (dividendYield > 0) dyPts = Math.round((dividendYield / 4) * 18);

  const pvpPresent = pvp > 0;
  let pvpPts = 0;
  if (pvp > 0 && pvp <= 0.95) pvpPts = 30;
  else if (pvp > 0 && pvp <= 1.05) pvpPts = 22;
  else if (pvp > 0 && pvp <= 1.15) pvpPts = 12;
  else if (pvp > 0) pvpPts = 4;

  const vacPresent = typeof vacancyRate === "number";
  let vacPts = 0;
  if (vacPresent) {
    const v = vacancyRate as number;
    if (v < 5) vacPts = 15;
    else if (v < 10) vacPts = 10;
    else if (v < 15) vacPts = 5;
    else vacPts = 0;
  }

  let segPts = 8;
  if (segment && RESILIENT.has(segment)) segPts = 15;
  else if (segment && CYCLICAL.has(segment)) segPts = 10;

  const dims = [
    { pts: dyPts, weight: 40, present: dyPresent },
    { pts: pvpPts, weight: 30, present: pvpPresent },
    { pts: vacPts, weight: 15, present: vacPresent },
    { pts: segPts, weight: 15, present: true },
  ];
  const availWeight = dims.reduce((s, d) => s + (d.present ? d.weight : 0), 0);
  const sumPts = dims.reduce((s, d) => s + (d.present ? d.pts : 0), 0);
  const total = availWeight > 0 ? Math.round((sumPts / availWeight) * 100) : 0;

  return {
    total,
    breakdown: { priceScore: 0, profitabilityScore: segPts, healthScore: vacPts, dividendScore: dyPts, valuationScore: pvpPts },
  };
}
