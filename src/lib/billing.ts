/**
 * Billing — constantes e helpers PUROS (sem I/O).
 *
 * Fonte única das regras de plano: preço, limite free, features gateadas e
 * rótulos. Mudar o modelo de cobrança = mexer só aqui + `api/_usageGuard.ts`.
 *
 * Modelo (sub-entrega 1.6): Praxia Pro R$ 29/mês via Mercado Pago Preapproval.
 * Free tem soft limit de 10 chamadas IA/mês; Pro é ilimitado.
 */

import type { PaywalledFeature, Subscription } from "@/types/stock";

/** Preço mensal do Praxia Pro (BRL). */
export const PRO_PRICE_BRL = 29.0;

/** Chamadas IA grátis por mês no plano free. */
export const FREE_MONTHLY_LIMIT = 10;

/** Features que consomem cota de IA (contadas em `usage_log`). */
export const PAYWALLED_FEATURES: readonly PaywalledFeature[] = [
  "ai-analysis",
  "portfolio-insights",
  "compare",
  "digest",
  "optimize-dividends",
  "screener",
  "classify-news",
  "fundamentals-history",
];

/**
 * True se a subscription dá acesso Pro AGORA. `active` paga em dia;
 * `cancelled` mantém acesso até o fim do período já pago (o webhook só vira
 * para um status sem acesso quando o período expira). `null`, `pending`,
 * `paused` e `past_due` não têm acesso.
 */
export function hasProAccess(sub: Subscription | null): boolean {
  if (!sub) return false;
  return sub.status === "active" || sub.status === "cancelled";
}

/** Chave do mês corrente "YYYY-MM" em UTC — bucket consistente de uso. */
export function currentMonthKey(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Rótulos amigáveis (pt-BR) por feature — usados no paywall/billing. */
export const featureLabels: Record<PaywalledFeature, string> = {
  "ai-analysis": "Análise da ação com IA",
  "portfolio-insights": "Insights da carteira",
  compare: "Comparador de ações",
  digest: "Digest semanal",
  "optimize-dividends": "Otimizador de dividendos",
  screener: "Screener (Descobrir)",
  "classify-news": "Classificação de notícias",
  "fundamentals-history": "Histórico de fundamentos",
};
