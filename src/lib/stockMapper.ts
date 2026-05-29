import type { Stock } from "@/types/stock";
import type { BrapiQuoteResult } from "@/lib/api";
import { calculateGrahamValue, calculateROIC, calculateStockScore } from "@/lib/calculators";
import { detectMarket, detectSector, brandColor } from "@/lib/stockMeta";

/**
 * Mapeia uma cotação crua do proxy (`/api/brapi`) para o modelo `Stock`,
 * computando Graham VI, ROIC e o Score 0–100 pelo motor único em
 * `calculators.ts`. Fonte de verdade compartilhada entre `useStockQuotes`
 * (carteira) e `screener.ts` (descoberta) — não duplicar a lógica.
 */

export function normalizeMarketTime(value?: string): string {
  if (!value) return new Date().toISOString();

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();

  return new Date().toISOString();
}

export function mapQuoteToStock(
  quote: BrapiQuoteResult,
  existingCost?: number,
  existingQuantity?: number,
  existingFavorite?: boolean
): Stock {
  const lpa = quote.earningsPerShare ?? 0;
  const vpa = quote.bookValue ?? 0;
  const price = quote.regularMarketPrice;
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

  const { total, breakdown } = calculateStockScore({
    price,
    grahamValue,
    roe,
    debtToEbitda,
    dividendYield,
    pl,
    evEbitda,
  });

  return {
    ticker: quote.symbol,
    price,
    cost: existingCost ?? 0,
    quantity: existingQuantity ?? 0,
    lpa,
    vpa,
    roe,
    debtToEbitda,
    change: quote.regularMarketChange ?? 0,
    changePercent: quote.regularMarketChangePercent ?? 0,
    lastUpdated: normalizeMarketTime(quote.regularMarketTime),
    score: total,
    scoreBreakdown: breakdown,
    isFavorite: existingFavorite ?? false,
    pl,
    pvp,
    dividendYield,
    evEbitda,
    netMargin,
    ebitdaMargin,
    roic,
    grahamValue,
    marginOfSafety: grahamValue > 0 ? ((grahamValue - price) / grahamValue) * 100 : 0,
    name: quote.shortName ?? quote.longName ?? quote.symbol,
    market: detectMarket(quote.symbol),
    sector: detectSector(quote.symbol),
    brandColor: brandColor(quote.symbol),
  };
}
