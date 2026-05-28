/**
 * Shim de telemetria — interface estável que vai virar Sentry quando a
 * conta estiver configurada. Até lá, despeja em `console.error` com tag.
 *
 * Substituição futura (1 commit):
 *   1. `npm install @sentry/react`
 *   2. Em `src/main.tsx`, antes do render:
 *        Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, environment: import.meta.env.MODE });
 *   3. Trocar `captureError` daqui por `Sentry.captureException(err, { extra: ctx })`.
 *
 * Manter SEMPRE essa interface estável — `captureError(err, ctx)` —
 * para que os call sites (`usePraChat`, `useStockQuotes`, etc.) não
 * precisem mudar quando trocarmos o backend de erro.
 */

export interface ErrorContext {
  /** Identificador curto do site da chamada (ex.: "usePraChat", "fetchStockQuote"). */
  tag: string;
  /** Dados extras (não pode conter PII; logs ficam 30d). */
  extra?: Record<string, unknown>;
}

export function captureError(err: unknown, ctx: ErrorContext): void {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[telemetry:${ctx.tag}] ${msg.slice(0, 200)}`, ctx.extra ?? "");
}

/**
 * Para eventos não-erro que vão virar `Sentry.captureMessage` (warnings de UX,
 * estados degradados detectados, etc.). Hoje só loga.
 */
export function captureMessage(message: string, ctx: ErrorContext): void {
  console.warn(`[telemetry:${ctx.tag}] ${message.slice(0, 200)}`, ctx.extra ?? "");
}

/**
 * Inicializador no-op — quando Sentry chegar, vai chamar `Sentry.init(...)`.
 * Call site: `src/main.tsx` antes do `createRoot(...).render(...)`.
 */
export function initTelemetry(): void {
  // Hoje no-op. Quando configurar Sentry, ler `import.meta.env.VITE_SENTRY_DSN`
  // — se vazio, manter no-op pra que o dev local não pague nada.
}
