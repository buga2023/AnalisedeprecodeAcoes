# Deploy grátis + Billing dormante — Design

> Data: 2026-05-29 · Status: aprovado para planejamento
> Origem: sessão de brainstorming sobre "MVP pronto? add cobrança + deploy".
> Documento de referência herdado: `BILLING_PLAN.md` (raiz) — passos 1–14.

## Contexto

O MVP da Praxia já tem auth real (magic-link Supabase), persistência server-side
(Postgres + RLS), LGPD (delete-account, termos, banner, disclaimer CVM) e Fases
0–7 de features entregues. O `SECURITY.md` está desatualizado: cita Convex e
`admin/1234` como bloqueadores, mas ambos já foram resolvidos via Supabase.

Falta pra **cobrar**: o billing está 100% planejado (`BILLING_PLAN.md`,
`supabase/migrations/002_billing.sql`, tipos em `src/types/stock.ts`) mas 0%
implementado. E depende de infra externa que ainda não existe: conta Mercado
Pago (abrir leva ~3 dias úteis) e URL pública deployada.

## Decisões tomadas no brainstorming

| Decisão | Valor |
|---|---|
| Sequência | **Caminho A** — lançar grátis agora, billing dormante, ligar depois |
| Modelo de cobrança | **Free = 10 consultas IA/mês · Pro = ilimitado, R$ 29/mês** (segue BILLING_PLAN) |
| Supabase | Reusar o projeto atual como prod (não criar projeto novo) |
| Domínio | `praxia.vercel.app` (subdomínio grátis); domínio próprio fica pra depois |
| Gate dormente | Flag explícita `BILLING_ENABLED` (NÃO o trigger "sem service_role" do BILLING_PLAN) |

### Por que `BILLING_ENABLED` e não o trigger do BILLING_PLAN

O BILLING_PLAN (passo 8) propõe desligar o gate quando `SUPABASE_SERVICE_ROLE_KEY`
está ausente. Isso não serve: `api/delete-account.ts:25` já lê essa env, então
ela **estará setada em produção**. Com o trigger original, o gate ligaria sozinho
no deploy grátis. Trocamos por uma flag dedicada `BILLING_ENABLED`.

## Arquitetura — 3 entregas

### Entrega 1 — Deploy do MVP grátis

Não depende de Mercado Pago. Põe o app no ar grátis e ilimitado.

**Passos de infra (manuais do usuário, guiados):**
1. Supabase Dashboard → SQL Editor → rodar `001_initial.sql` e `002_billing.sql`
   (a `002` cria as tabelas de billing, mas sem ativar cobrança — flag off).
2. Vercel → conectar repo `main` → setar envs de prod:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
   - chave do provider de IA (`OPENROUTER_API_KEY` ou equivalente — ver `api/_llm.ts`)
   - **NÃO** setar `BILLING_ENABLED` (ausente = grátis).
3. Supabase Auth → Site URL + Redirect URLs apontando pra `https://praxia.vercel.app`
   (sem isso o magic-link redireciona errado e o login quebra).

**Entregável de código:** doc de deploy passo-a-passo + `vercel.json` se necessário.

**Resultado:** app público, grátis, ilimitado pra todos.

### Entrega 2 — Código de billing dormante

Implementa todo o `BILLING_PLAN.md` (passos 1–13), mergeável já porque fica inerte.

**Novos arquivos:**
- `src/lib/billing.ts` — constantes puras (`PRO_PRICE_BRL=29`, `FREE_MONTHLY_LIMIT=10`,
  `PAYWALLED_FEATURES`, `hasProAccess`, `currentMonthKey`, `featureLabels`).
- `src/lib/supabaseBilling.ts` — `fetchSubscriptionFromServer`, `fetchUsageThisMonth`.
- `src/hooks/useSubscription.ts` — `{plan, subscription, usageThisMonth, loading, refresh}`,
  hidrata ao login, lift em `App.tsx`. MVP: polling/refresh manual (sem realtime).
- `api/_mercadopago.ts` — `mpFetch`, `verifyWebhookSignature` (HMAC-SHA256), tipos MP.
- `api/_usageGuard.ts` — `assertCanUseAI(req)` + `trackUsage(userId, feature)`.
- `api/checkout.ts` — cria Preapproval MP, salva subscription `pending`, retorna `init_point`.
- `api/mp-webhook.ts` — recebe notificação MP, valida assinatura, atualiza status, idempotente.
- `api/cancel-subscription.ts` — cancela no MP (opcional pra UI).
- `src/components/praxia/PaywallModal.tsx` — sibling de `AppShell`, dispara ao 402.
- `src/components/praxia/screens/ScreenBilling.tsx` — gerenciar plano, acessível via Profile.

**Modificados:**
- `api/ai.ts` — chama `assertCanUseAI` antes do LLM, `trackUsage` após sucesso, trata 402/401.
- `src/lib/ai.ts` (+ `aiDividends.ts`, `aiDigest.ts`, `stockNews.ts`, `aiNews.ts`,
  `aiNewsFeed.ts`) — aceitam `accessToken?`, enviam `Authorization: Bearer`, lançam
  `PaywallRequiredError` no 402.
- `src/App.tsx` — lift `useSubscription`, estado `paywallPayload`, render `PaywallModal`,
  rota `"billing"` no Screen union, passa `plan` pras telas com badge Pro.
- `src/components/praxia/screens/ScreenProfile.tsx` — botão "Gerenciar plano".
- `.env.example` — `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `PUBLIC_URL`,
  `BILLING_ENABLED` (server), `VITE_BILLING_ENABLED` (client, espelha a de server).

**Mecanismo dormente (o ponto-chave):**

`api/_usageGuard.ts::assertCanUseAI`:
```
if (process.env.BILLING_ENABLED !== "true") return { userId: null, isPro: true };
// senão: lê Bearer → 401 sem token → busca subscription + usage →
//        isPro? passa : (total >= 10 → throw 402 com payload)
```
- Flag off → ninguém vê paywall (server nunca devolve 402); client `PaywallModal`
  nunca dispara. O botão "Gerenciar plano" em `ScreenProfile` **fica escondido**
  quando billing está off (sem tela morta sem ação); a rota `"billing"` existe mas
  só é alcançável com a flag on. Exposição da flag no client: `import.meta.env.VITE_BILLING_ENABLED`
  espelhando a env de server.
- Flag on → comportamento real de cobrança.

### Entrega 3 — Flip-the-switch (fora desta sessão, quando MP aprovar)

Checklist documentado (não é código):
1. Abrir conta Mercado Pago (empresarial/MEI) → painel de desenvolvedores.
2. Pegar credenciais **TEST** → setar `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`,
   `PUBLIC_URL=https://praxia.vercel.app` no Vercel.
3. Registrar webhook `https://praxia.vercel.app/api/mp-webhook` com eventos
   `subscription_preapproval`, `subscription_authorized_payment`, `payment`.
4. Setar `BILLING_ENABLED=true`.
5. Smoke E2E com cartão de teste MP (assina → webhook → status `active` → paywall some).
6. Trocar credenciais TEST → produção.

## Design para isolamento

- **`billing.ts`** — funções puras, sem I/O. Testável isolado. Não depende de nada além dos tipos.
- **`_usageGuard.ts`** — única porta de entrada do gate; `api/ai.ts` não conhece regras
  de plano, só chama `assertCanUseAI`/`trackUsage`. Mudar limite = mexer só aqui + `billing.ts`.
- **`_mercadopago.ts`** — encapsula toda a REST do MP; `checkout`/`webhook` não montam URL na mão.
- **`useSubscription`** — única fonte de verdade do plano no client; telas recebem `plan` por prop.

## Tratamento de erros

- `api/checkout.ts`: 401 sem JWT válido; rate-limit 5/min; falha MP → 502 com msg curta.
- `api/mp-webhook.ts`: assinatura inválida → 401; evento desconhecido → 200 (ignora, não quebra
  retry do MP); idempotente (mesmo evento 2× = mesmo estado). Logs sem payload cru.
- `api/_usageGuard.ts`: 401 (sem token), 402 (limite estourado, com `PaywallRequiredPayload`).
- Client: `PaywallRequiredError` capturado em `App.tsx` → seta `paywallPayload` → abre modal.

## Testes

- Unit `billing.ts`: `hasProAccess` (active/cancelled = true; pending/past_due/null = false),
  `currentMonthKey` (UTC), limites.
- Unit `_usageGuard.ts` (mocks, sem MP real):
  - flag off → `{isPro: true}` sem tocar Supabase.
  - flag on + sem token → 401.
  - flag on + free no limite (10) → 402 com payload.
  - flag on + pro → passa.
- `npm run build` verde + `npm run test:run` (586 atuais seguem passando).
- Validação de deploy: magic-link ponta a ponta em `praxia.vercel.app` (ponto que mais quebra).
- E2E de pagamento: Entrega 3, com credenciais TEST do MP.

## Fora de escopo

- Domínio próprio / DNS (fica pra quando o usuário registrar).
- Realtime de subscription (MVP usa refresh; postgres changes é polish).
- Implementação dos 3 itens "Alto" da auditoria LGPD (decisão separada).
- Upgrade do `xlsx` (bloqueado por proxy, mitigado em código — ver SECURITY.md).
- Sentry / analytics pós-launch.
