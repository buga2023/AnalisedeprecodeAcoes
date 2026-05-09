import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchRelatorios } from "@/lib/relatorios";
import type { Relatorio } from "@/types/stock";

const CACHE_KEY = "stocks-ai-relatorios";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  timestamp: number;
  relatorios: Relatorio[];
}

type CacheStore = Record<string, CacheEntry>;

function readCache(): CacheStore {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) as CacheStore : {};
  } catch {
    return {};
  }
}

function writeCache(cache: CacheStore) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

function isFresh(entry?: CacheEntry) {
  return Boolean(entry && Date.now() - entry.timestamp < CACHE_TTL_MS);
}

export function useRelatorios(tickers: string[]) {
  const [relatorios, setRelatorios] = useState<Relatorio[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const tickersKey = useMemo(() => tickers.map((ticker) => ticker.toUpperCase()).sort().join(","), [tickers]);

  const load = useCallback(async (forceRefresh = false, signal?: AbortSignal) => {
    const symbols = tickersKey ? tickersKey.split(",").filter(Boolean) : [];
    if (symbols.length === 0) {
      setRelatorios([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cache = readCache();
      const allRelatorios: Relatorio[] = [];
      const missing: string[] = [];

      for (const ticker of symbols) {
        const cached = cache[ticker];
        if (!forceRefresh && isFresh(cached)) {
          allRelatorios.push(...cached.relatorios);
        } else {
          missing.push(ticker);
        }
      }

      const fetched = await Promise.all(
        missing.map(async (ticker) => {
          const items = await fetchRelatorios(ticker, signal);
          cache[ticker] = { timestamp: Date.now(), relatorios: items };
          return items;
        })
      );

      fetched.forEach((items) => allRelatorios.push(...items));
      writeCache(cache);

      allRelatorios.sort((a, b) => new Date(b.dataFim).getTime() - new Date(a.dataFim).getTime());
      setRelatorios(allRelatorios);
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : "Falha ao buscar relatorios.");
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [tickersKey]);

  useEffect(() => {
    abortRef.current?.abort();

    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    abortRef.current = controller;

    const run = async () => {
      try {
        await load(false, controller.signal);
      } finally {
        if (requestIdRef.current === requestId) {
          abortRef.current = null;
        }
      }
    };

    void run();

    return () => {
      controller.abort();
    };
  }, [load]);

  return {
    relatorios,
    loading,
    error,
    refetch: () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      return load(true, controller.signal);
    },
  };
}
