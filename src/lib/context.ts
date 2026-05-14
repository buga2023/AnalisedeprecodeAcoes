/**
 * Cliente de contexto extra para a IA — notícias e macroindicadores.
 * Tudo passa por proxies próprios (`/api/news`, `/api/macro`) e é injetado
 * nos prompts para que a Pra leve em conta o ambiente econômico, político
 * e social ao gerar sugestões.
 */

export interface NewsItem {
  titulo: string;
  link: string;
  fonte: string;
  publicado: string;
}

export interface NewsBundle {
  query: string;
  source: string;
  items: NewsItem[];
}

export interface MacroIndicator {
  valor: number | null;
  data: string | null;
  descricao: string;
}

export interface MacroContext {
  generatedAt: string;
  source: string;
  selicMeta: MacroIndicator;
  ipcaMensal: MacroIndicator;
  ipca12m: MacroIndicator;
  cdi12m: MacroIndicator;
  igpmMensal: MacroIndicator;
  ibcbr: MacroIndicator;
  ibovespa: { price: number | null; changePct: number | null; descricao: string };
  resumoParaPrompt: string;
}

/* ─── Notícias globais (GDELT + Google News multi-país + Reddit + BBC) ──── */

export interface WorldNewsItem {
  titulo: string;
  link: string;
  fonte: string;
  publicado: string;
  tom?: number;
  paises?: string[];
  origem: "gdelt" | "google-news" | "reddit" | "bbc";
}

export interface WorldNewsTopicBundle {
  topic: string;
  description: string;
  /** Por que esse tópico mexe com preço — pré-redigido pelo servidor. */
  arbitrageAngle: string;
  items: WorldNewsItem[];
}

export interface WorldNewsContext {
  generatedAt: string;
  refreshIntervalMs: number;
  source: string;
  resumoParaPrompt: string;
  topics: WorldNewsTopicBundle[];
}

const NEWS_CACHE_TTL_MS = 30 * 60 * 1000;
const MACRO_CACHE_TTL_MS = 30 * 60 * 1000;
const WORLD_NEWS_CACHE_TTL_MS = 30 * 60 * 1000; // cliente cacheia 30min, servidor 2h
const newsCache = new Map<string, { at: number; data: NewsBundle }>();
let macroCache: { at: number; data: MacroContext } | null = null;
let worldNewsCache: { at: number; data: WorldNewsContext | null } | null = null;

/** Busca notícias para um ticker (combina nome curto + sigla automaticamente). */
export async function fetchTickerNews(ticker: string, limit = 6): Promise<NewsBundle> {
  const key = `t:${ticker.toUpperCase()}:${limit}`;
  const cached = newsCache.get(key);
  if (cached && Date.now() - cached.at < NEWS_CACHE_TTL_MS) return cached.data;
  try {
    const url = `/api/news?ticker=${encodeURIComponent(ticker)}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) return { query: ticker, source: "Google News RSS", items: [] };
    const data = (await res.json()) as NewsBundle;
    newsCache.set(key, { at: Date.now(), data });
    return data;
  } catch {
    return { query: ticker, source: "Google News RSS", items: [] };
  }
}

export type NewsTopic = "brasil" | "politica" | "economia" | "mundo" | "crise" | "fiscal";

/** Notícias por tema (brasil | politica | economia | mundo | crise | fiscal). */
export async function fetchTopicNews(topic: NewsTopic, limit = 6): Promise<NewsBundle> {
  const key = `topic:${topic}:${limit}`;
  const cached = newsCache.get(key);
  if (cached && Date.now() - cached.at < NEWS_CACHE_TTL_MS) return cached.data;
  try {
    const url = `/api/news?topic=${encodeURIComponent(topic)}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) return { query: topic, source: "Google News RSS", items: [] };
    const data = (await res.json()) as NewsBundle;
    newsCache.set(key, { at: Date.now(), data });
    return data;
  } catch {
    return { query: topic, source: "Google News RSS", items: [] };
  }
}

/**
 * Notícias globais agregadas pelo /api/world-news (GDELT + Google News
 * multi-país + Reddit + BBC). Refresh a cada 2h via Vercel Cron; cliente
 * cacheia 30min para evitar tráfego desnecessário entre páginas.
 */
export async function fetchWorldNews(): Promise<WorldNewsContext | null> {
  if (worldNewsCache && Date.now() - worldNewsCache.at < WORLD_NEWS_CACHE_TTL_MS) {
    return worldNewsCache.data;
  }
  try {
    const res = await fetch("/api/world-news");
    if (!res.ok) {
      worldNewsCache = { at: Date.now(), data: null };
      return null;
    }
    const data = (await res.json()) as WorldNewsContext;
    worldNewsCache = { at: Date.now(), data };
    return data;
  } catch {
    return null;
  }
}

/** Indicadores macro (SELIC, IPCA, CDI, IBC-Br, Ibovespa). Cache 30min. */
export async function fetchMacroContext(): Promise<MacroContext | null> {
  if (macroCache && Date.now() - macroCache.at < MACRO_CACHE_TTL_MS) return macroCache.data;
  try {
    const res = await fetch("/api/macro");
    if (!res.ok) return null;
    const data = (await res.json()) as MacroContext;
    macroCache = { at: Date.now(), data };
    return data;
  } catch {
    return null;
  }
}

/**
 * Constrói um bloco de texto pronto para colar em prompts de IA. Inclui
 * macro + manchetes recentes com URLs (a IA pode usar como `fontes`).
 */
export function buildContextBlock(args: {
  macro: MacroContext | null;
  news: NewsBundle[];
  worldNews?: WorldNewsContext | null;
}): string {
  const parts: string[] = [];

  if (args.macro && args.macro.resumoParaPrompt) {
    parts.push(
      `=== CONTEXTO MACROECONÔMICO BRASIL (fonte: ${args.macro.source}) ===\n${args.macro.resumoParaPrompt}\n=== FIM MACRO ===`
    );
  }

  if (args.worldNews && Array.isArray(args.worldNews.topics) && args.worldNews.topics.length > 0) {
    const blocks: string[] = [];
    for (const t of args.worldNews.topics) {
      if (!t.items || t.items.length === 0) continue;
      const lines = t.items
        .slice(0, 5)
        .map(
          (n, i) =>
            `  [${i + 1}] ${n.titulo}${n.fonte ? ` — ${n.fonte}` : ""}${n.publicado ? ` (${n.publicado})` : ""}${
              n.tom !== undefined ? ` [tom=${n.tom.toFixed(2)}]` : ""
            }\n      ${n.link}`
        )
        .join("\n");
      blocks.push(
        `▸ ${t.topic.toUpperCase()} — ${t.description}\n  Ângulo de arbitragem: ${t.arbitrageAngle}\n${lines}`
      );
    }
    if (blocks.length > 0) {
      parts.push(
        `=== NOTÍCIAS GLOBAIS DE POLÍTICA E MACRO (fonte: ${args.worldNews.source}) ===\n${blocks.join(
          "\n\n"
        )}\n=== FIM NOTÍCIAS GLOBAIS ===`
      );
    }
  }

  for (const bundle of args.news) {
    if (!bundle.items || bundle.items.length === 0) continue;
    const lines = bundle.items
      .slice(0, 5)
      .map(
        (n, i) =>
          `[${i + 1}] ${n.titulo}${n.fonte ? ` — ${n.fonte}` : ""}${n.publicado ? ` (${n.publicado})` : ""}\n    ${n.link}`
      )
      .join("\n");
    parts.push(
      `=== NOTÍCIAS RECENTES (fonte: ${bundle.source}) — query "${bundle.query}" ===\n${lines}\n=== FIM NOTÍCIAS ===`
    );
  }

  return parts.join("\n\n");
}

/** Retorna a lista de URLs únicas das notícias para a IA citar como fontes. */
export function newsUrlsFromBundles(bundles: NewsBundle[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const b of bundles) {
    for (const item of b.items) {
      if (item.link && !seen.has(item.link)) {
        seen.add(item.link);
        out.push(item.link);
      }
    }
  }
  return out;
}

/** URLs únicas das notícias globais (todos os tópicos do /api/world-news). */
export function urlsFromWorldNews(wn: WorldNewsContext | null): string[] {
  if (!wn) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const topic of wn.topics) {
    for (const item of topic.items) {
      if (item.link && !seen.has(item.link)) {
        seen.add(item.link);
        out.push(item.link);
      }
    }
  }
  return out;
}
