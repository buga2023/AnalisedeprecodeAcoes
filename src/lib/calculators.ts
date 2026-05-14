/**
 * Lógica de Negócio (Engine) - Calculadoras Fundamentalistas StockGuardian
 */

import type { ScoreBreakdown, ScoreLabel, CSVRow, ValuationRow } from "@/types/stock";

/**
 * Cálculo do Valor Intrínseco de Graham (Original)
 * Fórmula: VI = sqrt(22,5 * LPA * VPA)
 */
export const calculateGrahamValue = (lpa: number, vpa: number): number => {
  if (lpa <= 0 || vpa <= 0) return 0;
  return Math.sqrt(22.5 * lpa * vpa);
};

/**
 * Bazin: Preço Teto = DPA / 0,06
 * Retorna null se dpa <= 0
 */
export const calculateBazinCeiling = (dpa: number | null): number | null => {
  if (dpa === null || dpa <= 0) return null;
  return dpa / 0.06;
};

/**
 * Graham Tradicional: VI = √(22,5 × LPA × VPA)
 */
export const calculateGrahamVI = (
  eps: number | null,
  bvps: number | null
): number | null => {
  if (eps === null || bvps === null || eps <= 0 || bvps <= 0) return null;
  return Math.sqrt(22.5 * eps * bvps);
};

/**
 * Graham Crescimento: VI = LPA × (8,5 + 2g)
 * g default = 7 (crescimento médio conservador para mercado BR)
 */
export const calculateGrahamGrowth = (
  eps: number | null,
  growthRate: number = 7
): number | null => {
  if (eps === null || eps <= 0) return null;
  return eps * (8.5 + 2 * growthRate);
};

/**
 * Margem de segurança: ((valor - preço) / valor) × 100
 */
export const calculateMargin = (
  fairValue: number | null,
  currentPrice: number | null
): number | null => {
  if (fairValue === null || currentPrice === null || fairValue === 0) return null;
  return ((fairValue - currentPrice) / fairValue) * 100;
};

/**
 * Sinal baseado na margem
 */
export const getSignal = (margin: number | null): 'Comprar' | 'Caro' | 'Sem dados' => {
  if (margin === null) return 'Sem dados';
  return margin > 0 ? 'Comprar' : 'Caro';
};

/**
 * Função principal que monta o ValuationRow completo
 */
export function calculateFullValuation(
  row: CSVRow,
  currentPrice: number | null,
  growthRate: number = 7
): ValuationRow {
  const bazinCeiling = calculateBazinCeiling(row.dpa);
  const bazinMargin = calculateMargin(bazinCeiling, currentPrice);
  
  const grahamVI = calculateGrahamVI(row.eps, row.bvps);
  const grahamMargin = calculateMargin(grahamVI, currentPrice);
  
  const grahamGrowth = calculateGrahamGrowth(row.eps, growthRate);
  const grahamGrowthMargin = calculateMargin(grahamGrowth, currentPrice);
  
  const roi = (currentPrice && row.avgCost > 0) 
    ? ((currentPrice - row.avgCost) / row.avgCost) * 100 
    : null;
    
  const patrimony = (currentPrice && row.quantity) 
    ? currentPrice * row.quantity 
    : null;

  return {
    ...row,
    currentPrice,
    bazinCeiling,
    bazinSignal: getSignal(bazinMargin),
    bazinMargin,
    grahamVI,
    grahamSignal: getSignal(grahamMargin),
    grahamMargin,
    grahamGrowth,
    grahamGrowthSignal: getSignal(grahamGrowthMargin),
    grahamGrowthMargin,
    roi,
    patrimony,
    fetchStatus: currentPrice ? 'success' : 'loading',
  };
}

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
 * ROIC — Return on Invested Capital. Mede o retorno sobre o capital total
 * investido (próprio + terceiros), aproximado a partir dos campos do Yahoo
 * Finance disponíveis no `/api/brapi` proxy.
 *
 * Fórmula pragmática (graceful degradation):
 *   ROIC ≈ NOPAT / (Dívida total + Patrimônio Líquido)
 *   NOPAT ≈ EBIT × (1 − 0,34)              (alíquota efetiva BR ≈ 34%)
 *   EBIT  ≈ EBITDA × 0,75                  (assume D&A ≈ 25% do EBITDA)
 *   PL    ≈ Dívida total / (Dívida/PL)     (deriva do múltiplo D/E)
 *
 * Retorna fração (0,12 = 12%) ou 0 quando faltam dados. Limita a [-1, 1]
 * para evitar valores absurdos vindos de divisões por números pequenos.
 */
export const calculateROIC = (
  ebitda: number,
  totalDebt: number,
  debtToEquity: number,
  taxRate = 0.34,
  daRatio = 0.25
): number => {
  if (ebitda <= 0) return 0;
  if (totalDebt <= 0 && debtToEquity <= 0) return 0;

  const ebit = ebitda * (1 - daRatio);
  const nopat = ebit * (1 - taxRate);

  // Yahoo's debtToEquity geralmente vem em percentual (75 = 75%); normalizamos.
  const de = debtToEquity > 5 ? debtToEquity / 100 : debtToEquity;
  let equity = 0;
  if (de > 0 && totalDebt > 0) equity = totalDebt / de;

  const investedCapital = totalDebt + equity;
  if (investedCapital <= 0) return 0;

  const roic = nopat / investedCapital;
  if (!Number.isFinite(roic)) return 0;
  return Math.max(-1, Math.min(1, roic));
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
  return ((intrinsicValue - currentPrice) / intrinsicValue) * 100;
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
