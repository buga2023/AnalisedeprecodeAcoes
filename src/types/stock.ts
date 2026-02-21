export interface ScoreBreakdown {
  priceScore: number;         // 0 ou 40
  profitabilityScore: number; // 0, 15 ou 30
  healthScore: number;        // 0, 15 ou 30
}

export type ScoreLabel = 'Compra Forte' | 'Observação' | 'Risco Elevado';

export interface Stock {
  ticker: string;
  price: number;
  cost: number;
  quantity: number;
  lpa: number;
  vpa: number;
  roe: number;
  debtToEbitda: number;
  change: number;
  changePercent: number;
  lastUpdated: string;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  isFavorite: boolean;
}
