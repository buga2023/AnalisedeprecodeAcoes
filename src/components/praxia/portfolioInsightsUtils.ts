import { PraxiaTokens } from "./tokens";
import type { AIInsight, AIResponse } from "@/lib/ai";
import type { Stock } from "@/types/stock";

const CACHE_KEY = "stocks-ai-portfolio-insights";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface CacheEntry {
  timestamp: number;
  signature: string;
  response: AIResponse;
}

export function portfolioSignature(stocks: Stock[]): string {
  return stocks
    .map((s) => `${s.ticker}:${s.quantity}`)
    .sort()
    .join("|");
}

export function readInsightsCache(
  signature: string
): { response: AIResponse; timestamp: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (entry.signature !== signature) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null;
    return { response: entry.response, timestamp: entry.timestamp };
  } catch {
    return null;
  }
}

export function writeInsightsCache(signature: string, response: AIResponse) {
  const entry: CacheEntry = { timestamp: Date.now(), signature, response };
  localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
}

export function sentimentColor(s: AIResponse["sentimento"]): string {
  if (s === "otimista") return PraxiaTokens.up;
  if (s === "pessimista") return PraxiaTokens.down;
  return PraxiaTokens.warn;
}

/**
 * Sentimento do portfolio calculado DETERMINISTICAMENTE pelo score medio
 * dos ativos. Substitui a decisao da IA: a IA gasta tokens pra responder
 * "otimista | pessimista | neutro" quando isso e uma estatistica trivial.
 *
 * Faixas:
 *   - media score > 70 -> otimista (carteira solida no agregado)
 *   - media score < 50 -> pessimista (carteira fraca no agregado)
 *   - 50..70           -> neutro
 *
 * Quando portfolio esta vazio, retorna "neutro" como default seguro.
 */
export function computePortfolioSentiment(stocks: Stock[]): AIResponse["sentimento"] {
  if (stocks.length === 0) return "neutro";
  const avg = stocks.reduce((acc, s) => acc + (s.score ?? 0), 0) / stocks.length;
  if (avg > 70) return "otimista";
  if (avg < 50) return "pessimista";
  return "neutro";
}

export function tipoColor(t: AIInsight["tipo"]): string {
  if (t === "alta") return PraxiaTokens.up;
  if (t === "baixa") return PraxiaTokens.down;
  if (t === "alerta") return PraxiaTokens.warn;
  return PraxiaTokens.ink70;
}
