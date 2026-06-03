import type { Stock, InvestorProfile } from "@/types/stock";
import { fetchMultipleQuotes } from "@/lib/api";
import { calculateGrahamValue, calculateROIC, calculateStockScore } from "@/lib/calculators";
import { detectMarket, detectSector, brandColor } from "@/lib/stockMeta";
import type { BrapiQuoteResult } from "@/lib/api";

export interface ScreenerFilters {
  minROE: number | null;
  maxPL: number | null;
  minDY: number | null;
  maxDebtToEbitda: number | null;
  sectors: string[] | null;
  sortBy: "score" | "dy" | "roe" | "pl";
}

export interface ScreenerResult {
  filters: ScreenerFilters;
  suggestedTickers: string[];
  label: string;
  rationale: string;
  stocks: Stock[];
}

const CACHE_KEY_PREFIX = "praxia-screener:";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

interface CacheEntry {
  result: ScreenerResult;
  expiresAt: number;
}

function cacheGet(key: string): ScreenerResult | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (entry.expiresAt < Date.now()) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.result;
  } catch {
    return null;
  }
}

function cacheSet(key: string, result: ScreenerResult) {
  try {
    const entry: CacheEntry = { result, expiresAt: Date.now() + CACHE_TTL_MS };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // localStorage quota — silently skip
  }
}

function normalizeTime(value?: string): string {
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function quoteToStock(quote: BrapiQuoteResult): Stock {
  const lpa = quote.earningsPerShare ?? 0;
  const vpa = quote.bookValue ?? 0;
  const price = quote.regularMarketPrice ?? 0;
  const roe = quote.financialData?.returnOnEquity ?? 0;
  const totalDebt = quote.financialData?.totalDebt ?? 0;
  const ebitda = quote.financialData?.ebitda ?? 0;
  const debtToEbitda = ebitda > 0 ? totalDebt / ebitda : 0;
  const grahamValue = calculateGrahamValue(lpa, vpa);
  const pl = quote.priceEarnings ?? 0;
  const pvp = vpa > 0 ? price / vpa : 0;
  const dividendYield = quote.dividendYield ?? 0;
  const enterpriseValue = quote.enterpriseValue ?? 0;
  const evEbitda = ebitda > 0 && enterpriseValue > 0 ? enterpriseValue / ebitda : 0;
  const netMargin = quote.financialData?.profitMargins ?? 0;
  const totalRevenue = quote.financialData?.totalRevenue ?? 0;
  const ebitdaMargin = totalRevenue > 0 && ebitda > 0 ? ebitda / totalRevenue : 0;
  const debtToEquity = quote.financialData?.debtToEquity ?? 0;
  const roic = calculateROIC(ebitda, totalDebt, debtToEquity);
  const { total, breakdown } = calculateStockScore({ price, grahamValue, roe, debtToEbitda, dividendYield, pl, evEbitda });
  const ticker = quote.symbol;

  return {
    ticker,
    price,
    cost: 0,
    quantity: 0,
    lpa,
    vpa,
    roe,
    debtToEbitda,
    change: quote.regularMarketChange ?? 0,
    changePercent: quote.regularMarketChangePercent ?? 0,
    lastUpdated: normalizeTime(quote.regularMarketTime),
    score: total,
    scoreBreakdown: breakdown,
    isFavorite: false,
    pl,
    pvp,
    dividendYield,
    evEbitda,
    netMargin,
    ebitdaMargin,
    roic,
    grahamValue: grahamValue > 0 ? grahamValue : undefined,
    marginOfSafety: grahamValue > 0 ? ((grahamValue - price) / grahamValue) * 100 : undefined,
    name: quote.shortName ?? ticker,
    market: detectMarket(ticker),
    sector: detectSector(ticker),
    brandColor: brandColor(ticker),
  };
}

function applyFilters(stocks: Stock[], filters: ScreenerFilters): Stock[] {
  return stocks.filter((s) => {
    if (filters.minROE !== null && s.roe * 100 < filters.minROE) return false;
    if (filters.maxPL !== null && s.pl > filters.maxPL && s.pl > 0) return false;
    if (filters.minDY !== null && s.dividendYield * 100 < filters.minDY) return false;
    if (filters.maxDebtToEbitda !== null && s.debtToEbitda > filters.maxDebtToEbitda) return false;
    if (filters.sectors && filters.sectors.length > 0 && s.sector) {
      const sectorLower = s.sector.toLowerCase();
      const match = filters.sectors.some((sec) => sectorLower.includes(sec.toLowerCase()));
      if (!match) return false;
    }
    return true;
  });
}

function sortStocks(stocks: Stock[], sortBy: ScreenerFilters["sortBy"]): Stock[] {
  return [...stocks].sort((a, b) => {
    switch (sortBy) {
      case "dy": return b.dividendYield - a.dividendYield;
      case "roe": return b.roe - a.roe;
      case "pl": return (a.pl > 0 ? a.pl : 999) - (b.pl > 0 ? b.pl : 999);
      default: return b.score - a.score;
    }
  });
}

export async function runScreener(
  query: string,
  profile: InvestorProfile | null
): Promise<ScreenerResult> {
  const cacheKey = `${CACHE_KEY_PREFIX}${query.trim().toLowerCase()}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  // 1. Parse query → filters + suggested tickers via LLM (server-side)
  const apiRes = await fetch("/api/screen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: query.trim(),
      profile: profile ? { risk: profile.risk, horizon: profile.horizon } : null,
    }),
  });

  if (!apiRes.ok) {
    const err = await apiRes.json().catch(() => ({ error: "Erro na IA" })) as { error?: string };
    throw new Error(err.error ?? `Erro ${apiRes.status}`);
  }

  const parsed = await apiRes.json() as {
    filters: ScreenerFilters;
    suggestedTickers: string[];
    label: string;
    rationale: string;
  };

  const tickers = (parsed.suggestedTickers ?? []).slice(0, 12);
  if (tickers.length === 0) {
    const result: ScreenerResult = {
      filters: parsed.filters,
      suggestedTickers: [],
      label: parsed.label ?? query,
      rationale: parsed.rationale ?? "",
      stocks: [],
    };
    return result;
  }

  // 2. Fetch real quotes for suggested tickers (bulk)
  let quotes: BrapiQuoteResult[] = [];
  try {
    quotes = await fetchMultipleQuotes(tickers);
  } catch {
    // Partial failure — continue with what we got
  }

  // 3. Convert to Stock, apply filters, sort, top-10
  const allStocks = quotes.map(quoteToStock);
  const filtered = applyFilters(allStocks, parsed.filters);
  const sorted = sortStocks(filtered.length > 0 ? filtered : allStocks, parsed.filters.sortBy ?? "score");
  const top10 = sorted.slice(0, 10);

  const result: ScreenerResult = {
    filters: parsed.filters,
    suggestedTickers: tickers,
    label: parsed.label ?? query,
    rationale: parsed.rationale ?? "",
    stocks: top10,
  };

  cacheSet(cacheKey, result);
  return result;
}
