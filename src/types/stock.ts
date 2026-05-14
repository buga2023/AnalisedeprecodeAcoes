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
  /** Return on Invested Capital — fração (0.12 = 12%) */
  roic?: number;
  /** Graham & Valuation metrics */
  grahamValue?: number;
  marginOfSafety?: number;
  /** Praxia UI metadata */
  name?: string;
  market?: MarketType;
  sector?: string;
  /** brand color used in the StockAvatar disc */
  brandColor?: string;
  /**
   * Marca quais campos vieram de fallback via IA (quando Yahoo retorna zerado).
   * `fields` lista os campos do Stock que foram preenchidos pela IA; `geradoEm`
   * é o timestamp; `referencias` mapeia cada campo a uma frase descrevendo a fonte
   * (ex.: "Release 3T24 PETR4"). UI deve mostrar badge "IA" nesses campos.
   */
  aiEstimated?: {
    fields: string[];
    geradoEm: string;
    referencias: Record<string, string>;
    confianca: Record<string, "alta" | "media" | "baixa">;
    fontes: string[];
    aviso: string;
  };
}

export interface Relatorio {
  ticker: string;
  periodo: string;
  dataFim: string;
  lucroLiquido: number;
  receita: number;
  resultado: 'positivo' | 'negativo';
  /** Quando true, o item foi estimado/projetado pela IA, não é dado oficial. */
  aiEstimated?: boolean;
  /** "real" = relatório oficial; "projecao" = projeção da IA. */
  tipo?: 'real' | 'projecao';
  /** Referência/fonte (ex.: "Release oficial PETR4 31/10/2024" ou "Projeção IA"). */
  referencia?: string;
  /** Comentário curto sobre o trimestre (gerado pela IA quando disponível). */
  comentario?: string;
  /** EBITDA absoluto, quando reportado. */
  ebitda?: number;
  /** Margem líquida do período (fração 0–1). */
  margem?: number;
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

/* ─── Praxia: price alerts ──────────────────────────────────────────────── */
export type AlertType = 'price-above' | 'price-below' | 'graham-margin' | 'change-drop';

export interface PriceAlert {
  id: string;
  ticker: string;
  type: AlertType;
  /** value semantics depends on type: price (R$), margin (%), drop (%) */
  value: number;
  note?: string;
  createdAt: string;
  triggeredAt?: string;
  triggerPrice?: number;
}

/* ─── Praxia: chat history with Pra ─────────────────────────────────────── */
export type ChatRole = 'user' | 'pra';

export interface ChatMessage {
  role: ChatRole;
  text: string;
  timestamp: string;
}
