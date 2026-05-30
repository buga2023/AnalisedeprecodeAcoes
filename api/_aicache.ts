import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cache de respostas /api/ai em duas camadas, chaveado por sha1 de
 * (provider, messages, temperature, max_tokens, response_format).
 *
 * - L1 (memória): rápido, por instância Vercel, TTL curto (`TTL_MS`).
 * - L2 (Supabase `ai_cache`): durável e COMPARTILHADO entre usuários, instâncias
 *   e cold starts (`DURABLE_TTL_MS`). "Recicla conhecimento": a 1ª chamada com
 *   uma chave gera no LLM; todas as outras reusam sem re-billar tokens.
 *
 * Degrada gracioso: sem `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (ou tabela
 * ausente), o L2 vira no-op e só o L1 atua.
 */

const TTL_MS = 10 * 60 * 1000; // 10 minutos (L1)
const DURABLE_TTL_MS = 60 * 60 * 1000; // 1 hora (L2 — janela de reuso cross-user)
const MAX_ENTRIES = 500;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

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

/* ─── L2: cache durável compartilhado (Supabase) ───────────────────────── */

let _admin: SupabaseClient | null = null;
// Desliga o L2 pela vida da instância quando a tabela `ai_cache` não existe
// (migration 003 não rodada) — evita uma query falha por chamada de IA.
let durableDisabled = false;

function admin(): SupabaseClient | null {
  if (durableDisabled || !SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  if (!_admin) {
    _admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}

/** True se o erro do Supabase indica que a tabela `ai_cache` não existe. */
function isMissingTable(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  const m = `${err.code ?? ""} ${err.message ?? ""}`.toLowerCase();
  return m.includes("does not exist") || m.includes("pgrst205") || m.includes("42p01");
}

/** Lê do L2 durável. Retorna null se ausente/expirado/indisponível. */
export async function getCachedDurable(key: string): Promise<unknown | null> {
  const db = admin();
  if (!db) return null;
  try {
    const { data, error } = await db
      .from("ai_cache")
      .select("body,expires_at")
      .eq("key", key)
      .maybeSingle();
    if (isMissingTable(error)) durableDisabled = true;
    if (error || !data) return null;
    if (new Date(data.expires_at as string).getTime() <= Date.now()) {
      void db.from("ai_cache").delete().eq("key", key); // limpeza oportunística
      return null;
    }
    return data.body;
  } catch {
    return null; // tabela ausente / rede — degrada pro L1/geração
  }
}

/** Grava no L2 durável (upsert por key). Fire-and-forget; nunca quebra a resposta. */
export async function setCachedDurable(
  key: string,
  body: unknown,
  ttlMs = DURABLE_TTL_MS
): Promise<void> {
  const db = admin();
  if (!db) return;
  try {
    const expires_at = new Date(Date.now() + ttlMs).toISOString();
    const { error } = await db.from("ai_cache").upsert({ key, body, expires_at }, { onConflict: "key" });
    if (isMissingTable(error)) durableDisabled = true;
    if (error) console.warn("[_aicache] setCachedDurable:", error.message.slice(0, 120));
  } catch {
    /* no-op */
  }
}
