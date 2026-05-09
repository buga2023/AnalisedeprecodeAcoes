import { useState, useCallback, useRef } from "react";
import { searchStocks } from "@/lib/api";

const DEBOUNCE_MS = 300;

export function useStockSearch() {
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    (query: string) => {
      if (!query || query.length < 1) {
        setResults([]);
        return;
      }

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      setIsLoading(true);
      timeoutRef.current = setTimeout(async () => {
        try {
          const stocks = await searchStocks(query);
          // Mapear para o formato que o componente Autocomplete espera
          const mappedResults = stocks.map(s => {
            let market: "BR" | "US" | "CRYPTO" = "US";
            if (s.region === "Brazil" || s.stock.endsWith('.SA')) market = "BR";
            if (s.type === "CRYPTO") market = "CRYPTO";

            return {
              ticker: s.stock,
              label: s.name,
              market: market
            };
          });
          setResults(mappedResults);
          setError(null);
        } catch (err) {
          setError("Erro ao pesquisar ativos.");
        } finally {
          setIsLoading(false);
        }
      }, DEBOUNCE_MS);
    },
    []
  );

  const clearResults = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setResults([]);
  }, []);

  return { results, search, clearResults, isLoading, error };
}
