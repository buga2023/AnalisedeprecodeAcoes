import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Proxy de notícias via Google News RSS — sem API key. Aceita `?ticker=PETR4`
 * (faz query com nome curto + "B3" / "ações"), `?q=<texto>` para tema livre,
 * ou `?topic=brasil` / `?topic=economia` para feeds gerais. Retorna até 8
 * manchetes com data + URL para o modelo poder citar como fonte.
 */

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
};

/** Algumas equivalências comuns entre ticker e nome curto da empresa. */
const TICKER_TO_NAME: Record<string, string> = {
  PETR3: "Petrobras",
  PETR4: "Petrobras",
  VALE3: "Vale",
  ITUB3: "Itau",
  ITUB4: "Itau",
  BBDC3: "Bradesco",
  BBDC4: "Bradesco",
  BBAS3: "Banco do Brasil",
  ABEV3: "Ambev",
  MGLU3: "Magazine Luiza",
  WEGE3: "WEG",
  RENT3: "Localiza",
  SUZB3: "Suzano",
  GGBR4: "Gerdau",
  B3SA3: "B3",
  TAEE11: "Taesa",
  ELET3: "Eletrobras",
  ELET6: "Eletrobras",
  PRIO3: "PetroRio",
  RADL3: "Raia Drogasil",
  LREN3: "Lojas Renner",
  JBSS3: "JBS",
  EMBR3: "Embraer",
  RAIL3: "Rumo",
  EQTL3: "Equatorial",
  VIVT3: "Vivo",
  TOTS3: "Totvs",
  HYPE3: "Hypera",
  UGPA3: "Ultrapar",
  COGN3: "Cogna",
  CSNA3: "CSN",
  CPLE6: "Copel",
  AAPL: "Apple",
  MSFT: "Microsoft",
  GOOGL: "Alphabet Google",
  AMZN: "Amazon",
  META: "Meta Platforms",
  NVDA: "Nvidia",
  TSLA: "Tesla",
  NFLX: "Netflix",
};

interface NewsItem {
  titulo: string;
  link: string;
  fonte: string;
  publicado: string;
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

function parseGoogleNewsRSS(xml: string, maxItems = 8): NewsItem[] {
  const items: NewsItem[] = [];
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

async function fetchRSS(query: string, hl = "pt-BR", gl = "BR"): Promise<NewsItem[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${gl}:${hl.split("-")[0]}`;
    const res = await fetch(url, { headers: BROWSER_HEADERS, signal: controller.signal });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseGoogleNewsRSS(xml);
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildTickerQuery(ticker: string): string {
  const t = ticker.toUpperCase();
  const name = TICKER_TO_NAME[t];
  // Quanto mais específico, melhor — combina nome curto com a sigla.
  if (name) return `"${name}" OR "${t}" B3 ações`;
  return `${t} ações`;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Content-Type", "application/json");

  if (request.method === "OPTIONS") return response.status(204).end();

  try {
    const ticker = String(request.query.ticker || "").toUpperCase().trim();
    const q = String(request.query.q || "").trim();
    const topic = String(request.query.topic || "").trim().toLowerCase();
    const limit = Math.min(12, Math.max(1, Number(request.query.limit) || 8));

    let query: string;
    if (ticker) {
      query = buildTickerQuery(ticker);
    } else if (q) {
      query = q;
    } else if (topic) {
      query =
        topic === "brasil"
          ? "Brasil economia mercado financeiro"
          : topic === "politica"
          ? "Brasil política eleições Congresso governo"
          : topic === "economia"
          ? "economia Brasil Selic IPCA inflação Banco Central"
          : topic === "mundo"
          ? "macroeconomia global mercados Fed BCE"
          : topic === "crise" || topic === "crises"
          ? "crise geopolítica conflito guerra sanções tarifa choque petróleo recessão"
          : topic === "fiscal"
          ? "Brasil arcabouço fiscal dívida pública déficit primário risco fiscal"
          : topic;
    } else {
      return response.status(400).json({
        error:
          "Forneça `ticker`, `q` (busca livre) ou `topic` (brasil|politica|economia|mundo).",
      });
    }

    const items = await fetchRSS(query);
    return response.status(200).json({
      query,
      source: "Google News RSS",
      generatedAt: new Date().toISOString(),
      items: items.slice(0, limit),
    });
  } catch (error) {
    console.error("[api/news] erro fatal:", error);
    return response.status(200).json({ items: [], error: "Indisponível no momento." });
  }
}
