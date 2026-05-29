/**
 * Leitura de billing do Supabase (client-side, anon + RLS).
 *
 * O usuário só LÊ sua própria subscription/uso (writes vêm do servidor via
 * service_role — checkout/webhook/usageGuard). Degrada para null/zero quando
 * Supabase não está configurado (DEV sem .env). Mesmo padrão de `supabaseSync.ts`.
 */

import type { Subscription, UsageThisMonth } from "@/types/stock";
import { isSupabaseConfigured, supabase } from "./supabase";
import { currentMonthKey } from "./billing";

interface SubscriptionRow {
  id: string;
  user_id: string;
  mp_preapproval_id: string | null;
  status: Subscription["status"];
  amount_brl: number;
  started_at: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
}

/** Subscription mais recente do usuário. null se inexistente/erro/não configurado. */
export async function fetchSubscriptionFromServer(
  userId: string
): Promise<Subscription | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id,user_id,mp_preapproval_id,status,amount_brl,started_at,current_period_end,cancelled_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as SubscriptionRow;
  return {
    id: row.id,
    userId: row.user_id,
    mpPreapprovalId: row.mp_preapproval_id,
    plan: "pro",
    status: row.status,
    amountBRL: Number(row.amount_brl ?? 0),
    startedAt: row.started_at,
    currentPeriodEnd: row.current_period_end,
    cancelledAt: row.cancelled_at,
  };
}

/** Uso de IA do mês corrente. Zera quando não há registro. */
export async function fetchUsageThisMonth(userId: string): Promise<UsageThisMonth> {
  const month = currentMonthKey();
  const empty: UsageThisMonth = { total: 0, byFeature: {}, month };
  if (!isSupabaseConfigured) return empty;
  const { data, error } = await supabase
    .from("current_month_usage")
    .select("total_this_month,by_feature")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return empty;
  const row = data as { total_this_month: number | null; by_feature: UsageThisMonth["byFeature"] | null };
  return {
    total: Number(row.total_this_month ?? 0),
    byFeature: row.by_feature ?? {},
    month,
  };
}
