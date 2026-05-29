import { useState, useEffect, useCallback, useRef } from "react";
import type { Stock } from "@/types/stock";
import { fetchStockQuote, fetchMultipleQuotes } from "@/lib/api";
import { mapQuoteToStock } from "@/lib/stockMapper";
import { detectMarket, brandColor } from "@/lib/stockMeta";
import { fetchFundamentalsFromAI, mergeAIFundamentalsIntoStock } from "@/lib/fundamentals";
import { useAuth } from "@/hooks/useAuth";
import {
  bulkUploadPortfolio,
  deletePortfolioStock,
  fetchPortfolioFromServer,
  upsertPortfolioStock,
} from "@/lib/supabaseSync";

const STORAGE_KEY = "stocks-ai-portfolio";
const TOKEN_KEY = "stocks-ai-brapi-token";
const POLL_INTERVAL = 60_000;

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

/** Heurística: o stock está com fundamentos zerados o suficiente para pedir
 *  fallback via IA? P/L, ROE e DY zerados ao mesmo tempo são bom sinal. */
function needsAIFundamentals(stock: Stock): boolean {
  const allZero =
    !(stock.pl > 0) &&
    !(stock.pvp > 0) &&
    !(stock.dividendYield > 0) &&
    !(stock.roe > 0);
  return allZero;
}

export function useStockQuotes() {
  const { user } = useAuth();
  const [stocks, setStocks] = useState<Stock[]>(loadStocksFromStorage);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Quais tickers já tentamos fazer fallback IA nesta sessão (evita loop).
  const aiAttemptedRef = useRef<Set<string>>(new Set());
  // Marca se ja sincronizou com o servidor neste user (evita re-fetch).
  const syncedUserRef = useRef<string | null>(null);

  useEffect(() => {
    saveStocksToStorage(stocks);
  }, [stocks]);

  /**
   * Sync inicial com Supabase quando user autentica.
   * - Se servidor tem dados: substitui localStorage (servidor eh fonte da verdade).
   * - Se servidor vazio e localStorage tem dados: migracao one-time (sobe tudo).
   * - Refresca cotacoes em seguida (BrAPI) pra dados frescos.
   */
  useEffect(() => {
    if (!user) return;
    if (syncedUserRef.current === user.id) return; // ja sincronizou

    let cancelled = false;
    (async () => {
      const remote = await fetchPortfolioFromServer(user.id);
      if (cancelled) return;
      if (remote === null) return; // erro ou nao configurado — mantem localStorage

      syncedUserRef.current = user.id;

      if (remote.length === 0) {
        // Migracao one-time: localStorage tem stocks pre-auth -> sobe.
        const local = loadStocksFromStorage();
        if (local.length > 0) {
          await bulkUploadPortfolio(user.id, local);
          // Mantem o local — proximo poll completa fundamentos.
          return;
        }
        // Servidor vazio + localStorage vazio: nada a fazer.
        setStocks([]);
        return;
      }

      // Servidor tem dados — busca cotacoes frescas pra reconstruir os Stocks.
      try {
        const tickers = remote.map((s) => s.ticker);
        const quotes = await fetchMultipleQuotes(tickers);
        const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));
        const restored: Stock[] = remote.map((r) => {
          const quote = quoteMap.get(r.ticker);
          if (quote) {
            return { ...mapQuoteToStock(quote, r.cost, r.quantity), name: r.name || quote.shortName || r.ticker };
          }
          // Sem cotacao no momento — mantem so o que vem do banco.
          return {
            ticker: r.ticker,
            name: r.name || r.ticker,
            sector: r.sector,
            quantity: r.quantity,
            cost: r.cost,
            price: 0,
            lpa: 0,
            vpa: 0,
            roe: 0,
            debtToEbitda: 0,
            change: 0,
            changePercent: 0,
            lastUpdated: new Date().toISOString(),
            score: 0,
            scoreBreakdown: { priceScore: 0, profitabilityScore: 0, healthScore: 0, dividendScore: 0, valuationScore: 0 },
            isFavorite: false,
            pl: 0,
            pvp: 0,
            dividendYield: 0,
            evEbitda: 0,
            netMargin: 0,
            ebitdaMargin: 0,
            roic: 0,
            grahamValue: 0,
            marginOfSafety: 0,
            market: detectMarket(r.ticker),
            brandColor: brandColor(r.ticker),
          } as Stock;
        });
        if (!cancelled) {
          setStocks(restored);
          setLastRefreshed(new Date());
        }
      } catch {
        // Falha de cotacao nao bloqueia — mantem o que veio do banco.
      }
    })();

    return () => {
      cancelled = true;
    };
    // user.id muda em troca de usuario.
  }, [user]);

  // Quando user faz logout, reseta o flag pra sync rodar no proximo login.
  useEffect(() => {
    if (!user) syncedUserRef.current = null;
  }, [user]);

  /**
   * Para cada stock com fundamentos zerados, chama /api/fundamentals (IA) e
   * funde os valores estimados. Roda em background, não bloqueia a UI.
   */
  const fillMissingFundamentalsViaAI = useCallback(async (currentStocks: Stock[]) => {
    const candidates = currentStocks.filter(
      (s) =>
        needsAIFundamentals(s) &&
        !s.aiEstimated &&
        !aiAttemptedRef.current.has(s.ticker)
    );
    if (candidates.length === 0) return;

    for (const candidate of candidates) {
      aiAttemptedRef.current.add(candidate.ticker);
      const ai = await fetchFundamentalsFromAI(candidate.ticker, candidate.price);
      if (!ai) continue;
      setStocks((prev) =>
        prev.map((s) => (s.ticker === candidate.ticker ? mergeAIFundamentalsIntoStock(s, ai) : s))
      );
    }
  }, []);

  // Dispara o fallback IA toda vez que a carteira muda (incluindo após poll).
  useEffect(() => {
    if (stocks.length === 0) return;
    void fillMissingFundamentalsViaAI(stocks);
  }, [stocks, fillMissingFundamentalsViaAI]);

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

        // Write-through Supabase — fire-and-forget.
        if (user) {
          void upsertPortfolioStock(user.id, {
            ticker: newStock.ticker,
            name: newStock.name,
            sector: newStock.sector,
            quantity: newStock.quantity,
            cost: newStock.cost,
          });
        }

        return newStock;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao buscar acao.");
        return null;
      }
    },
    [user]
  );

  const removeStock = useCallback(
    (ticker: string) => {
      setStocks((prev) => prev.filter((s) => s.ticker !== ticker));
      if (user) void deletePortfolioStock(user.id, ticker);
    },
    [user]
  );

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
          // Calcula fora do setState pra TS conseguir narrow.
          const newQty = (existing.quantity || 0) + shares;
          const totalCost = (existing.cost || 0) * (existing.quantity || 0) + price * shares;
          const newCost = totalCost / newQty;
          const nextStock: Stock = { ...existing, quantity: newQty, cost: newCost };
          setStocks((prev) =>
            prev.map((s) => (s.ticker === existing.ticker ? nextStock : s))
          );
          if (user) {
            void upsertPortfolioStock(user.id, {
              ticker: nextStock.ticker,
              name: nextStock.name,
              sector: nextStock.sector,
              quantity: nextStock.quantity,
              cost: nextStock.cost,
            });
          }
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
          if (user) {
            void upsertPortfolioStock(user.id, {
              ticker: fresh.ticker,
              name: fresh.name,
              sector: fresh.sector,
              quantity: fresh.quantity,
              cost: fresh.cost,
            });
          }
          return true;
        } catch (err) {
          setError(err instanceof Error ? err.message : "Falha ao registrar compra.");
          return false;
        }
      }

      // sell — calcula proximo estado fora pra ter referencia tipada do resultado.
      const target = stocks.find(
        (s) => s.ticker.toUpperCase() === ticker.toUpperCase()
      );
      if (!target) {
        setError("Quantidade insuficiente para venda.");
        return false;
      }
      const remaining = (target.quantity || 0) - shares;
      if (remaining < 0) {
        setError("Quantidade insuficiente para venda.");
        return false;
      }
      const updated: Stock = { ...target, quantity: remaining };
      const removed = remaining === 0 && !target.isFavorite;
      setStocks((prev) =>
        prev
          .map((s) => (s.ticker === target.ticker ? updated : s))
          .filter((s) => s.quantity > 0 || s.isFavorite)
      );
      if (user) {
        if (removed) {
          void deletePortfolioStock(user.id, target.ticker);
        } else {
          void upsertPortfolioStock(user.id, {
            ticker: updated.ticker,
            name: updated.name,
            sector: updated.sector,
            quantity: updated.quantity,
            cost: updated.cost,
          });
        }
      }
      return true;
    },
    [stocks, user]
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
