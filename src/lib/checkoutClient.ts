/**
 * Inicia o checkout do Praxia Pro: chama `POST /api/checkout` (autenticado) e
 * redireciona pro `init_point` do Mercado Pago. Reusado por `PaywallModal` e
 * `ScreenBilling`.
 */

import { aiAuthHeaders } from "./aiAuth";

export async function startProCheckout(): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = aiAuthHeaders();
  if (!auth.Authorization) {
    return { ok: false, error: "Faça login para assinar o Pro." };
  }
  let res: Response;
  try {
    res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
    });
  } catch {
    return { ok: false, error: "Falha de rede ao iniciar o checkout." };
  }
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    return { ok: false, error: e.message || e.error || `Erro no checkout (${res.status}).` };
  }
  const data = (await res.json()) as { init_point?: string };
  if (!data.init_point) return { ok: false, error: "Mercado Pago não retornou a URL de pagamento." };
  window.location.href = data.init_point;
  return { ok: true };
}
