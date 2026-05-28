/**
 * Histórico de dividendos + projeção dos próximos 12 meses.
 *
 * Fonte: `/api/dividends?ticker=X` (proxy Yahoo Finance — ver `api/dividends.ts`).
 * Tudo client-side é puro (sem `fetch` direto), exceto `fetchDividendHistory`.
 */

import type { Stock } from "@/types/stock";

const DIVIDENDS_PROXY_URL = "/api/dividends";

export interface DividendEvent {
  /** ISO date `YYYY-MM-DD` (UTC). */
  date: string;
  /** Valor pago por ação naquela data. */
  amount: number;
}

export type Cadence = "monthly" | "quarterly" | "semiannual" | "annual" | "irregular" | "unknown";

export interface MonthBucket {
  /** Mês no formato `YYYY-MM`. */
  month: string;
  /** Valor projetado para o usuário (`dpa × quantity`). */
  amount: number;
}

interface DividendsApiResponse {
  ticker?: string;
  history?: DividendEvent[];
  error?: string;
}

/** Busca histórico via proxy. Em qualquer erro devolve `[]` — chamador não precisa try/catch. */
export async function fetchDividendHistory(ticker: string): Promise<DividendEvent[]> {
  try {
    const url = new URL(DIVIDENDS_PROXY_URL, window.location.origin);
    url.searchParams.set("ticker", ticker.toUpperCase());
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data: DividendsApiResponse = await res.json();
    const items = Array.isArray(data.history) ? data.history : [];
    return items.filter((e) => typeof e?.amount === "number" && typeof e?.date === "string");
  } catch {
    return [];
  }
}

/**
 * Detecta a cadência olhando a mediana dos intervalos entre pagamentos.
 * Mediana > média para evitar enviesamento por dividendo extraordinário esporádico.
 *
 * Retorna `unknown` para histórico com < 2 eventos (não dá pra inferir cadência).
 */
export function detectCadence(history: DividendEvent[]): Cadence {
  if (!history || history.length < 2) return "unknown";

  const sorted = [...history].sort((a, b) => (a.date < b.date ? -1 : 1));
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const days = daysBetween(sorted[i - 1].date, sorted[i].date);
    if (days > 0) intervals.push(days);
  }
  if (intervals.length === 0) return "unknown";

  const median = medianOf(intervals);
  if (median <= 45) return "monthly";
  if (median >= 60 && median <= 110) return "quarterly";
  if (median >= 150 && median <= 210) return "semiannual";
  if (median >= 320 && median <= 400) return "annual";
  return "irregular";
}

/**
 * Projeta dividendos do `stock` para os próximos 12 meses (mês corrente incluso).
 *
 * Retorna sempre 12 buckets em ordem cronológica; meses sem pagamento esperado
 * vêm com `amount: 0`. Multiplica DPA estimado pela `stock.quantity`.
 *
 * Estratégia por cadência:
 * - `monthly|quarterly|semiannual|annual`: distribui DPA estimado nos meses futuros
 *   alinhados com a data do último pagamento + N meses do ciclo.
 * - `irregular`: distribui o total anual estimado uniformemente (1/12 por mês).
 * - `unknown`: retorna 12 buckets com `amount: 0`.
 */
export function projectDividends(
  stock: Pick<Stock, "ticker" | "quantity">,
  history: DividendEvent[],
  now: Date = new Date()
): MonthBucket[] {
  const buckets = build12Buckets(now);
  if (!history || history.length === 0 || !stock.quantity || stock.quantity <= 0) {
    return buckets;
  }

  const cadence = detectCadence(history);
  const dpa = estimateDpa(history);
  if (dpa <= 0) return buckets;

  const sorted = [...history].sort((a, b) => (a.date < b.date ? -1 : 1));
  const lastEvent = sorted[sorted.length - 1];

  if (cadence === "unknown" || cadence === "irregular") {
    // Total anual estimado distribuído por 12 meses.
    const annualEstimate = estimateAnnualTotal(history);
    const perMonth = (annualEstimate * stock.quantity) / 12;
    return buckets.map((b) => ({ ...b, amount: round2(perMonth) }));
  }

  const stepMonths = cadenceToMonths(cadence);
  if (stepMonths === null) return buckets;

  // Calcula a primeira data de pagamento futura partindo do último pagamento conhecido.
  let next = addMonthsUtc(parseIsoDate(lastEvent.date), stepMonths);
  const horizonEnd = endOfMonthUtc(addMonthsUtc(startOfMonthUtc(now), 11));

  while (next <= horizonEnd) {
    const monthKey = isoMonth(next);
    const bucket = buckets.find((b) => b.month === monthKey);
    if (bucket) {
      bucket.amount = round2(bucket.amount + dpa * stock.quantity);
    }
    next = addMonthsUtc(next, stepMonths);
  }

  return buckets;
}

/* ─── helpers puros ──────────────────────────────────────────────────────── */

function build12Buckets(now: Date): MonthBucket[] {
  const start = startOfMonthUtc(now);
  return Array.from({ length: 12 }, (_, i) => ({
    month: isoMonth(addMonthsUtc(start, i)),
    amount: 0,
  }));
}

function startOfMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function endOfMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59));
}

function addMonthsUtc(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate()));
}

function isoMonth(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function parseIsoDate(s: string): Date {
  // s vem como "YYYY-MM-DD" — força UTC midnight pra evitar deslize por timezone local.
  const [y, m, d] = s.split("-").map((p) => Number(p));
  return new Date(Date.UTC(y, m - 1, d));
}

function daysBetween(a: string, b: string): number {
  const da = parseIsoDate(a).getTime();
  const db = parseIsoDate(b).getTime();
  return Math.round((db - da) / (1000 * 60 * 60 * 24));
}

function medianOf(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function cadenceToMonths(c: Cadence): number | null {
  switch (c) {
    case "monthly":
      return 1;
    case "quarterly":
      return 3;
    case "semiannual":
      return 6;
    case "annual":
      return 12;
    default:
      return null;
  }
}

/** DPA estimado = média dos últimos 4 pagamentos (ou todos se < 4). */
function estimateDpa(history: DividendEvent[]): number {
  if (history.length === 0) return 0;
  const sorted = [...history].sort((a, b) => (a.date < b.date ? -1 : 1));
  const last = sorted.slice(-4);
  const sum = last.reduce((acc, e) => acc + (e.amount || 0), 0);
  return sum / last.length;
}

/** Total anual estimado = soma dos pagamentos no último ano (a partir do mais recente). */
function estimateAnnualTotal(history: DividendEvent[]): number {
  if (history.length === 0) return 0;
  const sorted = [...history].sort((a, b) => (a.date < b.date ? -1 : 1));
  const last = sorted[sorted.length - 1];
  const cutoff = addMonthsUtc(parseIsoDate(last.date), -12);
  return sorted.filter((e) => parseIsoDate(e.date) >= cutoff).reduce((acc, e) => acc + e.amount, 0);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
