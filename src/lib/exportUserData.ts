/**
 * Exportação de dados do usuário (LGPD Art. 18 V — portabilidade).
 *
 * Client-side: reusa os helpers `fetch*FromServer` (rodam com RLS, cada usuário
 * só lê o próprio) + varre o localStorage (`praxia-*` / `stocks-ai*`) e gera um
 * JSON baixável. Sem novo endpoint — o servidor já expõe o dado via RLS.
 *
 * Separação puro/efeito: `buildExportPayload` e `snapshotLocalStorage` são
 * testáveis; `exportUserDataAsJSON` orquestra fetch + download.
 */

import type { InvestorProfile, Stock, Transaction } from "@/types/stock";
import {
  fetchPortfolioFromServer,
  fetchProfileFromServer,
  fetchTransactionsFromServer,
  fetchPreferencesFromServer,
  type ServerPreferences,
} from "./supabaseSync";

/** Prefixos das chaves de dado pessoal no localStorage (mesmo critério do erase). */
const LOCAL_PREFIXES = ["praxia-", "stocks-ai"];

export interface ServerExport {
  portfolio: Pick<Stock, "ticker" | "name" | "sector" | "quantity" | "cost">[] | null;
  perfil: InvestorProfile | null;
  transacoes: Transaction[] | null;
  preferencias: ServerPreferences | null;
}

export interface ExportPayload {
  app: "Praxia";
  exported_at: string;
  base: string;
  conta: { userId: string; email: string };
  servidor: ServerExport;
  dispositivo: Record<string, unknown>;
}

/** Monta o objeto de exportação. Puro — não toca rede nem DOM. */
export function buildExportPayload(
  account: { userId: string; email: string },
  server: ServerExport,
  localSnapshot: Record<string, unknown>,
  exportedAt: string
): ExportPayload {
  return {
    app: "Praxia",
    exported_at: exportedAt,
    base: "LGPD Art. 18, V — portabilidade dos dados",
    conta: account,
    servidor: server,
    dispositivo: localSnapshot,
  };
}

/** Coleta as chaves de dado pessoal do localStorage, parseando JSON quando possível. */
export function snapshotLocalStorage(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !LOCAL_PREFIXES.some((p) => key.startsWith(p))) continue;
      const raw = localStorage.getItem(key);
      if (raw == null) continue;
      try {
        out[key] = JSON.parse(raw);
      } catch {
        out[key] = raw; // valor não-JSON: guarda cru
      }
    }
  } catch {
    // localStorage indisponível (modo privado) — exporta só o servidor.
  }
  return out;
}

function triggerDownload(payload: ExportPayload, dateStr: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `praxia-meus-dados-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Busca os dados do servidor (em paralelo) + snapshot local e dispara o download
 * do JSON. Os fetchers degradam pra null sem Supabase configurado.
 */
export async function exportUserDataAsJSON(userId: string, email: string): Promise<void> {
  const [portfolio, perfil, transacoes, preferencias] = await Promise.all([
    fetchPortfolioFromServer(userId),
    fetchProfileFromServer(userId),
    fetchTransactionsFromServer(userId),
    fetchPreferencesFromServer(userId),
  ]);
  const now = new Date();
  const payload = buildExportPayload(
    { userId, email },
    { portfolio, perfil, transacoes, preferencias },
    snapshotLocalStorage(),
    now.toISOString()
  );
  triggerDownload(payload, now.toISOString().split("T")[0]);
}
