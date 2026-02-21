import { useState, useEffect, useCallback, useRef } from "react";
import { fetchAvailableStocks } from "@/lib/api";
import type { StockOption } from "@/lib/api";

const MAX_RESULTS = 20;

export function useStockSearch() {
  const [allStocks, setAllStocks] = useState<StockOption[]>([]);
  const [results, setResults] = useState<StockOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    setIsLoading(true);
    fetchAvailableStocks()
      .then((stocks) => {
        setAllStocks(stocks);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Erro ao carregar tickers.");
      })
      .finally(() => setIsLoading(false));
  }, []);

  const search = useCallback(
    (query: string) => {
      if (!query || query.length < 1) {
        setResults([]);
        return;
      }
      const upper = query.toUpperCase();
      const lower = query.toLowerCase();
      // Prioritize: exact ticker start > label match > ticker contains
      const startsWithTicker: StockOption[] = [];
      const matchesLabel: StockOption[] = [];
      const containsTicker: StockOption[] = [];

      for (const s of allStocks) {
        if (startsWithTicker.length + matchesLabel.length + containsTicker.length >= MAX_RESULTS * 2) break;

        if (s.ticker.startsWith(upper)) {
          startsWithTicker.push(s);
        } else if (s.label.toLowerCase().includes(lower)) {
          matchesLabel.push(s);
        } else if (s.ticker.includes(upper)) {
          containsTicker.push(s);
        }
      }
      setResults([...startsWithTicker, ...matchesLabel, ...containsTicker].slice(0, MAX_RESULTS));
    },
    [allStocks]
  );

  const clearResults = useCallback(() => setResults([]), []);

  return { results, search, clearResults, isLoading, error };
}
