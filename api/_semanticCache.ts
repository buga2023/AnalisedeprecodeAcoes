/**
 * Cache SEMÂNTICO do chat da Pra — recicla respostas por similaridade.
 *
 * Fluxo: embeda a pergunta via Edge Function `embed` (gte-small, 384d) → busca
 * no pgvector (`match_semantic_cache`) a resposta mais próxima acima do limiar
 * → hit devolve sem chamar o LLM. Miss: gera e grava (pergunta+embedding+body).
 *
 * DORMENTE por padrão: só atua com `SEMANTIC_CACHE_ENABLED === "true"` E a
 * infra implantada (migration 004 + Edge Function `embed`). Sem isso é no-op.
 * Auto-desliga pela vida da instância se a tabela/função/edge não existir.
 *
 * Risco conhecido (calibrar no ar): o chat é multi-turn — uma pergunta
 * "parecida" pode significar coisa diferente conforme o histórico. O limiar
 * (`SEMANTIC_THRESHOLD`, default 0.92) controla o trade-off recall × precisão.
 *
 * Arquivos `_*.ts` em `api/` são utilitários — não viram rota Vercel.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

let _admin: SupabaseClient | null = null;
let semanticDisabled = false;

export function semanticEnabled(): boolean {
  return (
    process.env.SEMANTIC_CACHE_ENABLED === "true" &&
    !semanticDisabled &&
    !!SUPABASE_URL &&
    !!SERVICE_ROLE_KEY
  );
}

function threshold(): number {
  const t = Number(process.env.SEMANTIC_THRESHOLD);
  return Number.isFinite(t) && t > 0 && t <= 1 ? t : 0.92;
}

function admin(): SupabaseClient | null {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  if (!_admin) {
    _admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}

/** Embeda texto via Edge Function `embed` (gte-small). null em falha. */
async function embedText(text: string): Promise<number[] | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/embed`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      if (res.status === 404) semanticDisabled = true; // Edge Function não implantada
      return null;
    }
    const data = (await res.json()) as { embedding?: number[] };
    return Array.isArray(data.embedding) ? data.embedding : null;
  } catch {
    return null;
  }
}

function isMissing(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  const m = `${err.code ?? ""} ${err.message ?? ""}`.toLowerCase();
  return m.includes("does not exist") || m.includes("pgrst") || m.includes("42p01") || m.includes("42883");
}

/** Hit semântico: resposta cacheada para uma pergunta similar, ou null. */
export async function getSemanticCached(question: string): Promise<unknown | null> {
  if (!semanticEnabled()) return null;
  const db = admin();
  if (!db) return null;
  const embedding = await embedText(question);
  if (!embedding) return null;
  try {
    const { data, error } = await db.rpc("match_semantic_cache", {
      query_embedding: embedding,
      match_threshold: threshold(),
    });
    if (isMissing(error)) semanticDisabled = true;
    if (error || !Array.isArray(data) || data.length === 0) return null;
    return (data[0] as { body?: unknown }).body ?? null;
  } catch {
    return null;
  }
}

/** Grava a resposta + embedding da pergunta. Fire-and-forget; nunca quebra. */
export async function setSemanticCached(
  question: string,
  body: unknown,
  ttlMs = DEFAULT_TTL_MS
): Promise<void> {
  if (!semanticEnabled()) return;
  const db = admin();
  if (!db) return;
  const embedding = await embedText(question);
  if (!embedding) return;
  try {
    const expires_at = new Date(Date.now() + ttlMs).toISOString();
    const { error } = await db
      .from("ai_semantic_cache")
      .insert({ question: question.slice(0, 2000), embedding, body, expires_at });
    if (isMissing(error)) semanticDisabled = true;
    if (error) console.warn("[_semanticCache] insert:", error.message.slice(0, 120));
  } catch {
    /* no-op */
  }
}
