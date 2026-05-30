/**
 * Captura de erro server-side. `@sentry/node` é carregado LAZY (dynamic import)
 * só quando `SENTRY_DSN` existe — import estático custaria cold-start/timeout nos
 * handlers Vercel. Sem DSN: `console.error` sanitizado (sem body/JWT/email).
 *
 * Arquivos `_*.ts` em `api/` são utilitários — não viram rota Vercel.
 */

type SentryNode = typeof import("@sentry/node");

let sentry: SentryNode | null = null;
let initialized = false;

/** Reporta um erro fatal. Nunca lança — falha de telemetria não pode quebrar o handler. */
export async function captureServer(err: unknown, ctx: { tag: string }): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (dsn) {
    try {
      if (!sentry) sentry = await import("@sentry/node");
      if (!initialized) {
        sentry.init({
          dsn,
          environment: process.env.VERCEL_ENV || "development",
          tracesSampleRate: 0,
          sendDefaultPii: false,
        });
        initialized = true;
      }
      sentry.captureException(err, { tags: { site: ctx.tag } });
      return;
    } catch {
      // cai pro console abaixo
    }
  }
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[sentry:%s] %s", ctx.tag, msg.slice(0, 120));
}
