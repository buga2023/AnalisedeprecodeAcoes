import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchRegulatoryNews,
  fetchTickerNews,
  fetchWorldNews,
  type NewsItem,
  type WorldNewsContext,
  type WorldNewsItem,
} from "@/lib/context";
import { scoreFeed, type ScoredFeedEntry, type RelevanceContext } from "@/lib/newsRelevance";
import { dominantSector } from "@/lib/portfolio";
import type { InvestorProfile, Stock } from "@/types/stock";

const TICKER_TOPIC = "carteira";
const TICKER_TOPIC_LABEL = "Carteira";
const REGULATORY_TOPIC = "regulatorio";
const REGULATORY_TOPIC_LABEL = "Fato relevante";
const MAX_TICKERS_TO_QUERY = 5;
const MIN_RELEVANCE_FOR_YOU = 30;

export interface UseNewsFeedResult {
  /** Itens ranqueados (todos). UI filtra por pill quando necessário. */
  items: ScoredFeedEntry[];
  /** Subconjunto com score >= MIN_RELEVANCE_FOR_YOU — "Para você". */
  personalItems: ScoredFeedEntry[];
  /** Mantido pra UI continuar mostrando as pills de tópico do agregador. */
  worldData: WorldNewsContext | null;
  isLoading: boolean;
  error: string | null;
  refresh: (force?: boolean) => Promise<void>;
}

interface RawEntry {
  item: WorldNewsItem;
  topic: string;
  topicLabel: string;
}

function tickerNewsItemToWorld(item: NewsItem): WorldNewsItem {
  return {
    titulo: item.titulo,
    link: item.link,
    fonte: item.fonte,
    publicado: item.publicado,
    origem: "google-news",
  };
}

/**
 * Feed unificado: combina /api/world-news (agregador GDELT/Reddit/BBC) com
 * /api/news?ticker=... pra cada ticker top da carteira, deduplica por link e
 * ranqueia pelo score em src/lib/newsRelevance.ts (perfil + carteira + setor).
 */
export function useNewsFeed(
  profile: InvestorProfile | null,
  stocks: Stock[]
): UseNewsFeedResult {
  const [worldData, setWorldData] = useState<WorldNewsContext | null>(null);
  const [tickerEntries, setTickerEntries] = useState<RawEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const topTickers = useMemo(
    () => stocks.slice(0, MAX_TICKERS_TO_QUERY).map((s) => s.ticker.toUpperCase()),
    [stocks]
  );
  const tickersKey = topTickers.join(",");

  const load = useCallback(
    async (force = false) => {
      setIsLoading(true);
      setError(null);
      try {
        const worldPromise = force
          ? fetch("/api/world-news?refresh=1")
              .then((r) => (r.ok ? (r.json() as Promise<WorldNewsContext>) : null))
              .catch(() => null)
          : fetchWorldNews();

        const tickerPromise = Promise.all(
          topTickers.map((t) =>
            fetchTickerNews(t, 5).then((bundle) => ({
              ticker: t,
              items: bundle.items ?? [],
            }))
          )
        );

        const regulatoryPromise = Promise.all(
          topTickers.map((t) =>
            fetchRegulatoryNews(t, 4).then((bundle) => ({
              ticker: t,
              items: bundle.items ?? [],
            }))
          )
        );

        const [world, perTicker, perTickerReg] = await Promise.all([
          worldPromise,
          tickerPromise,
          regulatoryPromise,
        ]);
        setWorldData(world);

        const flat: RawEntry[] = [];
        for (const { items } of perTicker) {
          for (const it of items) {
            flat.push({
              item: tickerNewsItemToWorld(it),
              topic: TICKER_TOPIC,
              topicLabel: TICKER_TOPIC_LABEL,
            });
          }
        }
        for (const { items } of perTickerReg) {
          for (const it of items) {
            flat.push({
              item: tickerNewsItemToWorld(it),
              topic: REGULATORY_TOPIC,
              topicLabel: REGULATORY_TOPIC_LABEL,
            });
          }
        }
        setTickerEntries(flat);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao carregar notícias.");
      } finally {
        setIsLoading(false);
      }
    },
    // Depende dos tickers atuais; tickersKey é estável-por-conteúdo.
    // topTickers é derivado por useMemo e pode ser usado tranquilamente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tickersKey]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const dominantSectorLabel = useMemo(() => dominantSector(stocks)?.label ?? null, [stocks]);

  const items = useMemo<ScoredFeedEntry[]>(() => {
    const all: RawEntry[] = [...tickerEntries];
    if (worldData?.topics) {
      for (const bundle of worldData.topics) {
        for (const it of bundle.items) {
          all.push({ item: it, topic: bundle.topic, topicLabel: bundle.topic });
        }
      }
    }
    const seen = new Set<string>();
    const deduped = all.filter((e) => {
      if (!e.item.link) return false;
      if (seen.has(e.item.link)) return false;
      seen.add(e.item.link);
      return true;
    });
    const ctx: RelevanceContext = { profile, stocks, dominantSectorLabel };
    return scoreFeed(deduped, ctx);
  }, [tickerEntries, worldData, profile, stocks, dominantSectorLabel]);

  const personalItems = useMemo(
    () => items.filter((e) => e.score >= MIN_RELEVANCE_FOR_YOU),
    [items]
  );

  return { items, personalItems, worldData, isLoading, error, refresh: load };
}
