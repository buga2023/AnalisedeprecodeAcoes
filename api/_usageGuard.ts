/**
 * Gate server-side de uso de IA (paywall) — única porta de entrada das regras
 * de plano. `api/ai.ts` não conhece limites: só chama `assertCanUseAI` antes do
 * LLM e `trackUsage` depois do sucesso.
 *
 * DORMÊNCIA: controlado pela env `BILLING_ENABLED`. Off (default) → ninguém vê
 * paywall (retorna isPro:true sem tocar o Supabase). On → cobrança real.
 *
 * Free tem soft limit de N chamadas IA/mês; Pro é ilimitado. O limite e a regra
 * de acesso espelham `src/lib/billing.ts` (mantidos em sincronia manual — api/
 * não importa de src/).
 *
 * Arquivos `_*.ts` em `api/` são utilitários — não viram rota Vercel.
 */

import type { VercelRequest } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Espelha `FREE_MONTHLY_LIMIT` de `src/lib/billing.ts`. */
const FREE_MONTHLY_LIMIT = 10;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export interface PaywallPayload {
  feature: string;
  currentUsage: number;
  limit: number;
  plan: "free";
}

export class GuardError extends Error {
  status: number;
  payload?: PaywallPayload;
  constructor(status: number, message: string, payload?: PaywallPayload) {
    super(message);
    this.status = status;
    this.payload = payload;
    this.name = "GuardError";
  }
}

export interface GuardResult {
  /** null quando billing está dormente (flag off). */
  userId: string | null;
  isPro: boolean;
}

function billingEnabled(): boolean {
  return process.env.BILLING_ENABLED === "true";
}

function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function extractBearer(req: VercelRequest): string | null {
  const authHeader = req.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match) return null;
  const token = match[1].trim();
  // Sanity de tamanho — JWT real tem ~700-1500 chars.
  if (token.length < 20 || token.length > 4096) return null;
  return token;
}

/**
 * Garante que o usuário pode consumir uma chamada IA. Lança `GuardError`:
 *  - 401 sem token / token inválido (quando billing ligado).
 *  - 402 quando free estourou o limite do mês (payload `PaywallPayload`).
 *
 * Quando billing está dormente (flag off) ou as envs do Supabase faltam,
 * libera (isPro:true) sem tocar o banco — modo grátis/demo.
 */
export async function assertCanUseAI(
  req: VercelRequest,
  feature: string
): Promise<GuardResult> {
  if (!billingEnabled()) return { userId: null, isPro: true };

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    // Misconfig: billing ligado mas sem service role. Falha aberta (grátis) e
    // registra — melhor não derrubar a IA inteira por env faltando.
    console.warn("[_usageGuard] BILLING_ENABLED=true mas SUPABASE_SERVICE_ROLE_KEY ausente — liberando grátis.");
    return { userId: null, isPro: true };
  }

  const token = extractBearer(req);
  if (!token) throw new GuardError(401, "auth-required");

  const admin = adminClient();
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    throw new GuardError(401, "invalid-token");
  }
  const userId = userData.user.id;

  // Subscription mais recente do usuário.
  const { data: subRow } = await admin
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isPro = subRow?.status === "active" || subRow?.status === "cancelled";
  if (isPro) return { userId, isPro: true };

  // Free: checa uso do mês corrente via view agregada.
  const { data: usageRow } = await admin
    .from("current_month_usage")
    .select("total_this_month")
    .eq("user_id", userId)
    .maybeSingle();

  const currentUsage = Number(usageRow?.total_this_month ?? 0);
  if (currentUsage >= FREE_MONTHLY_LIMIT) {
    throw new GuardError(402, "paywall-required", {
      feature,
      currentUsage,
      limit: FREE_MONTHLY_LIMIT,
      plan: "free",
    });
  }

  return { userId, isPro: false };
}

/**
 * Incrementa o contador de uso (atômico via RPC `increment_usage`). Chamado
 * DEPOIS do LLM responder com sucesso. No-op quando billing dormente, sem
 * userId, ou envs ausentes. Fire-and-forget — nunca quebra a resposta.
 */
export async function trackUsage(userId: string | null, feature: string): Promise<void> {
  if (!billingEnabled() || !userId || !SUPABASE_URL || !SERVICE_ROLE_KEY) return;
  try {
    const admin = adminClient();
    const { error } = await admin.rpc("increment_usage", {
      p_user_id: userId,
      p_feature: feature,
    });
    if (error) console.warn("[_usageGuard] increment_usage:", error.message.slice(0, 120));
  } catch (e) {
    console.warn("[_usageGuard] trackUsage falhou:", (e as Error).message?.slice(0, 120));
  }
}
