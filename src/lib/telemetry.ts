/**
 * Telemetria de erro — interface estável consumida por todo o app
 * (`captureError(err, ctx)`, `captureMessage`, `initTelemetry`).
 *
 * Comportamento: sem `VITE_SENTRY_DSN` → no-op (só `console`), pra que dev local
 * não pague nada e a suíte de testes rode sem rede. Com DSN → `initTelemetry`
 * carrega `@sentry/react` via DYNAMIC import (chunk separado, fora do bundle
 * base) e os captures passam a encaminhar pro Sentry.
 *
 * Minimização (LGPD): `beforeSend` remove cookies/headers/body e nunca
 * enviamos email/UUID — só `tag` do site + `extra` controlado pelo call site.
 */

import type * as SentryReact from "@sentry/react";

// Ref do módulo Sentry quando carregado (null = ainda não/never). Os captures
// são síncronos: se o Sentry ainda não resolveu o dynamic import, caem no console.
let sentry: typeof SentryReact | null = null;

export interface ErrorContext {
  /** Identificador curto do site da chamada (ex.: "usePraChat", "fetchStockQuote"). */
  tag: string;
  /** Dados extras (não pode conter PII; logs ficam 30d). */
  extra?: Record<string, unknown>;
}

export function captureError(err: unknown, ctx: ErrorContext): void {
  if (sentry) {
    sentry.captureException(err, { tags: { site: ctx.tag }, extra: ctx.extra });
    return;
  }
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[telemetry:${ctx.tag}] ${msg.slice(0, 200)}`, ctx.extra ?? "");
}

/**
 * Para eventos não-erro (warnings de UX, estados degradados detectados, etc.).
 */
export function captureMessage(message: string, ctx: ErrorContext): void {
  const text = message.slice(0, 200);
  if (sentry) {
    sentry.captureMessage(text, { level: "warning", tags: { site: ctx.tag }, extra: ctx.extra });
    return;
  }
  console.warn(`[telemetry:${ctx.tag}] ${text}`, ctx.extra ?? "");
}

/**
 * Inicializador. Call site: `src/main.tsx` antes do `createRoot(...).render(...)`.
 * Sem DSN: no-op. Com DSN: carrega e inicializa o Sentry de forma assíncrona
 * (não bloqueia o boot; erros antes do load caem no console).
 */
export function initTelemetry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  void import("@sentry/react")
    .then((S) => {
      S.init({
        dsn,
        environment: import.meta.env.MODE,
        tracesSampleRate: 0, // só erros — sem performance tracing (custo/ruído)
        sendDefaultPii: false,
        beforeSend(event) {
          if (event.request) {
            delete event.request.cookies;
            delete event.request.headers;
            delete event.request.data;
          }
          return event;
        },
      });
      sentry = S;
    })
    .catch(() => {
      // Falha ao carregar o Sentry nunca pode quebrar o app — segue no-op/console.
    });
}
