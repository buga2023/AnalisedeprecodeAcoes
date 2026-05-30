/**
 * Exportação de dados pessoais — LGPD Art. 18 V (portabilidade).
 *
 * Roda 100% client-side: lê o localStorage do dispositivo e, se o usuário estiver
 * logado, busca seus dados no Supabase SOB A RLS DELE (cada fetcher filtra por
 * userId; o usuário só lê o que é seu). Sem service_role, sem endpoint novo.
 * Saída: um JSON versionado baixado pelo browser.
 */

import {
  fetchPortfolioFromServer,
  fetchProfileFromServer,
  fetchTransactionsFromServer,
  fetchPreferencesFromServer,
} from "./supabaseSync";
import { listPraxiaLocalKeys } from "./localKeys";

export interface ExportServerData {
  profile: Awaited<ReturnType<typeof fetchProfileFromServer>>;
  portfolio: Awaited<ReturnType<typeof fetchPortfolioFromServer>>;
  transactions: Awaited<ReturnType<typeof fetchTransactionsFromServer>>;
  preferences: Awaited<ReturnType<typeof fetchPreferencesFromServer>>;
}

export interface ExportPayload {
  schema: 1;
  app: "Praxia";
  exportedAt: string;
  /** true quando há dados do servidor (usuário autenticado no momento do export). */
  authenticated: boolean;
  server: ExportServerData | null;
  device: Record<string, unknown>;
}

/** Lê o localStorage do Praxia, parseando JSON quando possível (cai pra string crua). */
export function collectLocalData(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of listPraxiaLocalKeys()) {
    const raw = localStorage.getItem(key);
    if (raw === null) continue;
    try {
      out[key] = JSON.parse(raw);
    } catch {
      out[key] = raw;
    }
  }
  return out;
}

/** Busca os dados do usuário no servidor (sob a RLS dele). null se deslogado. */
export async function collectServerData(userId: string | null): Promise<ExportServerData | null> {
  if (!userId) return null;
  const [profile, portfolio, transactions, preferences] = await Promise.all([
    fetchProfileFromServer(userId),
    fetchPortfolioFromServer(userId),
    fetchTransactionsFromServer(userId),
    fetchPreferencesFromServer(userId),
  ]);
  return { profile, portfolio, transactions, preferences };
}

/** Monta o payload final — puro (recebe data já coletada + timestamp). */
export function buildExportPayload(input: {
  exportedAt: string;
  server: ExportServerData | null;
  device: Record<string, unknown>;
}): ExportPayload {
  return {
    schema: 1,
    app: "Praxia",
    exportedAt: input.exportedAt,
    authenticated: input.server !== null,
    server: input.server,
    device: input.device,
  };
}

/** Dispara o download de um JSON no browser (Blob + objectURL, sem dep nova). */
export function downloadJson(payload: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
