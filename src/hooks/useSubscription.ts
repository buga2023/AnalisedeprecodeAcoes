/**
 * Estado de assinatura/plano do usuário (fonte de verdade no client).
 *
 * Hidrata ao login (recebe `userId` do `useAuth`, liftado em `App.tsx`). MVP:
 * busca on-mount + `refresh()` manual (sem realtime — polish futuro). Telas
 * recebem `plan` por prop, não consultam billing direto.
 *
 * Inerte quando billing dormente: `fetchSubscriptionFromServer` devolve null →
 * plan "free" sem uso; nenhuma UI de paywall dispara (server nunca dá 402).
 */

import { useCallback, useEffect, useState } from "react";
import type { Plan, Subscription, UsageThisMonth } from "@/types/stock";
import { hasProAccess } from "@/lib/billing";
import { fetchSubscriptionFromServer, fetchUsageThisMonth } from "@/lib/supabaseBilling";

interface SubscriptionState {
  plan: Plan;
  subscription: Subscription | null;
  usageThisMonth: UsageThisMonth | null;
  loading: boolean;
}

const INITIAL: SubscriptionState = {
  plan: "free",
  subscription: null,
  usageThisMonth: null,
  loading: false,
};

export function useSubscription(userId: string | null) {
  const [state, setState] = useState<SubscriptionState>(INITIAL);

  const refresh = useCallback(async () => {
    if (!userId) {
      setState(INITIAL);
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    const [subscription, usageThisMonth] = await Promise.all([
      fetchSubscriptionFromServer(userId),
      fetchUsageThisMonth(userId),
    ]);
    setState({
      plan: hasProAccess(subscription) ? "pro" : "free",
      subscription,
      usageThisMonth,
      loading: false,
    });
  }, [userId]);

  useEffect(() => {
    // IIFE async: evita setState síncrono no corpo do effect (mesmo padrão dos
    // modais que disparam consulta on-mount).
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  return {
    plan: state.plan,
    subscription: state.subscription,
    usageThisMonth: state.usageThisMonth,
    loading: state.loading,
    isPro: state.plan === "pro",
    refresh,
  };
}
