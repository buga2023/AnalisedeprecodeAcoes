import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchDividendHistory,
  projectDividends,
  type DividendEvent,
  type MonthBucket,
} from "@/lib/dividends";
import type { Stock } from "@/types/stock";

const CACHE_KEY_PREFIX = "praxia-dividend-history:";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

interface CacheEntry {
  data: DividendEvent[];
  cachedAt: number;
}

function readCache(ticker: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + ticker);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed?.cachedAt || !Array.isArray(parsed.data)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(ticker: string, data: DividendEvent[]) {
  try {
    localStorage.setItem(
      CACHE_KEY_PREFIX + ticker,
      JSON.stringify({ data, cachedAt: Date.now() } satisfies CacheEntry)
    );
  } catch {
    // quota cheia — segue sem cachear
  }
}

function isFresh(entry: CacheEntry | null): boolean {
  return Boolean(entry && Date.now() - entry.cachedAt < CACHE_TTL_MS);
}

export interface DividendCalendarState {
  /** 12 buckets com o total agregado de todos os tickers da carteira. */
  buckets: MonthBucket[];
  /** Projeção individual por ticker — útil para o detalhamento por mês. */
  byTicker: Record<string, MonthBucket[]>;
  /**
   * Histórico bruto de dividendos pagos por ticker (últimos 5 anos via Yahoo).
   * Cada item é um evento real `{date,amount}` — use para filtrar pagamentos
   * em janelas específicas (ex.: dividendos recebidos NA SEMANA atual no
   * digest semanal). Não confunda com `byTicker` que é projeção futura.
   */
  rawHistoryByTicker: Record<string, DividendEvent[]>;
  /** Soma anual projetada (R$). */
  annualTotal: number;
  loading: boolean;
  error: string | null;
  /** Refaz a busca ignorando o cache local. */
  refetch: () => Promise<void>;
}

type StockInput = Pick<Stock, "ticker" | "quantity">;

function emptyBuckets(): MonthBucket[] {
  // Mesma lógica de `projectDividends` quando history está vazio — gera 12 buckets zerados.
  return projectDividends({ ticker: "_", quantity: 0 }, []);
}

export function useDividendCalendar(stocks: StockInput[]): DividendCalendarState {
  const [byTicker, setByTicker] = useState<Record<string, MonthBucket[]>>({});
  const [rawHistoryByTicker, setRawHistoryByTicker] = useState<Record<string, DividendEvent[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Signature: ticker:quantity ordenados — invalida quando o usuário adiciona/remove ou muda qty.
  const signature = useMemo(
    () =>
      stocks
        .filter((s) => s.ticker && s.quantity > 0)
        .map((s) => `${s.ticker.toUpperCase()}:${s.quantity}`)
        .sort()
        .join("|"),
    [stocks]
  );

  const load = useCallback(
    async (forceRefresh: boolean) => {
      const active = stocks.filter((s) => s.ticker && s.quantity > 0);
      if (active.length === 0) {
        setByTicker({});
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const entries = await Promise.all(
          active.map(async (stock) => {
            const ticker = stock.ticker.toUpperCase();
            const cached = readCache(ticker);
            let history: DividendEvent[];
            if (!forceRefresh && isFresh(cached)) {
              history = cached!.data;
            } else {
              history = await fetchDividendHistory(ticker);
              writeCache(ticker, history);
            }
            if (controller.signal.aborted) return null;
            return [ticker, projectDividends(stock, history), history] as const;
          })
        );

        if (controller.signal.aborted) return;

        const nextProjection: Record<string, MonthBucket[]> = {};
        const nextHistory: Record<string, DividendEvent[]> = {};
        for (const entry of entries) {
          if (!entry) continue;
          nextProjection[entry[0]] = entry[1];
          nextHistory[entry[0]] = entry[2];
        }
        setByTicker(nextProjection);
        setRawHistoryByTicker(nextHistory);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Falha ao projetar dividendos.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [stocks]
  );

  // Dispara quando a signature da carteira muda.
  useEffect(() => {
    if (!signature) {
      setByTicker({});
      setRawHistoryByTicker({});
      return;
    }
    void load(false);
    return () => abortRef.current?.abort();
    // `load` depende de `stocks` mas só queremos reagir à mudança de signature
    // (semantic change). Por isso o eslint-disable abaixo é intencional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const buckets = useMemo<MonthBucket[]>(() => {
    const months = emptyBuckets();
    for (const projection of Object.values(byTicker)) {
      projection.forEach((b, i) => {
        if (months[i]) months[i].amount = Math.round((months[i].amount + b.amount) * 100) / 100;
      });
    }
    return months;
  }, [byTicker]);

  const annualTotal = useMemo(
    () => Math.round(buckets.reduce((acc, b) => acc + b.amount, 0) * 100) / 100,
    [buckets]
  );

  return {
    buckets,
    byTicker,
    rawHistoryByTicker,
    annualTotal,
    loading,
    error,
    refetch: () => load(true),
  };
}
