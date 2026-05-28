import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors } from "./_cors";
import { checkRateLimit } from "./_ratelimit";

// Aceita tickers B3 (PETR4, SANB11, KNRI11) e tickers US/ADR (AAPL, TSLA).
const TICKER_RE = /^([A-Z]{4}\d{1,2}|[A-Z]{1,5})$/;

/**
 * Proxy Yahoo Finance para histórico de dividendos.
 *
 * `GET /api/dividends?ticker=PETR4` → `{ ticker, history: [{date,amount}], generatedAt, source }`
 * Tenta `{TICKER}.SA` primeiro, fallback para o ticker puro (US).
 */

const YAHOO_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8",
  Referer: "https://finance.yahoo.com/",
  Origin: "https://finance.yahoo.com",
};

export interface DividendEvent {
  /** ISO date `YYYY-MM-DD` em UTC. */
  date: string;
  /** Valor pago por ação naquela data (R$ ou US$ conforme o ativo). */
  amount: number;
}

interface YahooChartDividend {
  amount?: number;
  date?: number;
}

interface YahooChartResult {
  events?: {
    dividends?: Record<string, YahooChartDividend>;
  };
}

interface YahooChartResponse {
  chart?: {
    result?: YahooChartResult[];
    error?: { code?: string; description?: string } | null;
  };
}

async function fetchYahooDividendsOnce(symbol: string): Promise<DividendEvent[] | "blocked" | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);
  try {
    // `range=5y` cobre cadência anual com 4-5 pontos; `interval=1mo` é o menor
    // que ainda traz a seção `events.dividends`. O Yahoo é tolerante a interval
    // grosso quando a query é só por events.
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5y&interval=1mo&events=div`;
    const res = await fetch(url, { signal: controller.signal, headers: YAHOO_HEADERS });
    if (res.status === 429 || res.status === 401 || res.status === 403) return "blocked";
    if (!res.ok) return null;
    const data = (await res.json()) as YahooChartResponse;
    const result = data.chart?.result?.[0];
    if (!result) return null;
    const dividends = result.events?.dividends ?? {};
    const events: DividendEvent[] = Object.values(dividends)
      .filter((d) => typeof d?.amount === "number" && typeof d?.date === "number")
      .map((d) => ({
        date: new Date((d.date as number) * 1000).toISOString().slice(0, 10),
        amount: d.amount as number,
      }))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return events;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchYahooDividends(ticker: string): Promise<DividendEvent[]> {
  // Mesma lógica de sufixo do `api/brapi.ts`: tenta `.SA` primeiro pra B3.
  const candidates =
    ticker.includes(".") || ticker.includes("-") ? [ticker] : [`${ticker}.SA`, ticker];

  for (const symbol of candidates) {
    const out = await fetchYahooDividendsOnce(symbol);
    if (out === "blocked") {
      console.warn(`[api/dividends] Yahoo bloqueou ${symbol} (rate-limit)`);
      continue;
    }
    if (out === null) continue;
    if (out.length > 0) return out;
    // Se retornou array vazio, ainda assim devolve — significa "ticker existe,
    // mas sem dividendos no período" (legítimo).
    return out;
  }
  return [];
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (applyCors(request, response, "GET, OPTIONS")) return;

  const rate = checkRateLimit(request, { windowMs: 60_000, max: 30 });
  if (!rate.allowed) {
    response.setHeader("Retry-After", String(rate.retryAfterSec));
    return response.status(429).json({ error: "rate-limited", retryAfterSec: rate.retryAfterSec });
  }

  try {
    const ticker = String(request.query.ticker || "").toUpperCase().trim();
    if (!ticker) {
      return response.status(400).json({
        error: "Forneça `ticker` (ex.: `?ticker=PETR4`).",
      });
    }
    if (!TICKER_RE.test(ticker)) {
      return response.status(400).json({
        error: "Ticker inválido. Use formato B3 (PETR4, SANB11) ou US (AAPL).",
      });
    }

    const history = await fetchYahooDividends(ticker);
    return response.status(200).json({
      ticker,
      history,
      generatedAt: new Date().toISOString(),
      source: "Yahoo Finance",
    });
  } catch (error) {
    console.error("[api/dividends] erro fatal:", error);
    return response.status(200).json({
      ticker: String(request.query.ticker || "").toUpperCase().trim(),
      history: [],
      error: "Indisponível no momento.",
      source: "Yahoo Finance",
    });
  }
}
