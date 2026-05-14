import { useState, useEffect, useCallback, useRef } from "react";
import type { Stock } from "@/types/stock";
import { fetchStockQuote, fetchMultipleQuotes } from "@/lib/api";
import type { BrapiQuoteResult } from "@/lib/api";
import { calculateGrahamValue, calculateStockScore } from "@/lib/calculators";
import { detectMarket, detectSector, brandColor } from "@/lib/stockMeta";

const STORAGE_KEY = "stocks-ai-portfolio";
const TOKEN_KEY = "stocks-ai-brapi-token";
const POLL_INTERVAL = 60_000;

function normalizeMarketTime(value?: string): string {
  if (!value) return new Date().toISOString();

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();

  return new Date().toISOString();
}

function mapQuoteToStock(
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
    name: quote.shortName ?? quote.longName ?? quote.symbol,
    market: detectMarket(quote.symbol),
    sector: detectSector(quote.symbol),
    brandColor: brandColor(quote.symbol),
  };
}

function loadStocksFromStorage(): Stock[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Stock[];
  } catch {
    // Ignora dados corrompidos do localStorage.
  }
  return [];
}

function saveStocksToStorage(stocks: Stock[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stocks));
}

export function getStoredToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

export function setStoredToken(token: string) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function useStockQuotes() {
  const [stocks, setStocks] = useState<Stock[]>(loadStocksFromStorage);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    saveStocksToStorage(stocks);
  }, [stocks]);

  const refreshAll = useCallback(async () => {
    if (stocks.length === 0) return;

    setIsRefreshing(true);
    setError(null);

    try {
      const tickers = stocks.map((s) => s.ticker);
      const quotes = await fetchMultipleQuotes(tickers);

      setStocks((prev) => {
        const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));
        return prev.map((stock) => {
          const quote = quoteMap.get(stock.ticker);
          return quote ? mapQuoteToStock(quote, stock.cost, stock.quantity, stock.isFavorite) : stock;
        });
      });
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar cotacoes.");
    } finally {
      setIsRefreshing(false);
    }
  }, [stocks]);

  const refreshStock = useCallback(
    async (ticker: string) => {
      setError(null);
      try {
        const quote = await fetchStockQuote(ticker);
        setStocks((prev) =>
          prev.map((s) =>
            s.ticker === ticker ? mapQuoteToStock(quote, s.cost, s.quantity, s.isFavorite) : s
          )
        );
        setLastRefreshed(new Date());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao atualizar cotacao.");
      }
    },
    []
  );

  const addStock = useCallback(
    async (
      ticker: string,
      cost: number,
      quantity: number,
      overrides?: { lpa?: number; vpa?: number }
    ): Promise<Stock | null> => {
      setError(null);
      try {
        const quote = await fetchStockQuote(ticker);
        const newStock = mapQuoteToStock(quote, cost || 0, quantity || 0);

        if (overrides?.lpa !== undefined) newStock.lpa = overrides.lpa;
        if (overrides?.vpa !== undefined) newStock.vpa = overrides.vpa;

        setStocks((prev) => {
          const exists = prev.some((s) => s.ticker === newStock.ticker);
          if (exists) {
            return prev.map((s) =>
              s.ticker === newStock.ticker
                ? { ...newStock, cost: cost || s.cost, quantity: quantity || s.quantity, isFavorite: s.isFavorite }
                : s
            );
          }
          return [newStock, ...prev];
        });
        setLastRefreshed(new Date());

        return newStock;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao buscar acao.");
        return null;
      }
    },
    []
  );

  const removeStock = useCallback((ticker: string) => {
    setStocks((prev) => prev.filter((s) => s.ticker !== ticker));
  }, []);

  const toggleFavorite = useCallback((ticker: string) => {
    setStocks((prev) =>
      prev.map((s) =>
        s.ticker === ticker ? { ...s, isFavorite: !s.isFavorite } : s
      )
    );
  }, []);

  /**
   * Apply a paper-trade execution against the local portfolio.
   * - Buy: averages cost up and increments quantity (fetches the ticker if it isn't held yet).
   * - Sell: decrements quantity; removes the position when it reaches zero.
   * Returns `true` on success.
   */
  const applyTransaction = useCallback(
    async (
      ticker: string,
      type: "buy" | "sell",
      shares: number,
      price: number
    ): Promise<boolean> => {
      if (shares <= 0) return false;
      setError(null);

      if (type === "buy") {
        const existing = stocks.find((s) => s.ticker.toUpperCase() === ticker.toUpperCase());
        if (existing) {
          setStocks((prev) =>
            prev.map((s) => {
              if (s.ticker !== existing.ticker) return s;
              const newQty = (s.quantity || 0) + shares;
              const totalCost = (s.cost || 0) * (s.quantity || 0) + price * shares;
              const newCost = totalCost / newQty;
              return { ...s, quantity: newQty, cost: newCost };
            })
          );
          return true;
        }
        // First-time purchase: fetch fresh quote then write position
        try {
          const quote = await fetchStockQuote(ticker);
          const fresh = mapQuoteToStock(quote, price, shares);
          setStocks((prev) => {
            if (prev.some((p) => p.ticker === fresh.ticker)) return prev;
            return [fresh, ...prev];
          });
          return true;
        } catch (err) {
          setError(err instanceof Error ? err.message : "Falha ao registrar compra.");
          return false;
        }
      }

      // sell
      let ok = false;
      setStocks((prev) =>
        prev
          .map((s) => {
            if (s.ticker.toUpperCase() !== ticker.toUpperCase()) return s;
            const remaining = (s.quantity || 0) - shares;
            if (remaining < 0) return s;
            ok = true;
            return { ...s, quantity: remaining };
          })
          .filter((s) => s.quantity > 0 || s.isFavorite)
      );
      if (!ok) setError("Quantidade insuficiente para venda.");
      return ok;
    },
    [stocks]
  );

  useEffect(() => {
    if (stocks.length === 0) return;

    intervalRef.current = setInterval(() => {
      refreshAll();
    }, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refreshAll, stocks.length]);

  const replaceAll = useCallback((next: Stock[]) => setStocks(next), []);

  return {
    stocks,
    isRefreshing,
    lastRefreshed,
    error,
    clearError: () => setError(null),
    addStock,
    removeStock,
    toggleFavorite,
    applyTransaction,
    replaceAll,
    refreshAll,
    refreshStock,
    manualRefresh: refreshAll,
  };
}
