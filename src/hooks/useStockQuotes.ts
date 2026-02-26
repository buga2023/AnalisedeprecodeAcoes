import { useState, useEffect, useCallback, useRef } from "react";
import type { Stock } from "@/types/stock";
import { fetchStockQuote, fetchMultipleQuotes } from "@/lib/api";
import type { BrapiQuoteResult } from "@/lib/api";
import { calculateGrahamValue, calculateStockScore } from "@/lib/calculators";

const STORAGE_KEY = "stocks-ai-portfolio";
const TOKEN_KEY = "stocks-ai-brapi-token";
const DEFAULT_TOKEN = "CLEBS2H2C4C9RG8W";
const POLL_INTERVAL = 60_000;

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

  const { total, breakdown } = calculateStockScore({ price, grahamValue, roe, debtToEbitda, dividendYield, pl, evEbitda });

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
    lastUpdated: new Date().toISOString(),
    score: total,
    scoreBreakdown: breakdown,
    isFavorite: existingFavorite ?? false,
    pl,
    pvp,
    dividendYield,
    evEbitda,
    netMargin,
    ebitdaMargin,
  };
}

function loadStocksFromStorage(): Stock[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore corrupt data
  }
  return [];
}

function saveStocksToStorage(stocks: Stock[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stocks));
}

export function getStoredToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? DEFAULT_TOKEN;
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
  const [token, setToken] = useState(getStoredToken);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Persist stocks to localStorage whenever they change
  useEffect(() => {
    saveStocksToStorage(stocks);
  }, [stocks]);

  // Persist token
  const updateToken = useCallback((newToken: string) => {
    setStoredToken(newToken);
    setToken(newToken);
  }, []);

  // Refresh all stock prices from the API
  const refreshAll = useCallback(async () => {
    if (stocks.length === 0) return;

    setIsRefreshing(true);
    setError(null);

    try {
      const tickers = stocks.map((s) => s.ticker);
      const quotes = await fetchMultipleQuotes(tickers, token || undefined);

      setStocks((prev) => {
        const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));
        return prev.map((stock) => {
          const quote = quoteMap.get(stock.ticker);
          if (quote) {
            return mapQuoteToStock(quote, stock.cost, stock.quantity, stock.isFavorite);
          }
          return stock;
        });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar cotações.");
    } finally {
      setIsRefreshing(false);
    }
  }, [stocks.length, token]);

  // Refresh a single stock
  const refreshStock = useCallback(
    async (ticker: string) => {
      setError(null);
      try {
        const quote = await fetchStockQuote(ticker, token || undefined);
        setStocks((prev) =>
          prev.map((s) =>
            s.ticker === ticker ? mapQuoteToStock(quote, s.cost, s.quantity, s.isFavorite) : s
          )
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao atualizar cotação.");
      }
    },
    [token]
  );

  // Add a new stock by fetching its data from the API
  const addStock = useCallback(
    async (
      ticker: string,
      cost: number,
      quantity: number,
      overrides?: { lpa?: number; vpa?: number }
    ): Promise<Stock | null> => {
      setError(null);
      try {
        const quote = await fetchStockQuote(ticker, token || undefined);
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

        return newStock;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao buscar ação.");
        return null;
      }
    },
    [token]
  );

  // Remove a stock from the portfolio
  const removeStock = useCallback((ticker: string) => {
    setStocks((prev) => prev.filter((s) => s.ticker !== ticker));
  }, []);

  // Toggle favorite status
  const toggleFavorite = useCallback((ticker: string) => {
    setStocks((prev) =>
      prev.map((s) =>
        s.ticker === ticker ? { ...s, isFavorite: !s.isFavorite } : s
      )
    );
  }, []);

  // Set up polling interval
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

  return {
    stocks,
    token,
    updateToken,
    isRefreshing,
    error,
    clearError: () => setError(null),
    addStock,
    removeStock,
    toggleFavorite,
    refreshAll,
    refreshStock,
  };
}
