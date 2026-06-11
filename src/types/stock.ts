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
  /** "stock" = ação ordinária/preferencial; "fii" = Fundo Imobiliário B3 */
  assetType?: "stock" | "fii";
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
  /** true quando a venda e compra ocorreram no mesmo dia (day trade). */
  dayTrade?: boolean;
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

/* ─── Praxia: billing (Mercado Pago Subscriptions) ──────────────────────── */

export type Plan = "free" | "pro";

export type SubscriptionStatus =
  | "pending"
  | "active"
  | "paused"
  | "cancelled"
  | "past_due";

export interface Subscription {
  id: string;
  userId: string;
  mpPreapprovalId: string | null;
  plan: "pro";
  status: SubscriptionStatus;
  amountBRL: number;
  startedAt: string | null;
  currentPeriodEnd: string | null;
  cancelledAt: string | null;
}

/** Identificadores estaveis das features que consomem cota. */
export type PaywalledFeature =
  | "ai-analysis"
  | "portfolio-insights"
  | "compare"
  | "digest"
  | "optimize-dividends"
  | "screener"
  | "classify-news"
  | "fundamentals-history";

export interface UsageThisMonth {
  /** Soma de count de TODAS as features no mes corrente (YYYY-MM). */
  total: number;
  /** Map feature -> count. Ausencia = 0. */
  byFeature: Partial<Record<PaywalledFeature, number>>;
  /** Mes referenciado, formato "YYYY-MM" (UTC). */
  month: string;
}

/** Erro lancado pelo client quando uma chamada IA bate o paywall (HTTP 402). */
export interface PaywallRequiredPayload {
  feature: PaywalledFeature;
  currentUsage: number;
  limit: number;
  plan: Plan;
}

/* ─── Praxia: weekly digest (Fase 6) ────────────────────────────────────── */

/**
 * Contexto agregado da semana — entrada para `gerarDigestSemanal`. Todos os
 * campos são derivados de dados REAIS (Yahoo histórico, transações registradas,
 * alertas disparados, cache de notícias materiais). Quando um dado não pode ser
 * obtido com segurança, o campo é `null` ou `[]` — nunca preenchido com fake.
 */
export interface DigestContext {
  /** Chave ISO da semana resumida ("2026-W22"). Cobre a semana anterior. */
  isoWeek: string;
  /** Segunda-feira da semana resumida (ISO date). */
  weekStart: string;
  /** Domingo da semana resumida (ISO date). */
  weekEnd: string;
  /** Variação % da carteira ponderada pelo peso. `null` se faltam preços de referência. */
  variacaoSemanaPct: number | null;
  /** Valor total da carteira no fim da semana (R$). */
  patrimonioFim: number;
  /** Top mover ponderado por peso na carteira. */
  topMover: { ticker: string; variacaoPct: number; impactoR$: number } | null;
  /** Dividendos PAGOS na semana (histórico Yahoo × qty). */
  dividendosRecebidos: Array<{ ticker: string; date: string; amount: number }>;
  totalDividendosSemana: number;
  /** Transações registradas na semana. */
  transacoesDaSemana: Array<{ ticker: string; type: TransactionType; shares: number; total: number; timestamp: string }>;
  /** Alertas disparados na semana. */
  alertasDisparados: Array<{ ticker: string; type: AlertType; value: number; triggerPrice?: number; triggeredAt: string }>;
  /** Notícias materiais classificadas na semana (cache). */
  noticiasMateriais: Array<{ ticker: string; titulo: string; link: string; impacto: string; generatedAt: number }>;
  /** Snapshot leve do portfolio para o LLM ter contexto. */
  portfolioSnapshot: Array<{ ticker: string; quantity: number; price: number; score: number; weight: number }>;
}

export type DigestScreenTarget =
  | "dividends"
  | "analysis"
  | "market"
  | "alerts"
  | "news"
  | "home";

export interface DigestEventoNotavel {
  titulo: string;
  detalhe: string;
}

export interface DigestProximaAcao {
  acao: string;
  motivo: string;
  screenAlvo?: DigestScreenTarget;
}

export interface WeeklyDigest {
  /** ISO-week do digest (chave de cache). */
  isoWeek: string;
  /** 2-3 frases, começa com "Pelo seu perfil X...". */
  resumo: string;
  /** 1 frase com o evento mais importante. */
  destaque: string;
  eventosNotaveis: DigestEventoNotavel[];
  proximasAcoes: DigestProximaAcao[];
  /** Fontes do conjunto (rótulos curtos + URLs quando aplicável). */
  fontes: string[];
  /** Timestamp da geração. */
  generatedAt: number;
}

/* ─── Praxia: historico trimestral de fundamentos (Fase 7) ──────────────── */

export interface FundamentalQuarter {
  /** Label PT-BR ex.: "1T25". */
  periodo: string;
  /** Data final do trimestre (YYYY-MM-DD). */
  dataFim: string;
  netIncome?: number;
  revenue?: number;
  /** ROE anualizado do trimestre (fracao 0..1). */
  roe?: number;
  /** Margem liquida do trimestre (fracao 0..1). */
  netMargin?: number;
  debtToEbitda?: number;
  /** DY TTM (fracao). Yahoo retorna so a leitura mais recente; pode aparecer so no ultimo trimestre. */
  dy?: number;
  /** P/L TTM. Idem — geralmente so no ultimo trimestre. */
  pl?: number;
}

export interface FundamentalHistoryResponse {
  ticker: string;
  quarters: FundamentalQuarter[];
  source: string;
  generatedAt: string;
  note?: string;
  error?: string;
}

/* ─── Praxia: chat history with Pra ─────────────────────────────────────── */
export type ChatRole = 'user' | 'pra';

export interface ChatMessage {
  role: ChatRole;
  text: string;
  timestamp: string;
}
