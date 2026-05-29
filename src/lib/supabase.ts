/**
 * Cliente Supabase do Praxia. Singleton — uma instancia por app.
 *
 * As envs sao injetadas pelo Vite no build (VITE_*). Em DEV ficam em
 * `.env.local` (gitignored); em PROD vao no dashboard da Vercel. Nunca
 * commitamos chave aqui.
 *
 * Auth: email + senha (principal) com magic link e reset de senha por email
 * como alternativas. Persistencia: cookies + localStorage (default do
 * supabase-js, funciona offline-first). detectSessionInUrl trata os callbacks
 * de magic link e do link de recuperacao de senha.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Aviso visivel no console em DEV — em PROD, qualquer call ao supabase quebra
  // claramente (mensagem do proprio sdk).
  // eslint-disable-next-line no-console
  console.warn(
    "[Praxia] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY ausentes. " +
      "Auth e persistencia server-side estao desabilitados. " +
      "Crie um projeto em https://supabase.com/dashboard e configure as envs."
  );
}

/**
 * Cliente Supabase. Tipos das tabelas vivem em `supabaseSchema.ts` e sao
 * aplicados explicitamente nos helpers de `supabaseSync.ts` via cast — o
 * generic Database do supabase-js v2.106 exige shape com __InternalSupabase
 * que so o gerador `supabase gen types` produz, fora de escopo no MVP.
 */
export const supabase = createClient(
  SUPABASE_URL || "https://placeholder.supabase.co",
  SUPABASE_ANON_KEY || "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // necessario pra magic link callback
      flowType: "pkce",
    },
  }
);

/** True quando as envs estao configuradas — UI pode esconder login real. */
export const isSupabaseConfigured = !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
