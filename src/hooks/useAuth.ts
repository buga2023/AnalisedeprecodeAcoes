/**
 * Hook de autenticacao do Praxia — wrap leve do supabase.auth.
 *
 * Expoe estado (user, session, loading, passwordRecovery) + acoes:
 * email+senha (signInWithPassword, signUpWithPassword), recuperacao
 * (resetPassword, updatePassword), magic link (signInWithMagicLink) e signOut.
 * Escuta onAuthStateChange pra refletir login/logout em tempo real (multi-tab)
 * e detectar o evento PASSWORD_RECOVERY (link de reset clicado).
 */

import { useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

/** Resultado padrao das acoes de auth. */
type AuthResult = { ok: true; needsConfirmation?: boolean } | { ok: false; error: string };

const NOT_CONFIGURED: AuthResult = {
  ok: false,
  error: "Auth nao configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function useAuth() {
  // Estado inicial lazy: sem Supabase configurado ja nasce nao-carregando
  // (nada a buscar), evitando setState sincrono dentro do efeito.
  const [state, setState] = useState<AuthState>(() => ({
    user: null,
    session: null,
    loading: isSupabaseConfigured,
  }));
  // True entre o clique no link de reset (evento PASSWORD_RECOVERY) e a troca
  // de senha bem-sucedida. O App.tsx usa pra forcar a tela de nova senha.
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    // Quando as envs faltam, nao tenta nada — fica em estado nao-autenticado
    // e o LoginScreen mostra erro de configuracao.
    if (!isSupabaseConfigured) return;

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

    // 2) Escuta mudancas (login, logout, refresh, signed_in, recovery).
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
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

  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      if (!isSupabaseConfigured) return NOT_CONFIGURED;
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizeEmail(email),
        password,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },
    []
  );

  const signUpWithPassword = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      if (!isSupabaseConfigured) return NOT_CONFIGURED;
      const { data, error } = await supabase.auth.signUp({
        email: normalizeEmail(email),
        password,
      });
      if (error) return { ok: false, error: error.message };
      // "Confirm email" OFF → vem sessao e o onAuthStateChange loga sozinho.
      // Se vier null, a confirmacao ainda esta ligada no painel: avisa a UI.
      if (!data.session) return { ok: true, needsConfirmation: true };
      return { ok: true };
    },
    []
  );

  const resetPassword = useCallback(async (email: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured) return NOT_CONFIGURED;
    const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
      redirectTo: window.location.origin,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }, []);

  const updatePassword = useCallback(async (newPassword: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured) return NOT_CONFIGURED;
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: error.message };
    setPasswordRecovery(false);
    return { ok: true };
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
  }, []);

  return {
    user: state.user,
    session: state.session,
    loading: state.loading,
    isAuthenticated: !!state.user,
    passwordRecovery,
    signInWithMagicLink,
    signInWithPassword,
    signUpWithPassword,
    resetPassword,
    updatePassword,
    signOut,
  };
}
