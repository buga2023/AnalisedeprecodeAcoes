/**
 * Telemetria de erro (serverless) — Sentry quando há SENTRY_DSN, no-op caso
 * contrário. Complementa o log local restrito dos handlers; não o substitui.
 *
 * O DSN vem SEMPRE de env (`SENTRY_DSN`), nunca hardcoded. Sem DSN,
 * `captureApiError` é no-op e o pacote `@sentry/node` NUNCA é importado — sem
 * custo de load no handler nem no cold-start (import dinâmico gated por DSN).
 *
 * Uso: nos `catch` dos handlers críticos (checkout, mp-webhook, delete-account,
 * ai), chamar `captureApiError(error, "checkout")`. Fire-and-forget: não bloqueia
 * a resposta ao cliente.
 */

type SentryNode = typeof import("@sentry/node");

let initPromise: Promise<SentryNode | null> | null = null;

function ensureInit(): Promise<SentryNode | null> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) return null;
    const Sentry = await import("@sentry/node");
    Sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "production",
      // Só captura de erro — sem performance tracing.
      tracesSampleRate: 0,
    });
    return Sentry;
  })();
  return initPromise;
}

export function captureApiError(err: unknown, endpoint: string): void {
  // Fire-and-forget: sem DSN resolve pra null e não faz nada; com DSN, importa
  // e envia em background sem segurar a resposta.
  void ensureInit().then((Sentry) => {
    Sentry?.captureException(err, { tags: { endpoint } });
  });
}
