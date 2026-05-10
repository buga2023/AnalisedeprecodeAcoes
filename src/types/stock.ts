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

export interface Relatorio {
  ticker: string;
  periodo: string;
  dataFim: string;
  lucroLiquido: number;
  receita: number;
  resultado: 'positivo' | 'negativo';
}

export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'groq';

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
}

export interface CSVRow {
  ticker: string;
  avgCost: number;
  dpa: number;
  eps: number;
  bvps: number;
  quantity?: number;
}

export interface ValuationRow extends CSVRow {
  currentPrice: number | null;
  
  // Bazin
  bazinCeiling: number | null;
  bazinSignal: 'Comprar' | 'Caro' | 'Sem dados';
  bazinMargin: number | null;
  
  // Graham Tradicional
  grahamVI: number | null;
  grahamSignal: 'Comprar' | 'Caro' | 'Sem dados';
  grahamMargin: number | null;
  
  // Graham com Crescimento
  grahamGrowth: number | null;
  grahamGrowthSignal: 'Comprar' | 'Caro' | 'Sem dados';
  grahamGrowthMargin: number | null;
  
  // Rentabilidade
  roi: number | null;
  patrimony: number | null;
  
  // Meta
  fetchStatus: 'loading' | 'success' | 'error';
  fetchError?: string;
}
