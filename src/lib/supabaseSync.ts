/**
 * Sync helpers entre localStorage e Supabase Postgres.
 *
 * Estrategia: write-through (UI atualiza localStorage imediato; sync remoto
 * em fire-and-forget). Read-on-login: ao detectar user novo, busca do servidor
 * e substitui localStorage. Migration: se servidor estiver vazio e localStorage
 * tiver dados (ex.: usuario que estava em paper-trade local antes do MVP de
 * auth), sobe tudo de uma vez.
 *
 * Todas as funcoes degradam silenciosamente se isSupabaseConfigured = false
 * — assim DEV sem .env.local continua usando so localStorage.
 */

import type { InvestorProfile, Stock, Transaction } from "@/types/stock";
import { isSupabaseConfigured, supabase } from "./supabase";
import type {
  AIVerbosity,
  ChatTone,
  PortfolioStockRow,
  PreferencesRow,
  ProfileRow,
  TransactionRow,
} from "./supabaseSchema";

/* ─── Portfolio (carteira) ─────────────────────────────────────────────── */

/**
 * Le portfolio do servidor. Retorna null se nao configurado ou erro — caller
 * decide se cai no localStorage como fallback.
 */
export async function fetchPortfolioFromServer(
  userId: string
): Promise<Pick<Stock, "ticker" | "name" | "sector" | "quantity" | "cost">[] | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("portfolio_stocks")
    .select("ticker,name,sector,quantity,cost")
    .eq("user_id", userId);
  if (error) {
     
    console.warn("[Praxia] fetchPortfolioFromServer:", error.message);
    return null;
  }
  return (data ?? []).map((row) => ({
    ticker: row.ticker,
    name: row.name ?? "",
    sector: row.sector ?? "",
    quantity: Number(row.quantity ?? 0),
    cost: Number(row.cost ?? 0),
  }));
}

/**
 * Sobe a carteira inteira (upsert por user_id+ticker). Use em mutacoes
 * (addStock, applyTransaction). Fire-and-forget — UI nao espera.
 */
export async function upsertPortfolioStock(
  userId: string,
  stock: Pick<Stock, "ticker" | "name" | "sector" | "quantity" | "cost">
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const row: Partial<PortfolioStockRow> = {
    user_id: userId,
    ticker: stock.ticker,
    name: stock.name || null,
    sector: stock.sector || null,
    quantity: stock.quantity,
    cost: stock.cost,
  };
  const { error } = await supabase.from("portfolio_stocks").upsert(row, {
    onConflict: "user_id,ticker",
  });
  if (error) {
     
    console.warn("[Praxia] upsertPortfolioStock:", error.message);
  }
}

export async function deletePortfolioStock(
  userId: string,
  ticker: string
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from("portfolio_stocks")
    .delete()
    .eq("user_id", userId)
    .eq("ticker", ticker);
  if (error) {
     
    console.warn("[Praxia] deletePortfolioStock:", error.message);
  }
}

/** Migracao one-time: sobe lista inteira numa transacao. */
export async function bulkUploadPortfolio(
  userId: string,
  stocks: Pick<Stock, "ticker" | "name" | "sector" | "quantity" | "cost">[]
): Promise<void> {
  if (!isSupabaseConfigured || stocks.length === 0) return;
  const rows: Partial<PortfolioStockRow>[] = stocks.map((s) => ({
    user_id: userId,
    ticker: s.ticker,
    name: s.name || null,
    sector: s.sector || null,
    quantity: s.quantity,
    cost: s.cost,
  }));
  const { error } = await supabase.from("portfolio_stocks").upsert(rows, {
    onConflict: "user_id,ticker",
  });
  if (error) {
     
    console.warn("[Praxia] bulkUploadPortfolio:", error.message);
  }
}

/* ─── Profile (perfil de investidor) ───────────────────────────────────── */

export async function fetchProfileFromServer(
  userId: string
): Promise<InvestorProfile | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("risk,horizon,interests,quiz_completed_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  // Se quiz nao foi feito ainda, retorna null.
  if (!data.risk || !data.horizon) return null;
  return {
    risk: data.risk,
    horizon: data.horizon,
    interests: (data.interests ?? []) as InvestorProfile["interests"],
    completedAt: data.quiz_completed_at ?? new Date().toISOString(),
  };
}

export async function saveProfileToServer(
  userId: string,
  profile: InvestorProfile
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const row: Partial<ProfileRow> = {
    user_id: userId,
    risk: profile.risk,
    horizon: profile.horizon,
    interests: profile.interests,
    quiz_completed_at: profile.completedAt,
  };
  const { error } = await supabase.from("profiles").upsert(row, {
    onConflict: "user_id",
  });
  if (error) {
     
    console.warn("[Praxia] saveProfileToServer:", error.message);
  }
}

export async function clearProfileFromServer(userId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from("profiles")
    .update({
      risk: null,
      horizon: null,
      interests: [],
      quiz_completed_at: null,
    })
    .eq("user_id", userId);
  if (error) {
     
    console.warn("[Praxia] clearProfileFromServer:", error.message);
  }
}

/* ─── Transactions ─────────────────────────────────────────────────────── */

function txTypeToKind(t: Transaction["type"]): TransactionRow["kind"] {
  return t; // "buy" | "sell" — schema bate
}

export async function fetchTransactionsFromServer(
  userId: string
): Promise<Transaction[] | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("transactions")
    .select("id,ticker,kind,quantity,price,total,occurred_at,note")
    .eq("user_id", userId)
    .order("occurred_at", { ascending: false });
  if (error) {
     
    console.warn("[Praxia] fetchTransactionsFromServer:", error.message);
    return null;
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    ticker: row.ticker,
    type: row.kind === "dividend" ? "buy" : row.kind, // schema novo aceita dividend, tipo legado nao
    orderType: "Mercado", // schema legado tem; servidor nao precisa armazenar
    shares: Number(row.quantity),
    price: Number(row.price),
    total: Number(row.total),
    fee: 0, // schema legado tem fee separado; servidor nao precisa MVP
    timestamp: row.occurred_at,
  }));
}

export async function insertTransactionOnServer(
  userId: string,
  tx: Transaction
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from("transactions").insert({
    id: tx.id,
    user_id: userId,
    ticker: tx.ticker,
    kind: txTypeToKind(tx.type),
    quantity: tx.shares,
    price: tx.price,
    total: tx.total,
    occurred_at: tx.timestamp,
  });
  if (error) {
     
    console.warn("[Praxia] insertTransactionOnServer:", error.message);
  }
}

export async function bulkUploadTransactions(
  userId: string,
  txs: Transaction[]
): Promise<void> {
  if (!isSupabaseConfigured || txs.length === 0) return;
  const rows = txs.map((tx) => ({
    id: tx.id,
    user_id: userId,
    ticker: tx.ticker,
    kind: txTypeToKind(tx.type),
    quantity: tx.shares,
    price: tx.price,
    total: tx.total,
    occurred_at: tx.timestamp,
  }));
  const { error } = await supabase
    .from("transactions")
    .upsert(rows, { onConflict: "id" });
  if (error) {
     
    console.warn("[Praxia] bulkUploadTransactions:", error.message);
  }
}

export async function clearAllTransactionsOnServer(userId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from("transactions").delete().eq("user_id", userId);
  if (error) {
     
    console.warn("[Praxia] clearAllTransactionsOnServer:", error.message);
  }
}

/* ─── Preferences (UI) ─────────────────────────────────────────────────── */

export interface ServerPreferences {
  accent: string;
  tone: ChatTone;
  aiVerbosity: AIVerbosity;
}

export async function fetchPreferencesFromServer(
  userId: string
): Promise<ServerPreferences | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("preferences")
    .select("accent,tone,ai_verbosity")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    accent: data.accent,
    tone: data.tone,
    aiVerbosity: data.ai_verbosity,
  };
}

export async function savePreferencesToServer(
  userId: string,
  prefs: ServerPreferences
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const row: Partial<PreferencesRow> = {
    user_id: userId,
    accent: prefs.accent,
    tone: prefs.tone,
    ai_verbosity: prefs.aiVerbosity,
  };
  const { error } = await supabase.from("preferences").upsert(row, {
    onConflict: "user_id",
  });
  if (error) {
     
    console.warn("[Praxia] savePreferencesToServer:", error.message);
  }
}
