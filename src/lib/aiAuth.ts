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
  payload: PaywallRequiredPayload;
  constructor(payload: PaywallRequiredPayload) {
    super("paywall-required");
    this.name = "PaywallRequiredError";
    this.payload = payload;
  }
}

/**
 * Handler global de paywall — registrado pelo App.tsx. Permite abrir o
 * PaywallModal em QUALQUER 402, sem threadar callback por todo call site de IA.
 * O erro ainda é lançado (caller encerra seu loading), mas o modal sobe sozinho.
 */
let paywallHandler: ((payload: PaywallRequiredPayload) => void) | null = null;

export function setPaywallHandler(fn: ((payload: PaywallRequiredPayload) => void) | null): void {
  paywallHandler = fn;
}

/**
 * Inspeciona a resposta de /api/ai. Se for 402, monta o payload, notifica o
 * handler global (abre o modal) e lança PaywallRequiredError. Caso contrário
 * não faz nada. `feature` é injetado porque o corpo do 402 pode não repeti-lo.
 */
export async function throwIfPaywalled(
  response: Response,
  feature: PaywalledFeature
): Promise<void> {
  if (response.status !== 402) return;
  const data = (await response.json().catch(() => ({}))) as Partial<PaywallRequiredPayload>;
  const payload: PaywallRequiredPayload = {
    feature,
    currentUsage: typeof data.currentUsage === "number" ? data.currentUsage : 0,
    limit: typeof data.limit === "number" ? data.limit : 0,
    plan: data.plan ?? "free",
  };
  paywallHandler?.(payload);
  throw new PaywallRequiredError(payload);
}
