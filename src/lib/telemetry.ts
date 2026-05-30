/**
 * Telemetria de erro (front) — Sentry quando há DSN, no-op caso contrário.
 *
 * A interface (`initTelemetry`, `captureError`, `captureMessage`) é estável: os
 * call sites (`usePraChat`, `useStockQuotes`, etc.) não mudam. Sem
 * `VITE_SENTRY_DSN` setado, `initTelemetry` não inicializa nada e o dev local
 * não envia evento algum — só o `console` continua. O DSN vem SEMPRE de env,
 * nunca hardcoded.
 */

import * as Sentry from "@sentry/react";

let enabled = false;

export interface ErrorContext {
  /** Identificador curto do site da chamada (ex.: "usePraChat", "fetchStockQuote"). */
  tag: string;
  /** Dados extras (não pode conter PII; logs ficam 30d). */
  extra?: Record<string, unknown>;
}

/**
 * Inicializa o Sentry se `VITE_SENTRY_DSN` existir. Chamado uma vez em
 * `src/main.tsx` antes do render. Sem DSN → no-op.
 */
export function initTelemetry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Só captura de erro por ora — sem performance tracing nem session replay.
    tracesSampleRate: 0,
  });
  enabled = true;
}

export function captureError(err: unknown, ctx: ErrorContext): void {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[telemetry:${ctx.tag}] ${msg.slice(0, 200)}`, ctx.extra ?? "");
  if (enabled) {
    Sentry.captureException(err, { tags: { site: ctx.tag }, extra: ctx.extra });
  }
}

/**
 * Para eventos não-erro (warnings de UX, estados degradados detectados, etc.).
 */
export function captureMessage(message: string, ctx: ErrorContext): void {
  console.warn(`[telemetry:${ctx.tag}] ${message.slice(0, 200)}`, ctx.extra ?? "");
  if (enabled) {
    Sentry.captureMessage(message, {
      level: "warning",
      tags: { site: ctx.tag },
      extra: ctx.extra,
    });
  }
}
