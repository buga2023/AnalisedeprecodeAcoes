import { useCallback, useEffect, useRef, useState } from "react";
import {
  analisarNoticiasAcao,
  getCachedStockNews,
  type StockNewsAnalysis,
} from "@/lib/stockNews";
import type { InvestorProfile } from "@/types/stock";

export interface UseStockNewsResult {
  analysis: StockNewsAnalysis | null;
  loading: boolean;
  error: string | null;
  /** Roda a IA — chamado pelo botão "Carregar análise". */
  load: () => Promise<void>;
  /** Força regeneração ignorando cache. */
  refresh: () => Promise<void>;
  /** Indica se a leitura veio do cache (sem hit de IA). */
  fromCache: boolean;
}

/**
 * Notícias por ação + sentimento via IA. Não dispara automaticamente — usuário
 * clica em "Carregar análise" pra evitar gastar token em cada tela aberta.
 * Quando há cache válido (1h), entrega de imediato sem chamar a rede.
 */
export function useStockNews(
  ticker: string,
  profile: InvestorProfile | null
): UseStockNewsResult {
  const [analysis, setAnalysis] = useState<StockNewsAnalysis | null>(() =>
    getCachedStockNews(ticker)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(() => getCachedStockNews(ticker) !== null);
  const mountedTicker = useRef(ticker);

  // Quando o usuário troca de ticker dentro da mesma sessão, reseta o estado e
  // tenta cache imediato.
  useEffect(() => {
    if (mountedTicker.current === ticker) return;
    mountedTicker.current = ticker;
    const cached = getCachedStockNews(ticker);
    setAnalysis(cached);
    setFromCache(cached !== null);
    setError(null);
    setLoading(false);
  }, [ticker]);

  const run = useCallback(
    async (ignoreCache: boolean) => {
      setLoading(true);
      setError(null);
      try {
        if (ignoreCache) {
          // limpa cache localmente — analisarNoticiasAcao reescreve se sucesso
          try {
            localStorage.removeItem(`praxia-stock-news:${ticker.toUpperCase()}`);
          } catch {
            /* ignore */
          }
        }
        const result = await analisarNoticiasAcao(ticker, profile);
        setAnalysis(result);
        setFromCache(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao analisar notícias.");
      } finally {
        setLoading(false);
      }
    },
    [ticker, profile]
  );

  const load = useCallback(() => run(false), [run]);
  const refresh = useCallback(() => run(true), [run]);

  return { analysis, loading, error, load, refresh, fromCache };
}
