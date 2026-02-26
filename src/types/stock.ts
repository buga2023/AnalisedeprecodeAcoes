export interface ScoreBreakdown {
  priceScore: number;         // 0 ou 25
  profitabilityScore: number; // 0, 10, 15 ou 20
  healthScore: number;        // 0, 10, 15 ou 20
  dividendScore: number;      // 0, 10 ou 20
  valuationScore: number;     // 0–15 combinado P/L + EV/EBITDA
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
  pl: number;
  pvp: number;
  dividendYield: number;
  evEbitda: number;
  netMargin: number;
  ebitdaMargin: number;
}
