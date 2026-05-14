export interface ScoreBreakdown {
  priceScore: number;
  profitabilityScore: number;
  healthScore: number;
  dividendScore: number;
  valuationScore: number;
}

export type ScoreLabel = 'Compra Forte' | 'Observação' | 'Risco Elevado';

export type MarketType = 'B3' | 'NASDAQ' | 'NYSE' | 'OTHER';

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
  /** Praxia UI metadata */
  name?: string;
  market?: MarketType;
  sector?: string;
  /** brand color used in the StockAvatar disc */
  brandColor?: string;
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

  bazinCeiling: number | null;
  bazinSignal: 'Comprar' | 'Caro' | 'Sem dados';
  bazinMargin: number | null;

  grahamVI: number | null;
  grahamSignal: 'Comprar' | 'Caro' | 'Sem dados';
  grahamMargin: number | null;

  grahamGrowth: number | null;
  grahamGrowthSignal: 'Comprar' | 'Caro' | 'Sem dados';
  grahamGrowthMargin: number | null;

  roi: number | null;
  patrimony: number | null;

  fetchStatus: 'loading' | 'success' | 'error';
  fetchError?: string;
}

/* ─── Praxia: investor profile from onboarding quiz ─────────────────────── */
export type RiskTolerance = 'low' | 'mid' | 'high';
export type InvestmentHorizon = 'short' | 'mid' | 'long';
export type Interest = 'div' | 'gro' | 'esg' | 'tec';

export interface InvestorProfile {
  risk: RiskTolerance;
  horizon: InvestmentHorizon;
  interests: Interest[];
  completedAt: string;
}

/* ─── Praxia: paper-trading transactions ────────────────────────────────── */
export type TransactionType = 'buy' | 'sell';
export type OrderType = 'Mercado' | 'Limite' | 'Stop';

export interface Transaction {
  id: string;
  ticker: string;
  type: TransactionType;
  orderType: OrderType;
  shares: number;
  price: number;
  total: number;
  fee: number;
  timestamp: string;
}

/* ─── Praxia: chat history with Pra ─────────────────────────────────────── */
export type ChatRole = 'user' | 'pra';

export interface ChatMessage {
  role: ChatRole;
  text: string;
  timestamp: string;
}
