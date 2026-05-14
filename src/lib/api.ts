const BRAPI_PROXY_URL = "/api/brapi";

export interface BrapiFinancialData {
  returnOnEquity?: number;
  totalDebt?: number;
  ebitda?: number;
  debtToEquity?: number;
  currentRatio?: number;
  freeCashflow?: number;
  totalRevenue?: number;
  profitMargins?: number;
}

export interface BrapiQuoteResult {
  symbol: string;
  shortName: string;
  longName: string;
  currency: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketTime: string;
  earningsPerShare: number;
  priceEarnings: number;
  bookValue?: number;
  dividendYield?: number;
  enterpriseValue?: number;
  financialData?: BrapiFinancialData;
}

interface BrapiQuoteResponse {
  results: BrapiQuoteResult[];
  requestedAt: string;
  took: string;
}

export interface BrapiError {
  message: string;
  code?: string;
}

/** Erro estruturado de busca de ticker — pode trazer sugestões do upstream. */
export class TickerLookupError extends Error {
  status: number;
  suggestions: { stock: string; name?: string }[];
  constructor(message: string, status: number, suggestions: { stock: string; name?: string }[] = []) {
    super(message);
    this.name = "TickerLookupError";
    this.status = status;
    this.suggestions = suggestions;
  }
}

export async function fetchStockQuote(
  ticker: string
): Promise<BrapiQuoteResult> {
  const url = new URL(BRAPI_PROXY_URL, window.location.origin);
  // Não usar encodeURIComponent: URLSearchParams.set já faz URL-encoding,
  // duplicar resultaria em %252C (vírgula dupla-codificada) e 404 no proxy.
  url.searchParams.set("endpoint", `/quote/${ticker.toUpperCase()}`);
  url.searchParams.set("modules", "summaryProfile,financialData,defaultKeyStatistics");

  const response = await fetch(url.toString());

  if (!response.ok) {
    if (response.status === 404) {
      // O backend pode anexar sugestões da Yahoo Search.
      const body = await response.json().catch(() => ({} as { error?: string; suggestions?: unknown }));
      const suggestions = Array.isArray(body?.suggestions) ? (body.suggestions as { stock: string; name?: string }[]) : [];
      throw new TickerLookupError(
        body?.error || `Ticker "${ticker}" não encontrado no Yahoo Finance.`,
        404,
        suggestions
      );
    }
    if (response.status === 429) {
      throw new Error("Limite de requisições atingido. Tente novamente em alguns minutos.");
    }
    throw new Error(`Erro ao buscar cotação: ${response.status}`);
  }

  const data: BrapiQuoteResponse = await response.json();

  if (!data.results || data.results.length === 0) {
    throw new TickerLookupError(`Nenhum resultado encontrado para "${ticker}".`, 404);
  }

  return data.results[0];
}

interface BrapiAvailableResponse {
  indexes: string[];
  stocks: string[];
}

export interface StockOption {
  ticker: string;
  label: string;
  market: "BR" | "US" | "CRYPTO";
}

const INTERNATIONAL_STOCKS: StockOption[] = [
  { ticker: "AAPL", label: "Apple Inc.", market: "US" },
  { ticker: "MSFT", label: "Microsoft Corp.", market: "US" },
  { ticker: "GOOGL", label: "Alphabet (Google)", market: "US" },
  { ticker: "AMZN", label: "Amazon.com Inc.", market: "US" },
  { ticker: "META", label: "Meta Platforms", market: "US" },
  { ticker: "NVDA", label: "NVIDIA Corp.", market: "US" },
  { ticker: "TSLA", label: "Tesla Inc.", market: "US" },
  { ticker: "NFLX", label: "Netflix Inc.", market: "US" },
  { ticker: "BTC", label: "Bitcoin", market: "CRYPTO" },
  { ticker: "ETH", label: "Ethereum", market: "CRYPTO" },
];

let cachedStockOptions: StockOption[] | null = null;

export async function fetchAvailableStocks(): Promise<StockOption[]> {
  if (cachedStockOptions) return cachedStockOptions;

  try {
    const url = new URL(BRAPI_PROXY_URL, window.location.origin);
    url.searchParams.set("endpoint", "/available");
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Erro ao buscar lista de ações: ${response.status}`);
    }

    const data: BrapiAvailableResponse = await response.json();
    const brStocks: StockOption[] = (data.stocks ?? []).map((ticker) => ({
      ticker,
      label: ticker,
      market: "BR" as const,
    }));

    const brTickers = new Set(brStocks.map((s) => s.ticker));
    const intlFiltered = INTERNATIONAL_STOCKS.filter((s) => !brTickers.has(s.ticker));
    cachedStockOptions = [...brStocks, ...intlFiltered];
    return cachedStockOptions;
  } catch {
    cachedStockOptions = INTERNATIONAL_STOCKS;
    return cachedStockOptions;
  }
}

export type HistoryRange = "1d" | "5d" | "6mo";

export interface HistoricalDataPoint {
  date: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface BrapiQuoteWithHistory {
  symbol: string;
  historicalDataPrice: HistoricalDataPoint[];
}

interface BrapiHistoryResponse {
  results: BrapiQuoteWithHistory[];
}

const RANGE_INTERVAL_MAP: Record<HistoryRange, string> = {
  "1d": "15m",
  "5d": "1h",
  "6mo": "1d",
};

export async function fetchStockHistory(
  ticker: string,
  range: HistoryRange
): Promise<HistoricalDataPoint[]> {
  const interval = RANGE_INTERVAL_MAP[range];
  const url = new URL(BRAPI_PROXY_URL, window.location.origin);
  url.searchParams.set("endpoint", `/quote/${ticker.toUpperCase()}`);
  url.searchParams.set("range", range);
  url.searchParams.set("interval", interval);

  const response = await fetch(url.toString());

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Ticker "${ticker}" não encontrado.`);
    }
    if (response.status === 429) {
      throw new Error("Limite de requisições atingido. Tente novamente em alguns minutos.");
    }
    throw new Error(`Erro ao buscar histórico: ${response.status}`);
  }

  const data: BrapiHistoryResponse = await response.json();

  if (!data.results || data.results.length === 0 || !data.results[0].historicalDataPrice) {
    throw new Error(`Nenhum dado histórico encontrado para "${ticker}".`);
  }

  return data.results[0].historicalDataPrice;
}

export async function fetchMultipleQuotes(
  tickers: string[]
): Promise<BrapiQuoteResult[]> {
  if (tickers.length === 0) return [];

  const tickerString = tickers.map((t) => t.toUpperCase()).join(",");
  const url = new URL(BRAPI_PROXY_URL, window.location.origin);
  // Não usar encodeURIComponent na vírgula: URLSearchParams.set já encoda.
  url.searchParams.set("endpoint", `/quote/${tickerString}`);
  url.searchParams.set("modules", "summaryProfile,financialData,defaultKeyStatistics");

  const response = await fetch(url.toString());

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Limite de requisições atingido. Tente novamente em alguns minutos.");
    }
    throw new Error(`Erro ao buscar cotações: ${response.status}`);
  }

  const data: BrapiQuoteResponse = await response.json();

  if (!data.results) {
    throw new Error("Resposta inválida da API.");
  }

  return data.results;
}

export async function searchStocks(query: string): Promise<any[]> {
  if (!query) return [];
  const url = new URL(BRAPI_PROXY_URL, window.location.origin);
  url.searchParams.set("endpoint", "/search");
  url.searchParams.set("q", query);

  try {
    const response = await fetch(url.toString());
    if (!response.ok) return [];
    const data = await response.json();
    return data.stocks || [];
  } catch {
    return [];
  }
}
