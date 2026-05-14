import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * AGGREGADOR DE NOTÍCIAS GLOBAIS — sem chave, sem custo.
 *
 * Combina APIs públicas grátis pra dar à IA contexto político/macro mundial
 * acionável (foco em movimentos que mexem com preço de ativos: tarifas, Fed,
 * China, conflitos, commodities). Refresh a cada 2 horas via cache em memória
 * + Vercel Cron (`vercel.json`).
 *
 * Fontes (todas gratuitas, sem token):
 *   1. GDELT 2.0 Doc API       — eventos políticos globais com tom/locais.
 *      https://api.gdeltproject.org/api/v2/doc/doc
 *   2. Google News RSS         — manchetes multi-país (US, UK, DE, JP, CN).
 *      https://news.google.com/rss/search
 *   3. Reddit r/worldnews JSON — agregação social com upvotes (proxy de relevância).
 *      https://www.reddit.com/r/worldnews/top/.json
 *   4. BBC RSS politics        — feed institucional para checagem cruzada.
 *      https://feeds.bbci.co.uk/news/world/politics/rss.xml
 */

const FETCH_TIMEOUT_MS = 7000;
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 horas

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, application/rss+xml, application/xml;q=0.9, */*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8",
};

interface NewsItem {
  titulo: string;
  link: string;
  fonte: string;
  publicado: string;
  /** Tom / sentimento normalizado [-1..1] quando disponível (GDELT). */
  tom?: number;
  /** Países mencionados (códigos ISO ou CountryName) quando disponível. */
  paises?: string[];
  /** Origem do feed para a UI poder filtrar/agrupar. */
  origem: "gdelt" | "google-news" | "reddit" | "bbc";
}

interface TopicBundle {
  topic: string;
  description: string;
  /** Por que esse tópico mexe com preço de ativos. */
  arbitrageAngle: string;
  items: NewsItem[];
}

interface WorldNewsResponse {
  generatedAt: string;
  refreshIntervalMs: number;
  source: string;
  /** Resumo curto para colar direto no prompt do modelo. */
  resumoParaPrompt: string;
  topics: TopicBundle[];
}

/* ─── Utils ───────────────────────────────────────────────────────────── */

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response | null> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, headers: { ...BROWSER_HEADERS, ...init?.headers } });
  } catch {
    return null;
  } finally {
    clearTimeout(tid);
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function unwrapCdata(s: string): string {
  const m = s.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return m ? m[1] : s;
}

/* ─── Fonte 1: GDELT 2.0 ──────────────────────────────────────────────── */

async function fetchGdelt(query: string, maxRecords = 8): Promise<NewsItem[]> {
  const url =
    "https://api.gdeltproject.org/api/v2/doc/doc?" +
    new URLSearchParams({
      query,
      mode: "ArtList",
      format: "json",
      maxrecords: String(maxRecords),
      sort: "DateDesc",
      timespan: "48h",
    }).toString();
  const res = await fetchWithTimeout(url);
  if (!res || !res.ok) return [];
  try {
    const data = (await res.json()) as { articles?: GdeltArticle[] };
    const arts = Array.isArray(data.articles) ? data.articles : [];
    return arts.map<NewsItem>((a) => ({
      titulo: a.title || "",
      link: a.url || "",
      fonte: a.domain || "GDELT",
      publicado: a.seendate || "",
      tom: typeof a.tone === "number" ? Math.max(-1, Math.min(1, a.tone / 10)) : undefined,
      paises: typeof a.sourcecountry === "string" ? [a.sourcecountry] : undefined,
      origem: "gdelt",
    })).filter((n) => n.titulo && n.link);
  } catch {
    return [];
  }
}

interface GdeltArticle {
  url?: string;
  title?: string;
  seendate?: string;
  domain?: string;
  tone?: number;
  sourcecountry?: string;
}

/* ─── Fonte 2: Google News RSS multi-país ─────────────────────────────── */

function parseGoogleNewsRSS(xml: string, maxItems = 8): Omit<NewsItem, "origem">[] {
  const items: Omit<NewsItem, "origem">[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) && items.length < maxItems) {
    const block = m[1];
    const titulo = decodeEntities(
      unwrapCdata(/<title>([\s\S]*?)<\/title>/.exec(block)?.[1] ?? "")
    ).trim();
    const link = decodeEntities(
      unwrapCdata(/<link>([\s\S]*?)<\/link>/.exec(block)?.[1] ?? "")
    ).trim();
    const fonte = decodeEntities(
      unwrapCdata(/<source[^>]*>([\s\S]*?)<\/source>/.exec(block)?.[1] ?? "")
    ).trim();
    const publicado = (/<pubDate>([\s\S]*?)<\/pubDate>/.exec(block)?.[1] ?? "").trim();
    if (titulo && link) items.push({ titulo, link, fonte, publicado });
  }
  return items;
}

async function fetchGoogleNews(query: string, hl: string, gl: string, max = 6): Promise<NewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${gl}:${hl.split("-")[0]}`;
  const res = await fetchWithTimeout(url);
  if (!res || !res.ok) return [];
  const xml = await res.text();
  return parseGoogleNewsRSS(xml, max).map((n) => ({ ...n, origem: "google-news" as const }));
}

/* ─── Fonte 3: Reddit r/worldnews JSON ────────────────────────────────── */

async function fetchReddit(subreddit: string, max = 6): Promise<NewsItem[]> {
  const url = `https://www.reddit.com/r/${subreddit}/top/.json?limit=${max}&t=day`;
  const res = await fetchWithTimeout(url, {
    headers: { "User-Agent": "praxia-bot/1.0 (financial-news-aggregator)" },
  });
  if (!res || !res.ok) return [];
  try {
    interface RedditChild {
      data: { title?: string; url?: string; permalink?: string; subreddit?: string; created_utc?: number };
    }
    const data = (await res.json()) as { data?: { children?: RedditChild[] } };
    const children = data?.data?.children ?? [];
    return children
      .map<NewsItem | null>((c) => {
        const d = c.data;
        if (!d || !d.title) return null;
        return {
          titulo: d.title,
          link: d.url || `https://www.reddit.com${d.permalink ?? ""}`,
          fonte: `r/${d.subreddit ?? subreddit}`,
          publicado: d.created_utc ? new Date(d.created_utc * 1000).toUTCString() : "",
          origem: "reddit",
        };
      })
      .filter((x): x is NewsItem => x !== null);
  } catch {
    return [];
  }
}

/* ─── Fonte 4: BBC RSS ────────────────────────────────────────────────── */

async function fetchBBC(): Promise<NewsItem[]> {
  const url = "https://feeds.bbci.co.uk/news/world/politics/rss.xml";
  const res = await fetchWithTimeout(url);
  if (!res || !res.ok) return [];
  const xml = await res.text();
  return parseGoogleNewsRSS(xml, 6).map((n) => ({
    ...n,
    fonte: n.fonte || "BBC",
    origem: "bbc" as const,
  }));
}

/* ─── Definição dos tópicos com ângulo de arbitragem ─────────────────── */

interface TopicSpec {
  topic: string;
  description: string;
  arbitrageAngle: string;
  gdeltQuery: string;
  googleQueries: { q: string; hl: string; gl: string }[];
}

const TOPICS: TopicSpec[] = [
  {
    topic: "geopolitica",
    description: "Conflitos, tensões e movimentos militares com impacto em commodities e câmbio.",
    arbitrageAngle:
      "Conflito → petróleo (PETR4/PRIO3), ouro, dólar; sanções → exportadoras; estabilização → risco-on volta.",
    gdeltQuery: '(conflict OR war OR sanctions OR ceasefire OR geopolitical) sourcelang:eng',
    googleQueries: [
      { q: "geopolitical risk markets", hl: "en", gl: "US" },
      { q: "conflict oil price Russia Middle East", hl: "en", gl: "GB" },
    ],
  },
  {
    topic: "politica-eua",
    description: "Fed, tarifas dos EUA, eleições americanas — drivers globais.",
    arbitrageAngle:
      "Tarifas EUA → exportadoras BR sofrem (siderurgia, agro); Fed dovish → fluxo p/ emergentes (BOVA11, BBAS3); shutdown/teto da dívida → curva DI BR.",
    gdeltQuery: '(Fed OR "Federal Reserve" OR tariff OR "U.S. election" OR Congress) sourcelang:eng',
    googleQueries: [
      { q: "Federal Reserve rate decision tariffs", hl: "en", gl: "US" },
      { q: "US election market impact", hl: "en", gl: "US" },
    ],
  },
  {
    topic: "china",
    description: "Estímulos chineses, propriedade, exportações, política Taiwan.",
    arbitrageAngle:
      "Estímulo chinês → mineradoras (VALE3), siderurgia (CSNA3, GGBR4); crise imobiliária → minério; tensão Taiwan → semicondutores, defesa.",
    gdeltQuery: "(China OR Beijing OR Taiwan OR Xi Jinping OR PBOC) sourcelang:eng",
    googleQueries: [
      { q: "China stimulus property iron ore", hl: "en", gl: "US" },
      { q: "China economy policy", hl: "en", gl: "GB" },
    ],
  },
  {
    topic: "commodities",
    description: "Petróleo OPEP, minério de ferro, soja, café, ouro.",
    arbitrageAngle:
      "OPEP corta → PETR4/PRIO3 sobem; minério cai → VALE3 sofre; soja sobe → SLCE3/AGRO3; ouro como hedge cambial.",
    gdeltQuery: '(OPEC OR "iron ore" OR soybean OR "crude oil" OR commodity) sourcelang:eng',
    googleQueries: [
      { q: "OPEC oil production cut", hl: "en", gl: "US" },
      { q: "iron ore price China demand", hl: "en", gl: "US" },
    ],
  },
  {
    topic: "brasil-fiscal",
    description: "Política fiscal, arcabouço, dívida, eleições e Congresso brasileiro.",
    arbitrageAngle:
      "Risco fiscal piora → dólar sobe, curva DI abre, bancos sofrem (juro real alto pesa em PL); medidas pro-mercado → ações brasileiras gerais sobem.",
    gdeltQuery: "(Brazil fiscal OR Lula OR Haddad OR Congresso OR \"arcabouço fiscal\") (sourcelang:eng OR sourcelang:por)",
    googleQueries: [
      { q: "Brasil arcabouço fiscal dívida pública", hl: "pt-BR", gl: "BR" },
      { q: "Brazil fiscal risk markets", hl: "en", gl: "US" },
    ],
  },
];

/* ─── Cache em memória + builder ──────────────────────────────────────── */

let cache: { at: number; payload: WorldNewsResponse } | null = null;

async function buildBundle(spec: TopicSpec): Promise<TopicBundle> {
  // Roda as fontes em paralelo, deduplica por URL, ordena por relevância.
  const [gdelt, googlePerRegion] = await Promise.all([
    fetchGdelt(spec.gdeltQuery, 6),
    Promise.all(spec.googleQueries.map((q) => fetchGoogleNews(q.q, q.hl, q.gl, 4))),
  ]);
  const allGoogle = googlePerRegion.flat();
  const merged = dedupeByLink([...gdelt, ...allGoogle]);
  return {
    topic: spec.topic,
    description: spec.description,
    arbitrageAngle: spec.arbitrageAngle,
    items: merged.slice(0, 10),
  };
}

function dedupeByLink(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const it of items) {
    if (!it.link || seen.has(it.link)) continue;
    seen.add(it.link);
    out.push(it);
  }
  return out;
}

function buildResumo(topics: TopicBundle[]): string {
  // Resumo de 4-6 linhas que o servidor cola direto no prompt da IA.
  const parts: string[] = [];
  for (const t of topics) {
    if (t.items.length === 0) continue;
    const head = t.items[0];
    parts.push(`[${t.topic}] ${head.titulo} (${head.fonte}) — ângulo: ${t.arbitrageAngle}`);
  }
  return parts.join("\n");
}

async function refreshCache(): Promise<WorldNewsResponse> {
  const [bundles, reddit, bbc] = await Promise.all([
    Promise.all(TOPICS.map(buildBundle)),
    fetchReddit("worldnews", 5),
    fetchBBC(),
  ]);
  // Reddit e BBC entram como "geral" — concatena no primeiro tópico (geopolítica).
  if (bundles[0] && (reddit.length > 0 || bbc.length > 0)) {
    bundles[0].items = dedupeByLink([...bundles[0].items, ...reddit, ...bbc]).slice(0, 14);
  }
  const payload: WorldNewsResponse = {
    generatedAt: new Date().toISOString(),
    refreshIntervalMs: CACHE_TTL_MS,
    source:
      "GDELT 2.0 + Google News RSS (multi-país) + Reddit r/worldnews + BBC Politics",
    resumoParaPrompt: buildResumo(bundles),
    topics: bundles,
  };
  cache = { at: Date.now(), payload };
  return payload;
}

/* ─── Handler ─────────────────────────────────────────────────────────── */

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Content-Type", "application/json");

  if (request.method === "OPTIONS") return response.status(204).end();

  try {
    const forceRefresh = String(request.query.refresh || "") === "1";
    const isCronCall = !!request.headers["x-vercel-cron"]; // Vercel manda esse header em chamadas de cron

    if (!forceRefresh && !isCronCall && cache && Date.now() - cache.at < CACHE_TTL_MS) {
      response.setHeader("X-Cache", "HIT");
      response.setHeader("X-Cache-Age", String(Math.floor((Date.now() - cache.at) / 1000)));
      return response.status(200).json(cache.payload);
    }

    const payload = await refreshCache();
    response.setHeader("X-Cache", forceRefresh ? "BYPASS" : isCronCall ? "CRON" : "MISS");
    return response.status(200).json(payload);
  } catch (error) {
    console.error("[api/world-news] erro fatal:", error);
    if (cache) return response.status(200).json(cache.payload);
    return response.status(200).json({
      generatedAt: new Date().toISOString(),
      refreshIntervalMs: CACHE_TTL_MS,
      source: "indisponível",
      resumoParaPrompt: "",
      topics: [],
    });
  }
}
