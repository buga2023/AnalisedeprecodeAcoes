# Praxia — Plano de Billing (Mercado Pago)

> Documento de retomada — sessão de 2026-05-28 ficou na metade do bloco. Tudo
> que está abaixo ainda precisa ser implementado para destravar cobrança real.

## Decisões já tomadas

| Decisão | Valor |
|---|---|
| Preço | **R$ 29/mês** (Praxia Pro) |
| Modelo de cobrança | Mercado Pago **Subscriptions** (Preapproval, cartão recorrente) |
| Gate | **Soft limit por uso/mês**: free = 10 chamadas IA/mês, pro = ilimitado |
| Tabelas Supabase | `subscriptions`, `usage_log`, view `current_month_usage` |
| Sem dependência npm nova | Cliente Mercado Pago via `fetch` direto na REST API |

## O que já está pronto (commitado)

- ✅ `supabase/migrations/002_billing.sql` — tabelas + RLS + RPC `increment_usage()` atômico + view `current_month_usage`. **PRECISA RODAR no Supabase Dashboard** antes do código funcionar.
- ✅ `src/types/stock.ts` — tipos `Plan`, `SubscriptionStatus`, `Subscription`, `PaywalledFeature`, `UsageThisMonth`, `PaywallRequiredPayload`.

## O que falta implementar (em ordem)

### 1. `src/lib/billing.ts` — constantes e helpers puros
```ts
export const PRO_PRICE_BRL = 29.0;
export const FREE_MONTHLY_LIMIT = 10;
export const PAYWALLED_FEATURES: readonly PaywalledFeature[] = [
  "ai-analysis", "portfolio-insights", "compare", "digest",
  "optimize-dividends", "screener", "classify-news", "fundamentals-history",
];
export function hasProAccess(sub: Subscription | null): boolean {
  return sub?.status === "active" || sub?.status === "cancelled"; // cancelled mantém acesso até current_period_end
}
export function currentMonthKey(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}
export const featureLabels: Record<PaywalledFeature, string> = { /* ... */ };
```

### 2. `src/lib/supabaseBilling.ts` — queries
- `fetchSubscriptionFromServer(userId): Promise<Subscription | null>` — busca a row mais recente em `subscriptions` por user.
- `fetchUsageThisMonth(userId): Promise<UsageThisMonth>` — `select * from current_month_usage where user_id = ?`. Devolve `{ total: 0, byFeature: {}, month }` se não existir.

### 3. `src/hooks/useSubscription.ts`
- Estado: `{ plan, subscription, usageThisMonth, loading, refresh }`
- Hidrata ao login (depende de `useAuth`)
- Subscribe a postgres changes (realtime) — opcional, MVP pode polling 60s
- Lift em `PraxiaApp` (`src/App.tsx`)

### 4. `api/_mercadopago.ts` — helper compartilhado
- `mpFetch(method, path, body?)` → faz fetch a `https://api.mercadopago.com${path}` com `Authorization: Bearer ${MP_ACCESS_TOKEN}`.
- `verifyWebhookSignature(req, secret)` → HMAC-SHA256 do header `x-signature` + `data.id` + `request-id`. Ver docs: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks#bookmark_validar_o_origem_da_notifica%C3%A7%C3%A3o
- Type `MPPreapproval` espelhando schema MP.

### 5. `api/checkout.ts`
- `POST` com `Authorization: Bearer <user_jwt>`.
- Valida JWT via `admin.auth.getUser(token)` (igual `api/delete-account.ts`).
- Cria Preapproval no MP:
  ```ts
  await mpFetch("POST", "/preapproval", {
    reason: "Praxia Pro — assinatura mensal",
    auto_recurring: {
      frequency: 1, frequency_type: "months",
      transaction_amount: 29.0, currency_id: "BRL",
    },
    back_url: `${PUBLIC_URL}/billing/return`,
    payer_email: user.email,
    external_reference: user.id, // recupera no webhook
  });
  ```
- Salva `subscription` row em `pending` no Supabase (`mp_preapproval_id` = resposta MP).
- Retorna `{ init_point: string }` — frontend redireciona pra essa URL.
- Rate-limit: 5 req/min (evita criar 100 preapprovals).

### 6. `api/mp-webhook.ts`
- `POST` recebe notification do MP. **Não exige Authorization Bearer** (vem do MP), mas valida assinatura.
- Header `x-signature` + `x-request-id`. Calcula HMAC e compara.
- Identifica tipo (`type=subscription_preapproval`, `type=payment`, etc).
- Para `subscription_preapproval`: chama `mpFetch("GET", "/preapproval/${id}")` pra pegar status atual, atualiza `subscriptions.status` no Supabase.
- Idempotente — mesmo evento entregue 2× deve dar mesmo resultado.
- Logs restritos (só `subscription_id`, status, sem payload cru).
- `vercel.json` precisa expor o path sem CORS strict.

### 7. `api/_usageGuard.ts` — server-side gate
- `assertCanUseAI(req): Promise<{ userId: string; isPro: boolean }>`
  - Lê `Authorization: Bearer`.
  - Se não tem token → `throw 401`.
  - Pega user → busca subscription + usage do mês.
  - Se `isPro`: retorna.
  - Se free + `total >= FREE_MONTHLY_LIMIT`: `throw 402` com payload `{ currentUsage, limit, plan: 'free' }`.
- Helper `trackUsage(userId, feature)` chama RPC `increment_usage` do Supabase. Server roda DEPOIS do LLM responder com sucesso.

### 8. Modificar `api/ai.ts`
- Antes de chamar LLM:
  ```ts
  try {
    const { userId, isPro } = await assertCanUseAI(req);
    // ... existing code chama LLM ...
    if (success) await trackUsage(userId, feature); // feature vem do request body
  } catch (e) {
    if (e.status === 402) return res.status(402).json(e.payload);
    if (e.status === 401) return res.status(401).json({ error: "auth-required" });
    throw e;
  }
  ```
- `req.body.feature` deve ser enviado pelo client (string em `PaywalledFeature`).
- **Importante**: gate é OPCIONAL quando `SUPABASE_SERVICE_ROLE_KEY` não está configurado → modo demo grátis (ambiente dev).

### 9. Modificar as funções IA do client
Cada uma das funções abaixo deve aceitar `accessToken?: string` (vindo do `useAuth().session?.access_token`) e enviar no header `Authorization: Bearer <token>`. Quando o server responde 402, lançar `PaywallRequiredError` com o `PaywallRequiredPayload`:

- `src/lib/ai.ts`: `fetchAIInsights`, `analisarAcaoComIA`, `compararAcoesComIA`
- `src/lib/aiDividends.ts`: `otimizarDividendos`
- `src/lib/aiDigest.ts`: `gerarDigestSemanal`
- `src/lib/stockNews.ts`: `analisarNoticiasAcao`
- `src/lib/aiNews.ts`, `src/lib/aiNewsFeed.ts`: se chamam `/api/ai`

Padrão sugerido:
```ts
// Em cada lib que tem callAIServerless local:
export class PaywallRequiredError extends Error {
  constructor(public payload: PaywallRequiredPayload) { super("paywall-required"); }
}
async function callAIServerless<T>(prompt, format, accessToken?, feature?) {
  const headers = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(AI_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ messages, ..., feature }),
  });
  if (res.status === 402) {
    const payload = await res.json();
    throw new PaywallRequiredError(payload);
  }
  // ... rest unchanged
}
```

### 10. `src/components/praxia/PaywallModal.tsx`
- Sibling de `AppShell` em `App.tsx` (não dentro de scroll).
- Recebe prop `triggerPayload: PaywallRequiredPayload | null`.
- Hero: "Você usou X de Y consultas IA grátis este mês".
- Lista de benefícios Pro (consultas ilimitadas, otimizador, digest, screener, hist. fundamentos).
- Botão "Assinar Praxia Pro — R$ 29/mês":
  ```ts
  const res = await fetch("/api/checkout", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  const { init_point } = await res.json();
  window.location.href = init_point;
  ```

### 11. `src/components/praxia/screens/ScreenBilling.tsx`
- Acessível via `ScreenProfile` → botão "Gerenciar plano".
- Mostra:
  - Plano atual (free / pro)
  - Se pro: data de renovação, valor, botão "Cancelar"
  - Se free: usage do mês ("X de 10 consultas IA"), botão "Assinar Pro"
- Cancelar: `POST /api/cancel-subscription` (criar) ou abrir página do MP.

### 12. Wire em `src/App.tsx`
- `import { useSubscription } from "@/hooks/useSubscription"` no `PraxiaApp`.
- Estado `const [paywallPayload, setPaywallPayload] = useState<PaywallRequiredPayload | null>(null)`.
- Cada local que chama IA deve fazer `try { ... } catch (e) { if (e instanceof PaywallRequiredError) setPaywallPayload(e.payload); }`.
- Renderizar `<PaywallModal triggerPayload={paywallPayload} onClose={() => setPaywallPayload(null)} accessToken={session?.access_token} />` como sibling.
- Adicionar `"billing"` ao Screen union; routing pra `ScreenBilling`.
- Passar `plan` pra ScreenProfile e screens que precisem mostrar badge "Pro".

### 13. `.env.example` / `.env.local`
Adicionar (em backend, sem `VITE_`):
```
MP_ACCESS_TOKEN=
MP_WEBHOOK_SECRET=
PUBLIC_URL=https://praxia.example.com
```
Pegar `MP_ACCESS_TOKEN` em https://www.mercadopago.com.br/developers/panel/app/{APP_ID}/credentials. Webhook secret é gerado ao registrar webhook URL no painel MP.

### 14. Configuração externa (manual)
- [ ] Rodar `002_billing.sql` no Supabase Dashboard > SQL Editor.
- [ ] Criar app no Mercado Pago: https://www.mercadopago.com.br/developers/panel.
- [ ] Configurar webhook URL: `https://{seu-dominio}/api/mp-webhook` com eventos `subscription_preapproval`, `subscription_authorized_payment`, `payment`.
- [ ] Gerar `MP_WEBHOOK_SECRET` no painel + salvar.
- [ ] Setar envs no Vercel.
- [ ] **Modo teste primeiro**: usar credenciais TEST e cartão de teste antes de ativar produção.

## Resumo de arquivos a criar/modificar

**Novos:**
- `src/lib/billing.ts`
- `src/lib/supabaseBilling.ts`
- `src/hooks/useSubscription.ts`
- `api/_mercadopago.ts`
- `api/_usageGuard.ts`
- `api/checkout.ts`
- `api/mp-webhook.ts`
- `api/cancel-subscription.ts` (opcional pra UI cancelar)
- `src/components/praxia/PaywallModal.tsx`
- `src/components/praxia/screens/ScreenBilling.tsx`

**Modificados:**
- `src/lib/ai.ts` (+ `aiDividends.ts`, `aiDigest.ts`, `stockNews.ts`, `aiNews.ts`, `aiNewsFeed.ts`): aceitar accessToken + tratar 402
- `api/ai.ts`: wire `assertCanUseAI` + `trackUsage`
- `src/App.tsx`: lift useSubscription, modal paywall, rota billing
- `src/components/praxia/screens/ScreenProfile.tsx`: botão "Gerenciar plano"
- `.env.example`: vars MP

## Estimativa: ~3-5 dias de dev sênior

## Sequência recomendada na próxima sessão

1. `billing.ts` + `supabaseBilling.ts` + `useSubscription.ts` → testa build (1h)
2. `api/_mercadopago.ts` + `api/_usageGuard.ts` (1h)
3. `api/checkout.ts` + `api/mp-webhook.ts` (3h)
4. Modificar `api/ai.ts` + `lib/ai.ts` + outras libs IA pra accessToken + 402 (2h)
5. `PaywallModal` + `ScreenBilling` + wire `App.tsx` (3h)
6. Smoke E2E com credenciais TEST do Mercado Pago (2h)
7. Documentar no SITUAÇÃO_ATUAL.md
