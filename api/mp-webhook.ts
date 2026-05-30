import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import {
  mpFetch,
  MPError,
  getMPWebhookSecret,
  verifyWebhookSignature,
  mpStatusToSubscriptionStatus,
  type MPPreapproval,
} from "./_mercadopago";

/**
 * Webhook do Mercado Pago — recebe notificações de mudança de assinatura.
 *
 * NÃO exige Authorization Bearer (vem do MP), mas valida a assinatura HMAC do
 * header `x-signature`. Idempotente: reprocessar o mesmo evento converge pro
 * mesmo estado. Evento desconhecido → 200 (não quebra o retry do MP).
 *
 * Eventos tratados: `subscription_preapproval` (lifecycle da assinatura). Ao
 * receber, re-busca o Preapproval no MP (fonte de verdade) e atualiza
 * `subscriptions.status` pela `mp_preapproval_id`.
 *
 * Envs: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MERCADO_PAGO_ACCESS_TOKEN,
 * MERCADO_PAGO_WEBHOOK_SECRET.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getDataId(req: VercelRequest): string | undefined {
  const fromQuery = (req.query["data.id"] as string) || (req.query.id as string);
  if (fromQuery) return String(fromQuery);
  const body = (req.body || {}) as { data?: { id?: string }; id?: string };
  return body.data?.id ?? body.id;
}

function getEventType(req: VercelRequest): string {
  const body = (req.body || {}) as { type?: string; topic?: string };
  return (req.query.type as string) || (req.query.topic as string) || body.type || body.topic || "";
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  // MP envia POST server-to-server. Aceita só POST (e OPTIONS por segurança).
  if (request.method === "OPTIONS") return response.status(200).end();
  if (request.method !== "POST") {
    return response.status(405).json({ error: "method-not-allowed" });
  }

  const secret = getMPWebhookSecret();
  if (!secret || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    // Sem config não dá pra validar com segurança — falha fechada.
    return response.status(503).json({ error: "service-unavailable" });
  }

  const dataId = getDataId(request);
  const valid = verifyWebhookSignature({
    xSignature: request.headers["x-signature"] as string | undefined,
    xRequestId: request.headers["x-request-id"] as string | undefined,
    dataId,
    secret,
  });
  if (!valid) {
    console.warn("[api/mp-webhook] assinatura inválida");
    return response.status(401).json({ error: "invalid-signature" });
  }

  const type = getEventType(request);
  // Só lifecycle de assinatura altera estado. Outros eventos: ack e ignora.
  if (!type.includes("preapproval")) {
    return response.status(200).json({ ok: true, ignored: type || "unknown" });
  }
  if (!dataId) {
    return response.status(200).json({ ok: true, ignored: "no-data-id" });
  }

  try {
    // MP é a fonte de verdade — re-busca o status atual do Preapproval.
    const pre = await mpFetch<MPPreapproval>("GET", `/preapproval/${dataId}`);
    const status = mpStatusToSubscriptionStatus(pre.status);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const patch: Record<string, unknown> = { status };
    if (pre.next_payment_date) patch.current_period_end = pre.next_payment_date;
    if (status === "active") patch.started_at = new Date().toISOString();
    if (status === "cancelled") patch.cancelled_at = new Date().toISOString();

    const { error: updErr, data: updated } = await admin
      .from("subscriptions")
      .update(patch)
      .eq("mp_preapproval_id", pre.id)
      .select("user_id");

    if (updErr) {
      console.error("[api/mp-webhook] update falhou:", updErr.message.slice(0, 120));
      return response.status(500).json({ error: "update-failed" });
    }

    // Espelha o plano em profiles.plan (fonte rápida pro app).
    const userId = (updated as { user_id?: string }[] | null)?.[0]?.user_id;
    if (userId) {
      const plan = status === "active" || status === "cancelled" ? "pro" : "free";
      await admin
        .from("profiles")
        .update({ plan, plan_renewed_at: pre.next_payment_date ?? null })
        .eq("user_id", userId);
    }

    console.info("[api/mp-webhook] preapproval %s → %s", pre.id, status);
    return response.status(200).json({ ok: true, status });
  } catch (error) {
    if (error instanceof MPError) {
      console.error("[api/mp-webhook] MP %d %s", error.status, error.message.slice(0, 120));
      // 200 pra não disparar retry infinito em erro nosso de leitura — MP reenvia.
      return response.status(200).json({ ok: false, error: "mp-fetch-failed" });
    }
    const msg = error instanceof Error ? error.message : "erro";
    console.error("[api/mp-webhook] erro:", msg.slice(0, 120));
    return response.status(500).json({ error: "internal-error" });
  }
}
