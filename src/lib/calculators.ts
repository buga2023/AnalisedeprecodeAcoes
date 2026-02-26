/**
 * Lógica de Negócio (Engine) - Calculadoras Fundamentalistas StockGuardian
 */

import type { ScoreBreakdown, ScoreLabel } from "@/types/stock";

/**
 * Cálculo do Valor Intrínseco de Graham
 * Fórmula: VI = sqrt(22,5 * LPA * VPA)
 * @param lpa Lucro por Ação
 * @param vpa Valor Patrimonial por Ação
 * @returns Valor Intrínseco estimado
 */
export const calculateGrahamValue = (lpa: number, vpa: number): number => {
  if (lpa <= 0 || vpa <= 0) return 0;
  return Math.sqrt(22.5 * lpa * vpa);
};

/**
 * Cálculo de Performance (ROI)
 * Fórmula: ROI = (Preço Atual / Preço de Custo) - 1
 * @param currentPrice Preço atual do ativo
 * @param costPrice Preço médio de compra
 * @returns Variação percentual
 */
export const calculateROI = (currentPrice: number, costPrice: number): number => {
  if (costPrice <= 0) return 0;
  return (currentPrice / costPrice) - 1;
};

/**
 * Cálculo da Margem de Segurança
 * Diferença percentual entre o preço atual e o valor intrínseco
 * @param currentPrice Preço atual do ativo
 * @param intrinsicValue Valor Intrínseco de Graham
 * @returns Percentual de margem (positivo = desconto, negativo = sobrepreço)
 */
export const calculateMarginOfSafety = (currentPrice: number, intrinsicValue: number): number => {
  if (intrinsicValue <= 0) return 0;
  return (intrinsicValue - currentPrice) / intrinsicValue;
};

/**
 * Determina se o ativo está subvalorizado ou sobrevalorizado com base no preço e VI
 * @param price Preço atual
 * @param intrinsicValue Valor Intrínseco
 * @returns Status: 'Subvalorizada' | 'Sobrevalorizada' | 'Justo'
 */
export const getValuationStatus = (price: number, intrinsicValue: number): 'Subvalorizada' | 'Sobrevalorizada' | 'Justo' => {
  if (intrinsicValue <= 0) return 'Justo';
  const margin = (intrinsicValue - price) / intrinsicValue;
  
  if (margin > 0.1) return 'Subvalorizada'; // Mais de 10% de desconto
  if (margin < -0.1) return 'Sobrevalorizada'; // Mais de 10% de ágio
  return 'Justo';
};

/**
 * Sistema de Score StockGuardian (0 a 100 pontos)
 *
 * - Graham Price (25 pts): preço < valor intrínseco
 * - ROE (20 pts): >20%=20 / 15-20%=15 / 10-15%=10 / <10%=0
 * - Dívida/EBITDA (20 pts): <1.5=20 / 1.5-2=15 / 2-3=10 / >3=0
 * - Dividend Yield (20 pts): >6%=20 / 4-6%=10 / <4%=0
 * - P/L (8 pts): 0-10=8 / 10-20=5 / 20-30=2 / resto=0
 * - EV/EBITDA (7 pts): <6=7 / 6-12=4 / 12-20=1 / resto=0
 */
export interface ScoreInput {
  price: number;
  grahamValue: number;
  roe: number;          // ex: 0.15 = 15%
  debtToEbitda: number; // ex: 1.5
  dividendYield: number; // ex: 0.06 = 6%
  pl: number;
  evEbitda: number;
}

export const calculateStockScore = (input: ScoreInput): { total: number; breakdown: ScoreBreakdown } => {
  const { price, grahamValue, roe, debtToEbitda, dividendYield, pl, evEbitda } = input;

  // Graham Price (25 pts)
  const priceScore = (grahamValue > 0 && price < grahamValue) ? 25 : 0;

  // Rentabilidade / ROE (20 pts)
  let profitabilityScore = 0;
  if (roe > 0.20) {
    profitabilityScore = 20;
  } else if (roe >= 0.15) {
    profitabilityScore = 15;
  } else if (roe >= 0.10) {
    profitabilityScore = 10;
  }

  // Saúde Financeira / Dívida/EBITDA (20 pts)
  let healthScore = 0;
  if (debtToEbitda >= 0 && debtToEbitda < 1.5) {
    healthScore = 20;
  } else if (debtToEbitda < 2.0) {
    healthScore = 15;
  } else if (debtToEbitda <= 3.0) {
    healthScore = 10;
  }

  // Dividend Yield (20 pts)
  let dividendScore = 0;
  if (dividendYield > 0.06) {
    dividendScore = 20;
  } else if (dividendYield >= 0.04) {
    dividendScore = 10;
  }

  // P/L (8 pts) + EV/EBITDA (7 pts) = valuationScore (15 pts)
  let plScore = 0;
  if (pl > 0 && pl <= 10) {
    plScore = 8;
  } else if (pl <= 20) {
    plScore = 5;
  } else if (pl <= 30) {
    plScore = 2;
  }

  let evEbitdaScore = 0;
  if (evEbitda > 0 && evEbitda < 6) {
    evEbitdaScore = 7;
  } else if (evEbitda < 12) {
    evEbitdaScore = 4;
  } else if (evEbitda < 20) {
    evEbitdaScore = 1;
  }

  const valuationScore = plScore + evEbitdaScore;
  const total = priceScore + profitabilityScore + healthScore + dividendScore + valuationScore;

  return {
    total,
    breakdown: { priceScore, profitabilityScore, healthScore, dividendScore, valuationScore },
  };
};

/**
 * Retorna o label de classificação baseado no score
 * > 80: "Compra Forte" | >=50: "Observação" | < 50: "Risco Elevado"
 */
export const getScoreLabel = (score: number): ScoreLabel => {
  if (score > 80) return 'Compra Forte';
  if (score >= 50) return 'Observação';
  return 'Risco Elevado';
};
