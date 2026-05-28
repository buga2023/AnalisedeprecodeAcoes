import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchFundamentalHistory,
  deriveQuartersFromRelatorios,
  mergeQuarters,
} from "@/lib/fundamentalsHistory";
import { fetchRelatorios } from "@/lib/relatorios";
import type { FundamentalQuarter, Relatorio } from "@/types/stock";

/**
 * Hook do historico trimestral de fundamentos. Lazy: o caller decide quando
 * disparar via prop `enabled` (UI usa IntersectionObserver pra carregar so
 * quando entra no viewport).
 *
 * Cache em `localStorage["praxia-fundamentals-history:{TICKER}"]` TTL 7d.
 * Fallback: se Yahoo devolve < 4 trimestres uteis, complementa com
 * relatorios trimestrais ja cacheados pelo `useRelatorios`.
 */

const CACHE_KEY_PREFIX = "praxia-fundamentals-history:";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry {
  ticker: string;
  quarters: FundamentalQuarter[];
  cachedAt: number;
}

function readCache(ticker: string): FundamentalQuarter[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + ticker);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed?.cachedAt || !Array.isArray(parsed.quarters)) return null;
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return parsed.quarters;
  } catch {
    return null;
  }
}

function writeCache(ticker: string, quarters: FundamentalQuarter[]) {
  try {
    localStorage.setItem(
      CACHE_KEY_PREFIX + ticker,
      JSON.stringify({ ticker, quarters, cachedAt: Date.now() } satisfies CacheEntry)
    );
  } catch {
    /* quota cheia */
  }
}

export interface UseFundamentalsHistoryResult {
  history: FundamentalQuarter[] | null;
  loading: boolean;
  error: string | null;
  fromCache: boolean;
  refresh: () => Promise<void>;
}

export function useFundamentalsHistory(
  ticker: string,
  enabled = true
): UseFundamentalsHistoryResult {
  const upper = ticker.toUpperCase();
  const [history, setHistory] = useState<FundamentalQuarter[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (forceRefresh: boolean) => {
      if (!enabled || !upper) return;
      if (!forceRefresh) {
        const cached = readCache(upper);
        if (cached) {
          setHistory(cached);
          setFromCache(true);
          return;
        }
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      setFromCache(false);

      try {
        const yahoo = await fetchFundamentalHistory(upper, { signal: controller.signal });
        if (controller.signal.aborted) return;

        let quarters = yahoo.quarters;
        // Fallback: relatorios trimestrais ja persistidos pelo BrAPI/useRelatorios.
        if (quarters.length < 4) {
          try {
            const relatorios: Relatorio[] = await fetchRelatorios(upper, controller.signal);
            const derived = deriveQuartersFromRelatorios(relatorios);
            quarters = mergeQuarters(quarters, derived);
          } catch {
            // fallback opcional — se falhar, segue com o que tem
          }
        }

        setHistory(quarters);
        writeCache(upper, quarters);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Falha ao buscar historico de fundamentos.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [upper, enabled]
  );

  useEffect(() => {
    if (!enabled) return;
    void load(false);
    return () => abortRef.current?.abort();
  }, [enabled, load]);

  return {
    history,
    loading,
    error,
    fromCache,
    refresh: () => load(true),
  };
}
