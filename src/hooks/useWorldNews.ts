import { useCallback, useEffect, useState } from "react";
import { fetchWorldNews, type WorldNewsContext } from "@/lib/context";

export interface UseWorldNewsResult {
  data: WorldNewsContext | null;
  isLoading: boolean;
  error: string | null;
  refresh: (force?: boolean) => Promise<void>;
}

/**
 * Carrega o pacote agregado de /api/world-news (GDELT + Google News multi-país
 * + Reddit + BBC). O servidor cacheia 2h via Vercel Cron; o cliente cacheia
 * 30min via `fetchWorldNews`. Use `refresh(true)` para forçar bypass.
 */
export function useWorldNews(): UseWorldNewsResult {
  const [data, setData] = useState<WorldNewsContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setIsLoading(true);
    setError(null);
    try {
      if (force) {
        // Quando o usuário pede refresh manual, dribla o cache do cliente
        // chamando o endpoint com ?refresh=1 e atualiza o cache interno.
        const res = await fetch("/api/world-news?refresh=1");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const fresh = (await res.json()) as WorldNewsContext;
        setData(fresh);
      } else {
        const cached = await fetchWorldNews();
        setData(cached);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar notícias.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  return {
    data,
    isLoading,
    error,
    refresh: load,
  };
}
