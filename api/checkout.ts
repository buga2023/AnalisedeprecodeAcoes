import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { applyCors } from "./_cors";
import { checkRateLimit } from "./_ratelimit";
import { mpFetch, MPError, mpStatusToSubscriptionStatus, type MPPreapproval } from "./_mercadopago";
import { captureApiError } from "./_sentry";

/**
 * Cria uma assinatura (Preapproval) do Praxia Pro no Mercado Pago.
 *
 * Fluxo: cliente autenticado (Bearer JWT do supabase) → valida token → cria
 * Preapproval no MP → salva subscription `pending` no Supabase → devolve
 * `init_point` (URL de checkout do MP) pra o front redirecionar.
 *
 * Envs: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MERCADO_PAGO_ACCESS_TOKEN,
 * PUBLIC_URL (origem pública pra back_url; fallback = header da request).
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const PRO_PRICE_BRL = 29.0;
const PRO_REASON = "Praxia Pro — assinatura mensal";

function publicUrl(req: VercelRequest): string {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, "");
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host = req.headers.host || "localhost";
  return `${proto}://${host}`;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (applyCors(request, response, "POST, OPTIONS")) return;

  if (request.method !== "POST") {
    return response.status(405).json({ error: "method-not-allowed" });
  }

  // Rate-limit: no máx. 5 criações/min/IP (evita criar 100 preapprovals).
  const rate = checkRateLimit(request, { windowMs: 60_000, max: 5, burstMax: 2, burstWindowMs: 5_000 });
  if (!rate.allowed) {
    response.setHeader("Retry-After", String(rate.retryAfterSec));
    return response.status(429).json({ error: "rate-limited", retryAfterSec: rate.retryAfterSec });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return response.status(503).json({ error: "service-unavailable", message: "Supabase não configurado." });
  }

  // Bearer JWT do usuário logado.
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.authorization || "");
  if (!match) return response.status(401).json({ error: "missing-bearer-token" });
  const accessToken = match[1].trim();
  if (accessToken.length < 20 || accessToken.length > 4096) {
    return response.status(401).json({ error: "invalid-token-shape" });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await admin.auth.getUser(accessToken);
  if (userErr || !userData?.user) {
    return response.status(401).json({ error: "invalid-token" });
  }
  const user = userData.user;
  if (!user.email) {
    return response.status(400).json({ error: "missing-email" });
  }

  try {
    const pre = await mpFetch<MPPreapproval>("POST", "/preapproval", {
      reason: PRO_REASON,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: PRO_PRICE_BRL,
        currency_id: "BRL",
      },
      back_url: `${publicUrl(request)}/billing/return`,
      payer_email: user.email,
      external_reference: user.id,
      status: "pending",
    });

    // Persiste subscription pending. mp_preapproval_id é unique → idempotente.
    const { error: insertErr } = await admin.from("subscriptions").upsert(
      {
        user_id: user.id,
        mp_preapproval_id: pre.id,
        plan: "pro",
        status: mpStatusToSubscriptionStatus(pre.status),
        amount_brl: PRO_PRICE_BRL,
      },
      { onConflict: "mp_preapproval_id" }
    );
    if (insertErr) {
      console.error("[api/checkout] persist subscription falhou:", insertErr.message.slice(0, 120));
      // Não aborta o checkout — o webhook reconcilia o status depois.
    }

    if (!pre.init_point) {
      console.error("[api/checkout] MP não retornou init_point");
      return response.status(502).json({ error: "mp-no-init-point" });
    }
    return response.status(200).json({ init_point: pre.init_point });
  } catch (error) {
    captureApiError(error, "checkout");
    if (error instanceof MPError) {
      console.error("[api/checkout] MP %d %s", error.status, error.message.slice(0, 120));
      return response.status(502).json({ error: "mp-error", message: error.message });
    }
    const msg = error instanceof Error ? error.message : "erro";
    console.error("[api/checkout] erro:", msg.slice(0, 120));
    return response.status(500).json({ error: "internal-error" });
  }
}
