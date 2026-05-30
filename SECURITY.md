# Security — Praxia

Documento operacional sobre estado atual de segurança e dívidas conhecidas.
Última atualização: 2026-05-28.

## Estado dos endpoints serverless

Todos os endpoints em `api/*.ts` agora têm CORS + rate-limit + (quando aplicável) validação de input por regex. Resumo:

| Endpoint | CORS | Rate-limit | Validação |
|---|---|---|---|
| `api/ai.ts` | ✅ | 60s/10 + burst 3/5s | Tipagem messages |
| `api/brapi.ts` | ✅ | 60s/120 + burst 30/5s | regex ticker + cap 30 tickers |
| `api/dividends.ts` | ✅ | 60s/30 | regex B3/US |
| `api/fundamentals.ts` | ✅ | 60s/10 + burst 3/5s | regex ticker, usa `_llm.ts` (sem bypass) |
| `api/fundamentals-history.ts` | ✅ | 60s/30 | regex B3/US |
| `api/macro.ts` | ✅ | 60s/60 + burst 10/5s | sem input de usuário |
| `api/market.ts` | ✅ | 60s/60 + burst 10/5s | hardcoded symbols |
| `api/news.ts` | ✅ | 60s/30 + burst 5/5s | regex ticker, slice q |
| `api/scrape.ts` | ✅ | 60s/20 + burst 3/5s | regex B3 strict |
| `api/world-news.ts` | ✅ | 60s/30 + burst 5/5s (skip cron) | params internos |

Todos os endpoints fazem logging restrito: `error.message.slice(0, 120)` ou similar — nunca despejam payload completo no Vercel logs.

## Auth

Autenticação real via **Supabase Auth**: login/cadastro por email+senha
(`useAuth.signInWithPassword`/`signUpWithPassword`), reset de senha por email e
magic-link como alternativa. Senhas são hasheadas server-side pelo Supabase
(bcrypt + salt) — o app nunca armazena senha. Validação de força no client
(`src/lib/passwordStrength.ts`: ≥8 + letra + número) como defesa-em-profundidade.
O placeholder `admin/1234` foi **removido** (substituído em `f09fd45`).
Pré-requisitos de painel (min length, leaked-password protection) no runbook abaixo.

## Persistência

Persistência server-side em **Supabase Postgres** (RLS por owner) com
write-through + sync on login; `localStorage` segue como cache local e fallback
offline. (A decisão de stack acabou sendo Supabase, não Convex.)

## Dependências com CVE pendente

### xlsx@0.18.5 (Prototype Pollution + ReDoS)

**Status**: **mitigado em código**, upgrade formal **bloqueado por ambiente**.

CVEs:
- GHSA-4r6h-8v6p-xvw6 (Prototype Pollution)
- GHSA-5pgg-2g8v-p4x9 (ReDoS via crafted regex)

**Defesas ativas** em `src/lib/sheetParser.ts`:
1. Tamanho máximo 5 MB (`MAX_SHEET_BYTES`) — bloqueia vetor de ReDoS por arquivo gigante.
2. `Object.create(null)` em todos os objetos-resultado — chaves bizarras ficam isoladas do prototype global.
3. `FORBIDDEN_HEADER_KEYS = ["__proto__", "constructor", "prototype"]` — bloqueia injeção via header malicioso.

**Upgrade pendente**: a versão atualizada (0.20.3+) vive no CDN próprio do SheetJS, fora do npm registry. Tentativa de `npm install xlsx@https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` falha no ambiente atual com `SELF_SIGNED_CERT_IN_CHAIN` (proxy corporativo intercepta SSL).

**Ação para o time de infra/devops**:
```bash
# Em ambiente com rede sem MITM SSL ou com cafile correto:
npm install --save xlsx@https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
# A API é drop-in. Nenhum refactor em sheetParser.ts ou exportResults.ts.
```
Alternativa: configurar `npm config set cafile <path-to-corp-cert>` ou usar `@e965/xlsx` (fork community no npm padrão).

## Login placeholder público — RESOLVIDO

O placeholder `admin/1234` foi removido; a auth real é Supabase email+senha
(ver seção Auth). Mantido aqui só como registro histórico do achado B5.

## Histórico de hardening desta sessão

1. Adicionado `checkRateLimit` em `api/macro.ts`, `api/world-news.ts`, `api/market.ts` (eram os 3 endpoints expostos sem teto de chamadas).
2. Padronizado logging restrito (`.slice(0, 120)` ou genérico) em todos os endpoints — sem dump de payload.
3. Verificado que `api/fundamentals.ts` **NÃO** chama Groq direto (usa `_llm.ts` compartilhado, que respeita rate-limit + multi-provider). Suspeita inicial era falsa.
4. Formalizado documento de mitigações do `xlsx@0.18.5`.

## Próximos passos críticos (em ordem)

1. **Auth real** (Convex) — bloqueador #1 pra cobrar
2. **Persistência server-side** (Convex) — bloqueador #2
3. **Pagamento** (Mercado Pago) — bloqueador #3
4. **Compliance BR** (LGPD + termo + disclaimer CVM) — bloqueador #4
5. **Upgrade xlsx** em ambiente apropriado — risco residual baixo dadas as defesas
6. **Sentry + Analytics** — visibilidade pós-launch

## Auditoria de segurança 2026-05-29 (billing/auth)

Revisão focada do branch `feat/billing-dormante` (webhook MP, RLS, segredos,
injeção). **Nenhuma vulnerabilidade explorável acima de 80% de confiança.** O
webhook MP é fail-closed (HMAC timing-safe, vínculo de propriedade por
`external_reference`), `delete-account` é owner-scoped, e RLS é owner-only. Um
achado acionável foi corrigido:

- **`increment_usage` (SECURITY DEFINER) deixou de ser concedida a
  `authenticated`** (`002_billing.sql`). Antes, exposta via PostgREST RPC,
  permitia a qualquer usuário logado incrementar o contador de uso de OUTRO
  (cross-tenant write → empurra a vítima além do limite free). O servidor chama
  via `service_role` (ignora grants), então a restrição não quebra nada.

Também adicionados nesta passagem:
- **Validação de força de senha no client** (`src/lib/passwordStrength.ts`):
  ≥8 + letra + número, aplicada em criar-conta e nova-senha (signin não trava por
  composição). Defesa-em-profundidade — o Supabase Auth (bcrypt+salt) segue como
  fonte de verdade.
- **Sentry cabeado** (`src/lib/telemetry.ts` front + `api/_sentry.ts` back),
  env-gated por `VITE_SENTRY_DSN` / `SENTRY_DSN`, no-op sem DSN. DSN nunca no
  código. Captura nos 4 handlers críticos: checkout, mp-webhook, delete-account, ai.

## Runbook de hardening (pré-produção)

Checklist operacional — só o time/usuário executa (não é código). Em ordem de
prioridade:

1. **Segredos (maior risco).**
   - Trocar credenciais Mercado Pago de PRODUÇÃO (`APP_USR-…`) por **TEST-…** até
     a hora de cobrar de verdade. As atuais cobram no primeiro teste.
   - Rotacionar qualquer chave que existiu em `.env` compartilhado (MP,
     OpenRouter, Groq, Gemini, Supabase service-role) — tratar como exposta.
   - Confirmar que `SUPABASE_SERVICE_ROLE_KEY` só vive no env do Vercel (server),
     nunca prefixado `VITE_`.
2. **Painel Supabase (auth).**
   - Authentication → Settings → **Minimum password length = 8** (alinha com o client).
   - Ligar **Leaked password protection** (checa HaveIBeenPwned).
   - Confirmar estado de **"Confirm email"** conforme a decisão de produto.
3. **Migrations.** Aplicar **002 (com o fix de RLS) + 003 + 004** no Supabase
   Dashboard antes de ligar billing.
4. **Webhook MP.** Registrar `…/api/mp-webhook` no painel MP e salvar
   `MERCADO_PAGO_WEBHOOK_SECRET` (sem ele o webhook responde 503 — fail-closed).
5. **Sentry.** Adicionar `VITE_SENTRY_DSN` (front) + `SENTRY_DSN` (back) nas envs
   do Vercel quando quiser visibilidade de erro em produção.
