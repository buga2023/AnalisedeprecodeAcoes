/**
 * Helper compartilhado para a REST do Mercado Pago (Subscriptions / Preapproval).
 *
 * Centraliza: resolução do access token, `mpFetch` (chamada autenticada) e
 * `verifyWebhookSignature` (HMAC-SHA256 do header `x-signature`). Os handlers
 * (`api/checkout.ts`, `api/mp-webhook.ts`) não montam URL nem header na mão.
 *
 * Arquivos `_*.ts` em `api/` são utilitários — não viram rota Vercel.
 *
 * Envs (server-side, sem prefixo VITE_):
 *  - `MERCADO_PAGO_ACCESS_TOKEN` (fallback `MP_ACCESS_TOKEN`) — secret server-side.
 *  - `MERCADO_PAGO_WEBHOOK_SECRET` (fallback `MP_WEBHOOK_SECRET`) — assinatura do webhook.
 */

import crypto from "node:crypto";

const MP_API_BASE = "https://api.mercadopago.com";

export class MPError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "MPError";
  }
}

/** Access token do MP. Retorna "" se ausente — caller decide (503). */
export function getMPAccessToken(): string {
  return process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || "";
}

/** Secret de validação do webhook. Retorna "" se ausente. */
export function getMPWebhookSecret(): string {
  return process.env.MERCADO_PAGO_WEBHOOK_SECRET || process.env.MP_WEBHOOK_SECRET || "";
}

/**
 * Status de subscription do Mercado Pago Preapproval. Mapeia 1:1 com o enum
 * persistido em `public.subscriptions.status`.
 */
export type MPPreapprovalStatus = "pending" | "authorized" | "paused" | "cancelled";

/** Subset do schema de Preapproval que consumimos. */
export interface MPPreapproval {
  id: string;
  status: MPPreapprovalStatus;
  payer_id?: number | string;
  external_reference?: string;
  init_point?: string;
  next_payment_date?: string;
  auto_recurring?: {
    transaction_amount?: number;
    currency_id?: string;
    frequency?: number;
    frequency_type?: string;
  };
}

/**
 * Chamada autenticada à REST do MP. Lança `MPError` (com status) em falha —
 * o handler decide como traduzir. Logs nunca incluem o token.
 */
export async function mpFetch<T = unknown>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const token = getMPAccessToken();
  if (!token) {
    throw new MPError(503, "MERCADO_PAGO_ACCESS_TOKEN ausente no servidor.");
  }
  const res = await fetch(`${MP_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data as { message?: string; error?: string })?.message ||
      (data as { error?: string })?.error ||
      `Erro Mercado Pago (${res.status})`;
    throw new MPError(res.status, String(msg).slice(0, 200));
  }
  return data as T;
}

/**
 * Valida a assinatura do webhook do MP (anti-spoofing).
 *
 * O MP envia o header `x-signature: ts=<unix>,v1=<hmac-hex>` e `x-request-id`.
 * O manifest assinado é `id:<dataId>;request-id:<requestId>;ts:<ts>;` e o HMAC
 * é SHA-256 com o webhook secret. `dataId` alfanumérico vai em minúsculas.
 *
 * Doc: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 *
 * Retorna `true` só quando a assinatura confere. Falha fechada (false) se
 * secret ausente ou header malformado.
 */
export function verifyWebhookSignature(params: {
  xSignature: string | undefined;
  xRequestId: string | undefined;
  dataId: string | undefined;
  secret: string;
}): boolean {
  const { xSignature, xRequestId, dataId, secret } = params;
  if (!secret || !xSignature || !dataId) return false;

  // Parse "ts=...,v1=..." (ordem/campos extras tolerados).
  let ts = "";
  let v1 = "";
  for (const part of xSignature.split(",")) {
    const [k, ...rest] = part.split("=");
    const value = rest.join("=").trim();
    if (k.trim() === "ts") ts = value;
    else if (k.trim() === "v1") v1 = value;
  }
  if (!ts || !v1) return false;

  const id = /[^0-9]/.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${id};request-id:${xRequestId ?? ""};ts:${ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  // Comparação timing-safe — exige buffers de mesmo tamanho.
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(v1, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Mapeia status do MP Preapproval → status persistido em `subscriptions`. */
export function mpStatusToSubscriptionStatus(
  mp: MPPreapprovalStatus
): "pending" | "active" | "paused" | "cancelled" | "past_due" {
  switch (mp) {
    case "authorized":
      return "active";
    case "pending":
      return "pending";
    case "paused":
      return "paused";
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
  }
}
