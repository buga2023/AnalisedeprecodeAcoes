// src/lib/aiAuth.ts
import type { PaywalledFeature, PaywallRequiredPayload } from "@/types/stock";

/**
 * Token de acesso do usuário logado (JWT do Supabase). Registrado pelo App.tsx
 * em todo onAuthStateChange; lido pelos pontos que chamam /api/ai. Nível de
 * módulo (não React state) porque libs puras não têm acesso a hooks.
 */
let accessToken: string | null = null;

export function setAIAccessToken(token: string | null): void {
  accessToken = token;
}

/** Header Authorization quando há token; objeto vazio caso contrário. */
export function aiAuthHeaders(): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

/** Lançado quando o servidor responde 402 (cota free estourada). */
export class PaywallRequiredError extends Error {
  constructor(public payload: PaywallRequiredPayload) {
    super("paywall-required");
    this.name = "PaywallRequiredError";
  }
}

/**
 * Inspeciona a resposta de /api/ai. Se for 402, monta o payload e lança
 * PaywallRequiredError; caso contrário não faz nada (o caller segue o fluxo).
 * `feature` é injetado porque o corpo do 402 pode não repeti-lo.
 */
export async function throwIfPaywalled(
  response: Response,
  feature: PaywalledFeature
): Promise<void> {
  if (response.status !== 402) return;
  const data = (await response.json().catch(() => ({}))) as Partial<PaywallRequiredPayload>;
  throw new PaywallRequiredError({
    feature,
    currentUsage: typeof data.currentUsage === "number" ? data.currentUsage : 0,
    limit: typeof data.limit === "number" ? data.limit : 0,
    plan: data.plan ?? "free",
  });
}
