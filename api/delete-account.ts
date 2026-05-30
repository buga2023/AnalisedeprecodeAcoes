import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { applyCors } from "./_cors";
import { checkRateLimit } from "./_ratelimit";
import { captureApiError } from "./_sentry";

/**
 * Endpoint LGPD Art. 18 — Exclusao definitiva da conta do usuario.
 *
 * Recebe `Authorization: Bearer <access_token>` (token JWT do supabase do user
 * logado). Valida o token via servico, deleta linhas vinculadas em
 * portfolio_stocks/transactions/profiles/preferences (RLS bate em delete cascata
 * pelo trigger ON DELETE CASCADE FROM auth.users), e finalmente chama
 * `admin.deleteUser(uid)`.
 *
 * Logs restritos: nunca emitimos email, JWT ou body cru — so user_id (UUID).
 *
 * Variaveis necessarias:
 *  - `SUPABASE_URL` (server-side; pode espelhar `VITE_SUPABASE_URL`)
 *  - `SUPABASE_SERVICE_ROLE_KEY` (NUNCA expor no client)
 *
 * Sem as envs, o endpoint retorna 503 e o cliente cai no path so-local.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (applyCors(request, response, "POST, OPTIONS")) return;

  if (request.method !== "POST") {
    return response.status(405).json({ error: "method-not-allowed" });
  }

  // Rate-limit: apaga uma conta no maximo 5 vezes por minuto por IP (mais que
  // isso e abuso/script).
  const rate = checkRateLimit(request, { windowMs: 60_000, max: 5, burstMax: 2, burstWindowMs: 5_000 });
  if (!rate.allowed) {
    response.setHeader("Retry-After", String(rate.retryAfterSec));
    return response.status(429).json({ error: "rate-limited", retryAfterSec: rate.retryAfterSec });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return response.status(503).json({
      error: "service-unavailable",
      message: "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes no servidor.",
    });
  }

  // Extrai Bearer token
  const authHeader = request.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match) {
    return response.status(401).json({ error: "missing-bearer-token" });
  }
  const accessToken = match[1].trim();
  if (accessToken.length < 20 || accessToken.length > 4096) {
    // Sanity check basico de tamanho — JWT real tem ~ 700-1500 chars.
    return response.status(401).json({ error: "invalid-token-shape" });
  }

  // Cliente admin (service role) — vive so server-side.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Valida o JWT do user — auth.getUser(jwt) decodifica e checa expiry.
  const { data: userData, error: userErr } = await admin.auth.getUser(accessToken);
  if (userErr || !userData?.user) {
    console.warn("[api/delete-account] token invalido:", (userErr?.message ?? "").slice(0, 80));
    return response.status(401).json({ error: "invalid-token" });
  }
  const userId = userData.user.id;

  try {
    // Delete em paralelo das tabelas — RLS nao se aplica com service role.
    // O schema tem ON DELETE CASCADE em auth.users, mas executar explicitamente
    // garante consistencia caso o cascade falhe ou o schema mude. Inclui
    // subscriptions e usage_log (billing) para exclusao atomica (LGPD Art. 18 VI).
    const [portfolioRes, txRes, prefsRes, profileRes, subsRes, usageRes] = await Promise.all([
      admin.from("portfolio_stocks").delete().eq("user_id", userId),
      admin.from("transactions").delete().eq("user_id", userId),
      admin.from("preferences").delete().eq("user_id", userId),
      admin.from("profiles").delete().eq("user_id", userId),
      admin.from("subscriptions").delete().eq("user_id", userId),
      admin.from("usage_log").delete().eq("user_id", userId),
    ]);

    const failed: string[] = [];
    if (portfolioRes.error) failed.push("portfolio_stocks");
    if (txRes.error) failed.push("transactions");
    if (prefsRes.error) failed.push("preferences");
    if (profileRes.error) failed.push("profiles");
    if (subsRes.error) failed.push("subscriptions");
    if (usageRes.error) failed.push("usage_log");

    if (failed.length > 0) {
      console.error("[api/delete-account] delete falhou:", { userId, failed: failed.join(",") });
      return response.status(500).json({
        error: "partial-failure",
        tables: failed,
      });
    }

    // Finalmente, apaga o auth.user. Apos isso o usuario nao pode mais logar.
    const { error: deleteUserErr } = await admin.auth.admin.deleteUser(userId);
    if (deleteUserErr) {
      const msg = deleteUserErr.message?.slice(0, 120) ?? "unknown";
      console.error("[api/delete-account] admin.deleteUser falhou:", { userId, msg });
      // Linhas ja foram apagadas — sinaliza sucesso parcial pro client decidir.
      return response.status(207).json({
        ok: false,
        partial: true,
        tablesDeleted: true,
        userDeleted: false,
        message: "Dados removidos mas auth.user nao foi deletado.",
      });
    }

    console.info("[api/delete-account] sucesso:", { userId });
    return response.status(200).json({ ok: true, userDeleted: true });
  } catch (error) {
    captureApiError(error, "delete-account");
    const msg = error instanceof Error ? error.message : "";
    console.error("[api/delete-account] erro fatal:", msg.slice(0, 120));
    return response.status(500).json({ error: "internal-error" });
  }
}
