# Design — Hardening de segurança (força de senha + Sentry + runbook)

> Data: 2026-05-29 · Branch: `feat/billing-dormante`
> Origem: auditoria de segurança desta sessão (webhook MP, RLS, segredos, injeção).
> A auditoria não encontrou vulnerabilidade explorável acima do limiar de 80%; o
> único achado acionável (`increment_usage` exposto a `authenticated`) foi
> corrigido em `supabase/migrations/002_billing.sql`. Esta spec cobre as três
> melhorias **de código/repo** que restaram. Os itens operacionais (rotação de
> segredos, configuração do painel Supabase, aplicação de migrations) são do
> usuário e entram apenas como runbook documentado.

## Objetivo

Endurecer a superfície de auth e ganhar visibilidade de erro em produção, sem
introduzir regressão e sem hardcode de segredos.

## Princípios não-negociáveis

- **Nenhum segredo no código.** DSN do Sentry vem de env (`VITE_SENTRY_DSN` no
  front, `SENTRY_DSN` no back). Ausente → no-op.
- **Mudanças cirúrgicas.** Cada linha alterada rastreável a um dos 3 componentes.
- **Servidor manda na auth.** A validação de senha no client é defesa-em-profundidade;
  o Supabase Auth (bcrypt + salt + leaked-password protection) é a fonte de verdade.
- **Baseline preservado.** `npm run build`, `tsc -b` e `npm run test:run` verdes;
  lint sem novos erros.

---

## Componente 1 — Força de senha (TDD)

### Unidade nova: `src/lib/passwordStrength.ts`
Função pura, sem dependências:

```ts
export interface PasswordCheck { valid: boolean; issues: string[] }
export function validatePasswordStrength(pw: string): PasswordCheck
```

Regras (todas devem passar para `valid: true`):
1. comprimento `>= 8`
2. contém ao menos uma letra (`/\p{L}/u`)
3. contém ao menos um dígito (`/\d/`)

`issues` traz mensagens em PT-BR de cada regra que falhou, na ordem acima.
**Sem** exigência de símbolo/maiúscula (YAGNI). Constante `MIN_PASSWORD_LENGTH = 8`
exportada e reusada pelo `LoginScreen`.

### Testes primeiro: `src/lib/passwordStrength.test.ts`
Casos: vazia; curta; sem dígito; sem letra; válida; símbolo aceito mas não
exigido; letra acentuada conta como letra.

### Integração: `src/components/LoginScreen.tsx`
- Substitui `passwordValid = password.length >= MIN_PASSWORD` por
  `validatePasswordStrength`.
- Regras completas só em `mode === "signup"` e step `"recovery"`. Em
  `mode === "signin"` exige apenas não-vazia (usuários legados).
- Feedback inline: mostra **todas** as `issues` (uma por linha) abaixo do campo
  quando a senha é não-vazia e inválida no contexto que exige regras.
- `MIN_PASSWORD` local sai; passa a vir de `MIN_PASSWORD_LENGTH` da lib.

---

## Componente 2 — Sentry (front + api), env-gated

### Dependências
`@sentry/react` + `@sentry/node` — duas deps novas (item pedido).

### Front: `src/lib/telemetry.ts` (shim existente)
Interface (`initTelemetry`/`captureError`/`captureMessage`) inalterada.
`initTelemetry` chama `Sentry.init` só se `VITE_SENTRY_DSN` existir; senão no-op.
`captureError`/`captureMessage` delegam ao Sentry quando habilitado e mantêm o
`console` como fallback.

### Back: `api/_sentry.ts` (novo)
Init lazy/idempotente gated em `SENTRY_DSN`. `captureApiError(err, endpoint)`
no-op sem DSN. Cabeado nos `catch` de: `checkout.ts`, `mp-webhook.ts`,
`delete-account.ts`, `ai.ts` (no caminho 500 inesperado, não nos 429 esperados).

### Env
`.env.example`: `VITE_SENTRY_DSN` + `SENTRY_DSN` documentados (ausente = no-op).
DSN real só no `.env.local`/Vercel, nunca no repo.

---

## Componente 3 — Runbook no `SECURITY.md`

Seção "Runbook de hardening (pré-produção)": rotação/troca de segredos MP→TEST,
config do painel Supabase, migrations 002/003/004, webhook MP + secret, envs do
Sentry.

---

## Verificação (critério de sucesso)

- `npm run test:run` verde (novos testes de senha passam; existentes seguem verdes).
- `npm run build` + `tsc -b`: 0 erros.
- `npm run lint`: baseline (sem novos erros).
- Sentry no-op sem DSN.

## Fora de escopo

- Rotação efetiva de segredos e config do painel Supabase (operacional).
- Sentry nos proxies de dados não-críticos.
- Mudança no hashing de senha (é do Supabase — não tocar).
- Performance tracing / session replay do Sentry.
