const BRAPI_BASE_URL = "https://brapi.dev/api";

export interface BrapiFinancialData {
  returnOnEquity?: number;
  totalDebt?: number;
  ebitda?: number;
  debtToEquity?: number;
  currentRatio?: number;
  freeCashflow?: number;
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

export async function fetchStockQuote(
  ticker: string,
  token?: string
): Promise<BrapiQuoteResult> {
  const url = new URL(`${BRAPI_BASE_URL}/quote/${encodeURIComponent(ticker.toUpperCase())}`);
  if (token) {
    url.searchParams.set("token", token);
  }
  url.searchParams.set("modules", "defaultKeyStatistics,financialData");

  const response = await fetch(url.toString());

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Ticker "${ticker}" não encontrado.`);
    }
    if (response.status === 429) {
      throw new Error("Limite de requisições atingido. Tente novamente em alguns minutos.");
    }
    if (response.status === 403 || response.status === 401) {
      throw new Error(
        `Token necessário para buscar "${ticker}". Configure seu token da brapi nas configurações.`
      );
    }
    throw new Error(`Erro ao buscar cotação: ${response.status}`);
  }

  const data: BrapiQuoteResponse = await response.json();

  if (!data.results || data.results.length === 0) {
    if (!token) {
      throw new Error(
        `Nenhum resultado para "${ticker}". Sem token, apenas PETR4, VALE3, MGLU3 e ITUB4 estão disponíveis. Configure um token nas configurações para acessar todas as ações.`
      );
    }
    throw new Error(`Nenhum resultado encontrado para "${ticker}".`);
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
  // US - Tech
  { ticker: "AAPL", label: "Apple Inc.", market: "US" },
  { ticker: "MSFT", label: "Microsoft Corp.", market: "US" },
  { ticker: "GOOGL", label: "Alphabet (Google)", market: "US" },
  { ticker: "AMZN", label: "Amazon.com Inc.", market: "US" },
  { ticker: "META", label: "Meta Platforms", market: "US" },
  { ticker: "NVDA", label: "NVIDIA Corp.", market: "US" },
  { ticker: "TSLA", label: "Tesla Inc.", market: "US" },
  { ticker: "NFLX", label: "Netflix Inc.", market: "US" },
  { ticker: "AMD", label: "Advanced Micro Devices", market: "US" },
  { ticker: "INTC", label: "Intel Corp.", market: "US" },
  { ticker: "CRM", label: "Salesforce Inc.", market: "US" },
  { ticker: "ORCL", label: "Oracle Corp.", market: "US" },
  { ticker: "ADBE", label: "Adobe Inc.", market: "US" },
  { ticker: "CSCO", label: "Cisco Systems", market: "US" },
  { ticker: "AVGO", label: "Broadcom Inc.", market: "US" },
  { ticker: "QCOM", label: "Qualcomm Inc.", market: "US" },
  { ticker: "IBM", label: "IBM Corp.", market: "US" },
  { ticker: "UBER", label: "Uber Technologies", market: "US" },
  { ticker: "SHOP", label: "Shopify Inc.", market: "US" },
  { ticker: "SNAP", label: "Snap Inc.", market: "US" },
  { ticker: "SPOT", label: "Spotify Technology", market: "US" },
  { ticker: "SQ", label: "Block Inc.", market: "US" },
  { ticker: "PYPL", label: "PayPal Holdings", market: "US" },
  { ticker: "PLTR", label: "Palantir Technologies", market: "US" },
  // US - Finance
  { ticker: "JPM", label: "JPMorgan Chase", market: "US" },
  { ticker: "BAC", label: "Bank of America", market: "US" },
  { ticker: "WFC", label: "Wells Fargo", market: "US" },
  { ticker: "GS", label: "Goldman Sachs", market: "US" },
  { ticker: "MS", label: "Morgan Stanley", market: "US" },
  { ticker: "V", label: "Visa Inc.", market: "US" },
  { ticker: "MA", label: "Mastercard Inc.", market: "US" },
  { ticker: "BRK-A", label: "Berkshire Hathaway A", market: "US" },
  { ticker: "BRK-B", label: "Berkshire Hathaway B", market: "US" },
  // US - Healthcare
  { ticker: "JNJ", label: "Johnson & Johnson", market: "US" },
  { ticker: "PFE", label: "Pfizer Inc.", market: "US" },
  { ticker: "UNH", label: "UnitedHealth Group", market: "US" },
  { ticker: "ABBV", label: "AbbVie Inc.", market: "US" },
  { ticker: "MRK", label: "Merck & Co.", market: "US" },
  { ticker: "LLY", label: "Eli Lilly & Co.", market: "US" },
  // US - Consumer / Industrial
  { ticker: "KO", label: "Coca-Cola Co.", market: "US" },
  { ticker: "PEP", label: "PepsiCo Inc.", market: "US" },
  { ticker: "WMT", label: "Walmart Inc.", market: "US" },
  { ticker: "COST", label: "Costco Wholesale", market: "US" },
  { ticker: "NKE", label: "Nike Inc.", market: "US" },
  { ticker: "MCD", label: "McDonald's Corp.", market: "US" },
  { ticker: "SBUX", label: "Starbucks Corp.", market: "US" },
  { ticker: "DIS", label: "Walt Disney Co.", market: "US" },
  { ticker: "HD", label: "Home Depot", market: "US" },
  { ticker: "BA", label: "Boeing Co.", market: "US" },
  { ticker: "CAT", label: "Caterpillar Inc.", market: "US" },
  { ticker: "F", label: "Ford Motor Co.", market: "US" },
  { ticker: "GM", label: "General Motors", market: "US" },
  // US - Energy
  { ticker: "XOM", label: "Exxon Mobil", market: "US" },
  { ticker: "CVX", label: "Chevron Corp.", market: "US" },
  // US - ETFs
  { ticker: "SPY", label: "S&P 500 ETF", market: "US" },
  { ticker: "QQQ", label: "Nasdaq 100 ETF", market: "US" },
  { ticker: "IWM", label: "Russell 2000 ETF", market: "US" },
  { ticker: "VTI", label: "Vanguard Total Market", market: "US" },
  { ticker: "VOO", label: "Vanguard S&P 500", market: "US" },
  // Crypto
  { ticker: "BTC", label: "Bitcoin", market: "CRYPTO" },
  { ticker: "ETH", label: "Ethereum", market: "CRYPTO" },
];

let cachedStockOptions: StockOption[] | null = null;

export async function fetchAvailableStocks(): Promise<StockOption[]> {
  if (cachedStockOptions) return cachedStockOptions;

  try {
    const response = await fetch(`${BRAPI_BASE_URL}/available`);

    if (!response.ok) {
      throw new Error(`Erro ao buscar lista de ações: ${response.status}`);
    }

    const data: BrapiAvailableResponse = await response.json();
    const brStocks: StockOption[] = (data.stocks ?? []).map((ticker) => ({
      ticker,
      label: ticker,
      market: "BR" as const,
    }));

    // Merge: BR stocks first, then international (excluding duplicates)
    const brTickers = new Set(brStocks.map((s) => s.ticker));
    const intlFiltered = INTERNATIONAL_STOCKS.filter((s) => !brTickers.has(s.ticker));
    cachedStockOptions = [...brStocks, ...intlFiltered];
    return cachedStockOptions;
  } catch {
    // Fallback: return at least the international list if API fails
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
  range: HistoryRange,
  token?: string
): Promise<HistoricalDataPoint[]> {
  const interval = RANGE_INTERVAL_MAP[range];
  const url = new URL(`${BRAPI_BASE_URL}/quote/${encodeURIComponent(ticker.toUpperCase())}`);
  url.searchParams.set("range", range);
  url.searchParams.set("interval", interval);
  if (token) {
    url.searchParams.set("token", token);
  }

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
  tickers: string[],
  token?: string
): Promise<BrapiQuoteResult[]> {
  if (tickers.length === 0) return [];

  const tickerString = tickers.map((t) => t.toUpperCase()).join(",");
  const url = new URL(`${BRAPI_BASE_URL}/quote/${encodeURIComponent(tickerString)}`);
  if (token) {
    url.searchParams.set("token", token);
  }
  url.searchParams.set("modules", "defaultKeyStatistics,financialData");

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
