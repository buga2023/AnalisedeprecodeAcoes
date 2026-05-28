import { createHash } from "node:crypto";

/**
 * Cache em memória de respostas /api/ai, chaveado por sha1 de
 * (provider, messages, temperature, max_tokens, response_format).
 *
 * Objetivo: poupar a quota Groq (que é baixa). Mensagens idênticas em até
 * `TTL_MS` retornam do cache sem bater na Groq.
 *
 * Limites:
 * - Mantemos no máximo MAX_ENTRIES — quando estoura, evicta a entrada mais
 *   antiga (LRU simples via Map order de inserção).
 * - Por instância de função Vercel — cada região tem cache próprio. Pra
 *   cache global trocar por Vercel KV / Upstash Redis.
 */

const TTL_MS = 10 * 60 * 1000; // 10 minutos
const MAX_ENTRIES = 500;

interface CacheEntry {
  body: unknown;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

interface CacheKeyInput {
  provider: string;
  messages: unknown;
  temperature: unknown;
  max_tokens: unknown;
  response_format?: unknown;
}

export function cacheKey(input: CacheKeyInput): string {
  const stable = JSON.stringify({
    p: input.provider,
    m: input.messages,
    t: input.temperature,
    mt: input.max_tokens,
    rf: input.response_format ?? null,
  });
  return createHash("sha1").update(stable).digest("hex");
}

export function getCached(key: string): unknown | null {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry) return null;
  if (now >= entry.expiresAt) {
    store.delete(key);
    return null;
  }
  // LRU touch: re-insere no fim
  store.delete(key);
  store.set(key, entry);
  return entry.body;
}

export function setCached(key: string, body: unknown): void {
  if (store.size >= MAX_ENTRIES) {
    // Evicta o primeiro (mais antigo)
    const firstKey = store.keys().next().value;
    if (firstKey !== undefined) store.delete(firstKey);
  }
  store.set(key, { body, expiresAt: Date.now() + TTL_MS });
}
