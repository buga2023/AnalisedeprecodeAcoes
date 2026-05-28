/**
 * Hook de autenticacao do Praxia — wrap leve do supabase.auth.
 *
 * Expoe estado (user, session, loading) + acoes (signInWithMagicLink, signOut).
 * Escuta onAuthStateChange pra refletir login/logout em tempo real (multi-tab).
 *
 * Estrategia: magic link sem senha. O usuario digita email, recebe link,
 * clica e cai de volta no app ja autenticado (supabase trata o callback via
 * detectSessionInUrl=true em supabase.ts).
 */

import { useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  });

  useEffect(() => {
    // Quando as envs faltam, nao tenta nada — fica em estado nao-autenticado
    // e o LoginScreen mostra erro de configuracao.
    if (!isSupabaseConfigured) {
      setState({ user: null, session: null, loading: false });
      return;
    }

    let mounted = true;

    // 1) Sessao corrente (pode vir do localStorage do supabase-js).
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setState({
        user: data.session?.user ?? null,
        session: data.session,
        loading: false,
      });
    });

    // 2) Escuta mudancas (login, logout, refresh, signed_in via magic link).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState({
        user: session?.user ?? null,
        session,
        loading: false,
      });
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInWithMagicLink = useCallback(
    async (email: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (!isSupabaseConfigured) {
        return {
          ok: false,
          error: "Auth nao configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
        };
      }
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          // URL pra onde o link do email leva — usado em prod (Vercel) tambem.
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },
    []
  );

  const signOut = useCallback(async (): Promise<void> => {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
  }, []);

  return {
    user: state.user,
    session: state.session,
    loading: state.loading,
    isAuthenticated: !!state.user,
    signInWithMagicLink,
    signOut,
  };
}
