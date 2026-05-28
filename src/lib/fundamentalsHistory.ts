/**
 * Cliente do endpoint `/api/fundamentals-history` + fallback a partir de
 * `useRelatorios` quando o Yahoo nao cobre o ticker.
 *
 * Importante: nunca preenchemos campos com valor fabricado. Quando uma metrica
 * nao pode ser derivada com fonte real, o campo retorna `undefined` e a UI
 * mostra "—".
 */

import type { FundamentalHistoryResponse, FundamentalQuarter, Relatorio } from "@/types/stock";

const ENDPOINT = "/api/fundamentals-history";

interface FetchOpts {
  /** Quando true, ignora cache (caller faz read manual). */
  signal?: AbortSignal;
}

export async function fetchFundamentalHistory(
  ticker: string,
  opts: FetchOpts = {}
): Promise<FundamentalHistoryResponse> {
  const url = new URL(ENDPOINT, window.location.origin);
  url.searchParams.set("ticker", ticker.toUpperCase());

  const res = await fetch(url.toString(), { signal: opts.signal });
  if (!res.ok) {
    return {
      ticker: ticker.toUpperCase(),
      quarters: [],
      source: "Yahoo Finance",
      generatedAt: new Date().toISOString(),
      error: `HTTP ${res.status}`,
    };
  }
  return (await res.json()) as FundamentalHistoryResponse;
}

/**
 * Fallback usando `useRelatorios` (relatorios trimestrais ja carregados pelo
 * BrAPI). Calcula APENAS o que pode ser derivado: margem liquida (lucro /
 * receita). ROE e debt/ebitda exigem balanco que `useRelatorios` nao carrega,
 * entao ficam undefined.
 */
export function deriveQuartersFromRelatorios(
  relatorios: Relatorio[]
): FundamentalQuarter[] {
  return relatorios
    .filter((r) => r.dataFim)
    .sort((a, b) => (a.dataFim < b.dataFim ? -1 : 1))
    .map((r) => {
      const netIncome = typeof r.lucroLiquido === "number" ? r.lucroLiquido : undefined;
      const revenue = typeof r.receita === "number" && r.receita > 0 ? r.receita : undefined;
      const margem =
        typeof r.margem === "number" && r.margem !== 0
          ? r.margem
          : netIncome !== undefined && revenue !== undefined
          ? netIncome / revenue
          : undefined;
      return {
        periodo: r.periodo,
        dataFim: r.dataFim,
        netIncome,
        revenue,
        netMargin: margem,
      } as FundamentalQuarter;
    });
}

/**
 * Merge: usa o Yahoo como base e completa campos faltantes com os derivados de
 * relatorios. Quando os dois discordam, prevalece Yahoo (numero auditado pela
 * SEC/CVM via 6K filings — mais confiavel).
 */
export function mergeQuarters(
  yahoo: FundamentalQuarter[],
  fromReports: FundamentalQuarter[]
): FundamentalQuarter[] {
  if (yahoo.length === 0) return fromReports;
  if (fromReports.length === 0) return yahoo;

  const byDate = new Map<string, FundamentalQuarter>();
  for (const q of yahoo) byDate.set(q.dataFim, q);
  for (const q of fromReports) {
    const existing = byDate.get(q.dataFim);
    if (!existing) {
      byDate.set(q.dataFim, q);
    } else {
      byDate.set(q.dataFim, {
        ...existing,
        netIncome: existing.netIncome ?? q.netIncome,
        revenue: existing.revenue ?? q.revenue,
        netMargin: existing.netMargin ?? q.netMargin,
      });
    }
  }
  return Array.from(byDate.values()).sort((a, b) => (a.dataFim < b.dataFim ? -1 : 1));
}

/** True quando o array tem ≥ 4 trimestres com pelo menos 1 metrica preenchida. */
export function hasMeaningfulHistory(quarters: FundamentalQuarter[]): boolean {
  if (quarters.length < 4) return false;
  return quarters.some(
    (q) =>
      q.roe !== undefined ||
      q.netMargin !== undefined ||
      q.debtToEbitda !== undefined ||
      q.dy !== undefined
  );
}
