# Design — Login por email + senha (com magic-link e reset)

> Data: 2026-05-29 · Branch base: `feat/billing-dormante`
> Estado atual: auth via Supabase **magic-link** (`signInWithOtp`), sem senha.

## Objetivo

Permitir que o usuário **crie conta com email + senha** e **faça login com email + senha**,
dispensando a confirmação de email no cadastro. Manter o magic-link como alternativa e
incluir recuperação de senha por email.

## Decisões (aprovadas)

| Decisão | Escolha |
|---|---|
| Magic-link | **Manter** junto com email+senha (senha é o método principal) |
| Reset de senha | **Incluir** (`resetPasswordForEmail` + tela de nova senha) |
| Senha mínima | **8 caracteres** (client + setting do painel Supabase) |
| Tela de nova senha | **Step dentro do `LoginScreen`** (não tela dedicada) |
| Confirmação de email | **Desligada** no painel Supabase (passo manual, não código) |

## Arquitetura

Mudança cirúrgica em 3 arquivos de código + 1 ajuste de comentário. Sem novas deps.

### 1. `src/hooks/useAuth.ts`

Mantém `signInWithMagicLink`, `signOut`, `user`, `session`, `loading`, `isAuthenticated`.
Adiciona:

- `signInWithPassword(email, password)` → `supabase.auth.signInWithPassword`.
  Retorna `{ ok: true } | { ok: false, error }`.
- `signUpWithPassword(email, password)` → `supabase.auth.signUp`.
  Com "Confirm email" OFF a resposta traz `session` → `onAuthStateChange` loga sozinho.
  Se vier `session: null` (confirmação ainda ligada no painel), retorna
  `{ ok: true, needsConfirmation: true }` pra UI avisar — degradação graciosa.
- `resetPassword(email)` → `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })`.
- `updatePassword(newPassword)` → `supabase.auth.updateUser({ password })`. Usado no fluxo de recuperação.
- Novo estado `passwordRecovery: boolean`, ligado quando `onAuthStateChange` emite o evento
  `"PASSWORD_RECOVERY"`. Permanece true até `updatePassword` ter sucesso (que o reseta).

Todas as ações respeitam o guard `isSupabaseConfigured` (mesmo padrão de `signInWithMagicLink`).

### 2. `src/components/LoginScreen.tsx`

Reescrita preservando o visual editorial (tokens, gradiente, `Field`, `inputStyle`).

- `mode: "signin" | "signup"` — toggle no topo (Entrar / Criar conta).
- `step: "input" | "sent" | "reset-sent" | "recovery"`.
- Campos no step `input`: Email + Senha (toggle mostrar/ocultar senha).
- Validação client: email via regex existente; senha `length >= 8`. Botão primário desabilitado
  até válido.
- Botão primário: `signInWithPassword` (signin) ou `signUpWithPassword` (signup).
  - Erro → mostra no bloco de erro já existente.
  - Signup com `needsConfirmation` → mensagem "confira seu email pra confirmar".
- Link "Entrar com link mágico" → `signInWithMagicLink` → step `sent` (já existe).
- Link "Esqueci minha senha" → `resetPassword` → step `reset-sent`.
- Step `recovery`: campo Nova senha + Confirmar (≥ 8, iguais) → `updatePassword`.
  Renderizado quando a prop `recoveryMode` é true (vinda do `App.tsx`).

### 3. `src/App.tsx`

- `useAuth` passa a expor `passwordRecovery`.
- Antes do bloco `if (user)`, se `passwordRecovery` for true, renderiza
  `<LoginScreen recoveryMode />` — porque a sessão de recuperação já autentica o usuário,
  então sem esse desvio ele cairia direto na app sem trocar a senha.

### 4. `src/lib/supabase.ts`

Atualiza o comentário de cabeçalho (hoje diz "magic link sem senha"). Config `pkce` +
`detectSessionInUrl` permanece — magic-link e o link de reset dependem dela.

## Passo manual (painel Supabase — não é código)

1. Authentication → Providers → Email → **"Confirm email" = OFF**.
2. Authentication → Policies/Settings → **Minimum password length = 8** (alinhar com o client).
3. (já coberto) Redirect URLs incluem a origin de dev e prod.

## Erros e bordas

- Envs Supabase ausentes (`!isSupabaseConfigured`): todas as ações retornam erro de config;
  UI já trata via aviso amarelo existente.
- Login com credencial errada: Supabase devolve "Invalid login credentials" → mostrado no bloco de erro.
- Signup de email já existente: erro do Supabase propagado.
- Senha < 8: bloqueada no client antes da chamada.
- `needsConfirmation` (se o painel não tiver sido ajustado): mensagem clara em vez de logar.

## Testes (TDD)

Novo `src/hooks/useAuth.test.ts` com `supabase.auth` mockado (`vi.mock("@/lib/supabase")`):

- `signInWithPassword` ok / erro.
- `signUpWithPassword` com sessão (loga) / com `session: null` (`needsConfirmation`).
- `resetPassword` chama `resetPasswordForEmail` com `redirectTo`.
- `updatePassword` chama `updateUser` e reseta `passwordRecovery`.
- evento `PASSWORD_RECOVERY` liga `passwordRecovery`.
- guard `isSupabaseConfigured === false` → erro de config em cada ação.

Validação final: `npx tsc -b` (0 erros) · `npm run test:run` (verde) · `npm run build` (verde) ·
lint dos arquivos tocados limpo.

## Fora de escopo (YAGNI)

- OAuth social (Google/Apple).
- Política de senha além de comprimento mínimo.
- "Lembrar de mim" / expiração custom de sessão (Supabase já persiste por padrão).
