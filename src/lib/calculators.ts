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
 * - Preço (40 pts): Preço Atual < Valor Intrínseco de Graham
 * - Rentabilidade (30 pts): ROE > 15% = 30pts | 10%-15% = 15pts
 * - Saúde Financeira (30 pts): Dívida/EBITDA < 2.0 = 30pts | 2.0-3.0 = 15pts
 */
export interface ScoreInput {
  price: number;
  grahamValue: number;
  roe: number;          // ex: 0.15 = 15%
  debtToEbitda: number; // ex: 1.5
}

export const calculateStockScore = (input: ScoreInput): { total: number; breakdown: ScoreBreakdown } => {
  const { price, grahamValue, roe, debtToEbitda } = input;

  // Preço (40 pts): preço abaixo do valor intrínseco
  const priceScore = (grahamValue > 0 && price < grahamValue) ? 40 : 0;

  // Rentabilidade (30 pts): baseado no ROE
  let profitabilityScore = 0;
  if (roe > 0.15) {
    profitabilityScore = 30;
  } else if (roe >= 0.10) {
    profitabilityScore = 15;
  }

  // Saúde Financeira (30 pts): baseado em Dívida/EBITDA
  let healthScore = 0;
  if (debtToEbitda >= 0 && debtToEbitda < 2.0) {
    healthScore = 30;
  } else if (debtToEbitda >= 2.0 && debtToEbitda <= 3.0) {
    healthScore = 15;
  }

  const total = priceScore + profitabilityScore + healthScore;

  return {
    total,
    breakdown: { priceScore, profitabilityScore, healthScore },
  };
};

/**
 * Retorna o label de classificação baseado no score
 * > 80: "Compra Forte" | 50-80: "Observação" | < 50: "Risco Elevado"
 */
export const getScoreLabel = (score: number): ScoreLabel => {
  if (score > 80) return 'Compra Forte';
  if (score >= 50) return 'Observação';
  return 'Risco Elevado';
};
