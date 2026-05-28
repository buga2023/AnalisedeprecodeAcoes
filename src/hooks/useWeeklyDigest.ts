import { useCallback, useEffect, useMemo, useState } from "react";
import type { DividendEvent } from "@/lib/dividends";
import { assembleDigestContext } from "@/lib/digest";
import { gerarDigestSemanal } from "@/lib/aiDigest";
import { getISOWeekString } from "@/lib/isoWeek";
import type {
  InvestorProfile,
  PriceAlert,
  Stock,
  Transaction,
  WeeklyDigest,
} from "@/types/stock";

/**
 * Hook do digest semanal — gera o resumo da semana ANTERIOR sob demanda
 * (custo de IA), com cache por ISO-week. Lazy: nunca dispara automaticamente.
 *
 * Recebe os dados como inputs (em vez de chamar useStockQuotes/useTransactions
 * internamente) para nao duplicar polling/fetches da app — o owner (geralmente
 * `PraxiaApp`/`ScreenHome`) ja tem essas hooks ativas.
 */

const CACHE_KEY_PREFIX = "praxia-digest:";
const CACHE_TTL_MS = 8 * 24 * 60 * 60 * 1000;

function readCache(isoWeek: string): WeeklyDigest | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + isoWeek);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WeeklyDigest;
    if (!parsed?.generatedAt || parsed.isoWeek !== isoWeek) return null;
    if (Date.now() - parsed.generatedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(isoWeek: string, digest: WeeklyDigest) {
  try {
    localStorage.setItem(CACHE_KEY_PREFIX + isoWeek, JSON.stringify(digest));
  } catch {
    /* quota cheia */
  }
}

export interface WeeklyDigestInputs {
  stocks: Stock[];
  transactions: Transaction[];
  /**
   * Histórico bruto de dividendos pagos por ticker. Vem de
   * `useDividendCalendar(stocks).rawHistoryByTicker`. Pode ser `{}` enquanto
   * carrega — o digest segue mostrando o que tem.
   */
  dividendHistoryByTicker: Record<string, DividendEvent[]>;
  triggeredAlerts: PriceAlert[];
  profile: InvestorProfile | null;
}

export interface UseWeeklyDigestResult {
  digest: WeeklyDigest | null;
  loading: boolean;
  error: string | null;
  fromCache: boolean;
  /** True quando ja existe digest da semana atual em cache. */
  isFresh: boolean;
  /** True quando carteira tem ≥1 stock com posicao. */
  canGenerate: boolean;
  /** Chave ISO da semana que SERA resumida (a anterior). */
  isoWeek: string;
  generate: () => Promise<void>;
  /** Regenera ignorando cache. */
  regenerate: () => Promise<void>;
}

export function useWeeklyDigest(inputs: WeeklyDigestInputs): UseWeeklyDigestResult {
  const { stocks, transactions, dividendHistoryByTicker, triggeredAlerts, profile } = inputs;

  // O digest cobre a semana anterior. ISO-week e calculada a partir de
  // (hoje - 7d), entao no domingo a chave ja avanca pra a "ultima semana".
  const isoWeek = useMemo(() => {
    const ref = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return getISOWeekString(ref);
  }, []);

  const canGenerate = useMemo(() => stocks.some((s) => s.quantity > 0), [stocks]);

  const [digest, setDigest] = useState<WeeklyDigest | null>(() => readCache(isoWeek));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState<boolean>(() => readCache(isoWeek) !== null);

  // Sempre que muda a semana (passou domingo), tenta recarregar o cache.
  useEffect(() => {
    const cached = readCache(isoWeek);
    if (cached) {
      setDigest(cached);
      setFromCache(true);
    } else {
      setDigest(null);
      setFromCache(false);
    }
  }, [isoWeek]);

  const run = useCallback(
    async (forceRefresh: boolean) => {
      if (!canGenerate) {
        setError("Adicione ações com posição na carteira para gerar o digest.");
        return;
      }
      if (!forceRefresh) {
        const cached = readCache(isoWeek);
        if (cached) {
          setDigest(cached);
          setFromCache(true);
          return;
        }
      }
      setLoading(true);
      setError(null);
      setFromCache(false);
      try {
        const ctx = assembleDigestContext({
          stocks,
          transactions,
          dividendHistoryByTicker,
          triggeredAlerts,
        });
        const result = await gerarDigestSemanal(ctx, profile);
        setDigest(result);
        writeCache(isoWeek, result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao gerar o digest.");
      } finally {
        setLoading(false);
      }
    },
    [canGenerate, isoWeek, stocks, transactions, dividendHistoryByTicker, triggeredAlerts, profile]
  );

  return {
    digest,
    loading,
    error,
    fromCache,
    isFresh: digest !== null && digest.isoWeek === isoWeek,
    canGenerate,
    isoWeek,
    generate: () => run(false),
    regenerate: () => run(true),
  };
}
