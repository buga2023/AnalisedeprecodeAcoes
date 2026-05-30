import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors } from './_cors';
import { checkRateLimit } from './_ratelimit';

const FONTES = {
  investidor10: (t: string) => `https://investidor10.com.br/fiis/${t.toLowerCase()}/`,
  statusinvest: (t: string) => `https://statusinvest.com.br/fundos-imobiliarios/${t.toLowerCase()}`,
};

function headersFor(target: string): Record<string, string> {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
    Referer: target.includes("investidor10") ? "https://investidor10.com.br/" : "https://statusinvest.com.br/",
    "Sec-Fetch-Dest": "document", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Site": "same-origin",
    "Upgrade-Insecure-Requests": "1",
  };
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 8000);
}

export interface FIIFields {
  vacancyRate?: number;
  dividendYield?: number; // em %
  segment?: string;
}

/** Extrai campos estruturados do texto da página de um FII. Puro e testável. */
export function parseFIIFields(text: string): FIIFields {
  const out: FIIFields = {};
  const vac = text.match(/vac[âa]ncia[^%]{0,40}?(\d{1,3}(?:,\d{1,2})?)\s*%/i);
  if (vac) {
    const n = parseFloat(vac[1].replace(",", "."));
    if (!Number.isNaN(n) && n >= 0 && n <= 100) out.vacancyRate = n;
  }
  const dy = text.match(/dividend\s*yield[^%]{0,40}?(\d{1,3}(?:,\d{1,2})?)\s*%/i);
  if (dy) {
    const n = parseFloat(dy[1].replace(",", "."));
    if (!Number.isNaN(n) && n > 0 && n <= 100) out.dividendYield = n;
  }
  const seg = text.match(/segmento[:\s]{0,5}([A-Za-zÀ-ÿ\/ ]{3,30}?)(?:\s{2,}|$|\d)/i);
  if (seg) out.segment = seg[1].trim();
  return out;
}

async function scrape(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, { headers: headersFor(url), signal: controller.signal });
    if (!res.ok) return "";
    return htmlToText(await res.text());
  } catch {
    return "";
  } finally {
    clearTimeout(timeoutId);
  }
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (applyCors(request, response, 'GET, OPTIONS')) return;
  const rate = checkRateLimit(request, { windowMs: 60_000, max: 20, burstMax: 3, burstWindowMs: 5_000 });
  if (!rate.allowed) {
    response.setHeader('Retry-After', String(rate.retryAfterSec));
    return response.status(429).json({ error: 'rate-limited', retryAfterSec: rate.retryAfterSec });
  }

  const raw = Array.isArray(request.query.ticker) ? request.query.ticker[0] : (request.query.ticker as string);
  const ticker = raw?.toUpperCase();
  if (!ticker || !/^[A-Z]{4}11$/.test(ticker)) {
    return response.status(400).json({ error: "Ticker de FII inválido. Use formato XXXX11 (ex: HGLG11)" });
  }

  try {
    for (const url of [FONTES.investidor10(ticker), FONTES.statusinvest(ticker)]) {
      const text = await scrape(url);
      if (text && text.length >= 200) {
        const fields = parseFIIFields(text);
        if (fields.vacancyRate !== undefined || fields.dividendYield !== undefined || fields.segment) {
          return response.status(200).json({ ticker, ...fields, fonte: url });
        }
      }
    }
    return response.status(200).json({ ticker });
  } catch (error) {
    console.error("Erro no proxy fii-data:", error);
    return response.status(200).json({ ticker });
  }
}
