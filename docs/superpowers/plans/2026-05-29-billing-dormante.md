# Billing dormante (Mercado Pago) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a cobrança Praxia Pro (R$ 29/mês via Mercado Pago Subscriptions, free = 10 chamadas IA/mês) de forma **dormente** — o código vai pro `main` e pro deploy grátis sem cobrar nada, e só passa a cobrar quando a env `BILLING_ENABLED=true` for ligada (Entrega 3, fora deste plano).

**Architecture:** Gate server-side em `api/_usageGuard.ts` que o `api/ai.ts` consulta antes de chamar o LLM; quando `BILLING_ENABLED !== "true"` o gate libera todos sem tocar no Supabase. No client, um registrador de token a nível de módulo (`src/lib/aiAuth.ts`) injeta o `Authorization: Bearer` nos 6 pontos que chamam `/api/ai` e converte 402 em `PaywallRequiredError`. `useSubscription` é a fonte de verdade do plano no client; `App.tsx` levanta o hook, registra o token e renderiza o `PaywallModal`.

**Tech Stack:** React 19 + TS strict, Vercel serverless (`api/*.ts`), Supabase (auth + Postgres + RLS), Mercado Pago REST API via `fetch` (sem dep nova), vitest.

**Spec de origem:** `docs/superpowers/specs/2026-05-29-deploy-e-billing-design.md` · doc herdado `BILLING_PLAN.md`.

**Pré-requisito de DB (manual, fora do código):** rodar `supabase/migrations/002_billing.sql` no Supabase Dashboard antes de ligar `BILLING_ENABLED`. As tabelas (`subscriptions`, `usage_log`, RPC `increment_usage`, view `current_month_usage`) e os tipos em `src/types/stock.ts` (`Plan`, `Subscription`, `SubscriptionStatus`, `PaywalledFeature`, `UsageThisMonth`, `PaywallRequiredPayload`) já existem.

---

## File Structure

**Novos:**
- `src/lib/billing.ts` — constantes + helpers puros do domínio de billing.
- `src/lib/billing.test.ts` — testes do acima.
- `src/lib/aiAuth.ts` — registrador de token IA + `PaywallRequiredError` + helpers de header/402.
- `src/lib/aiAuth.test.ts` — testes do acima.
- `src/lib/supabaseBilling.ts` — leitura de subscription + usage do Supabase (client).
- `src/hooks/useSubscription.ts` — estado do plano no client.
- `api/_mercadopago.ts` — `mpFetch` + `verifyWebhookSignature` + tipos MP.
- `api/_mercadopago.test.ts` — teste de `verifyWebhookSignature`.
- `api/_usageGuard.ts` — `assertCanUseAI` + `trackUsage` (o gate dormente).
- `api/_usageGuard.test.ts` — testes do gate.
- `api/checkout.ts` — cria Preapproval MP, retorna `init_point`.
- `api/mp-webhook.ts` — recebe notificação MP, atualiza status.
- `api/cancel-subscription.ts` — cancela assinatura no MP.
- `src/components/praxia/PaywallModal.tsx` — modal de upsell (sibling do AppShell).
- `src/components/praxia/screens/ScreenBilling.tsx` — tela "Gerenciar plano".
- `docs/deploy-vercel.md` — passo-a-passo do deploy grátis (Entrega 1).
- `docs/billing-flip-the-switch.md` — checklist de ativação (Entrega 3).

**Modificados:**
- `api/ai.ts` — wire `assertCanUseAI` + `trackUsage`, trata 402/401.
- `src/lib/ai.ts`, `src/lib/aiDigest.ts`, `src/lib/aiNewsFeed.ts`, `src/lib/aiDividends.ts`, `src/lib/aiNews.ts`, `src/lib/stockNews.ts` — injetar auth header + tratar 402 nos `fetch("/api/ai")`.
- `src/App.tsx` — lift `useSubscription`, `setAIAccessToken`, estado paywall + `PaywallModal`, rota `"billing"`, passar `plan`/`billingEnabled`.
- `src/components/praxia/screens/ScreenProfile.tsx` — botão "Gerenciar plano" (gated por billing on).
- `.env.example` — vars MP + flags de billing.

---

## Task 1: `src/lib/billing.ts` — domínio puro

**Files:**
- Create: `src/lib/billing.ts`
- Test: `src/lib/billing.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/billing.test.ts
import { describe, it, expect } from "vitest";
import {
  PRO_PRICE_BRL,
  FREE_MONTHLY_LIMIT,
  PAYWALLED_FEATURES,
  hasProAccess,
  currentMonthKey,
  featureLabels,
} from "./billing";
import type { Subscription } from "@/types/stock";

function sub(status: Subscription["status"]): Subscription {
  return {
    id: "s1",
    userId: "u1",
    mpPreapprovalId: "mp1",
    plan: "pro",
    status,
    amountBRL: 29,
    startedAt: null,
    currentPeriodEnd: null,
    cancelledAt: null,
  };
}

describe("billing", () => {
  it("constants", () => {
    expect(PRO_PRICE_BRL).toBe(29);
    expect(FREE_MONTHLY_LIMIT).toBe(10);
    expect(PAYWALLED_FEATURES).toContain("ai-analysis");
    expect(PAYWALLED_FEATURES.length).toBe(8);
  });

  it("hasProAccess: active e cancelled mantem acesso; resto nao", () => {
    expect(hasProAccess(sub("active"))).toBe(true);
    expect(hasProAccess(sub("cancelled"))).toBe(true); // acesso ate fim do periodo
    expect(hasProAccess(sub("pending"))).toBe(false);
    expect(hasProAccess(sub("paused"))).toBe(false);
    expect(hasProAccess(sub("past_due"))).toBe(false);
    expect(hasProAccess(null)).toBe(false);
  });

  it("currentMonthKey: YYYY-MM em UTC", () => {
    expect(currentMonthKey(new Date("2026-01-05T23:00:00Z"))).toBe("2026-01");
    expect(currentMonthKey(new Date("2026-12-31T12:00:00Z"))).toBe("2026-12");
  });

  it("featureLabels cobre todas as features", () => {
    for (const f of PAYWALLED_FEATURES) {
      expect(typeof featureLabels[f]).toBe("string");
      expect(featureLabels[f].length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/billing.test.ts`
Expected: FAIL — `Cannot find module './billing'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/billing.ts
import type { PaywalledFeature, Subscription } from "@/types/stock";

/** Preço mensal do Praxia Pro em reais. */
export const PRO_PRICE_BRL = 29.0;

/** Quantas chamadas de IA o plano free permite por mês (UTC). */
export const FREE_MONTHLY_LIMIT = 10;

/** Features que consomem cota de IA — usadas pelo gate e pela telemetria. */
export const PAYWALLED_FEATURES: readonly PaywalledFeature[] = [
  "ai-analysis",
  "portfolio-insights",
  "compare",
  "digest",
  "optimize-dividends",
  "screener",
  "classify-news",
  "fundamentals-history",
] as const;

/**
 * True quando a assinatura dá acesso Pro AGORA. `cancelled` mantém acesso até o
 * fim do período já pago (o webhook do MP zera quando o período expira).
 */
export function hasProAccess(sub: Subscription | null): boolean {
  return sub?.status === "active" || sub?.status === "cancelled";
}

/** Mês corrente como "YYYY-MM" em UTC — mesma chave usada pelo `usage_log`. */
export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Rótulos curtos PT-BR por feature, pro paywall listar benefícios. */
export const featureLabels: Record<PaywalledFeature, string> = {
  "ai-analysis": "Análise por ação com IA",
  "portfolio-insights": "Insights da carteira",
  "compare": "Comparador de ações",
  "digest": "Digest semanal",
  "optimize-dividends": "Otimizador de dividendos",
  "screener": "Screener Descobrir",
  "classify-news": "Notícias com sentimento",
  "fundamentals-history": "Histórico de fundamentos",
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/billing.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing.ts src/lib/billing.test.ts
git commit -m "feat(billing): constantes e helpers puros de billing"
```

---

## Task 2: `src/lib/aiAuth.ts` — token register + PaywallRequiredError

Por que aqui e não threading por parâmetro: os 6 pontos que chamam `/api/ai` (`ai.ts`, `aiDigest.ts`, `aiNewsFeed.ts`, `aiDividends.ts`, `aiNews.ts`, `stockNews.ts`) só precisam de 2 coisas — header de auth e tratamento de 402. Um registrador de módulo evita mudar a assinatura de ~10 funções exportadas e todos os call-sites.

**Files:**
- Create: `src/lib/aiAuth.ts`
- Test: `src/lib/aiAuth.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/aiAuth.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  setAIAccessToken,
  aiAuthHeaders,
  throwIfPaywalled,
  PaywallRequiredError,
} from "./aiAuth";

describe("aiAuth", () => {
  beforeEach(() => setAIAccessToken(null));

  it("aiAuthHeaders vazio sem token", () => {
    expect(aiAuthHeaders()).toEqual({});
  });

  it("aiAuthHeaders inclui Bearer quando token setado", () => {
    setAIAccessToken("jwt-123");
    expect(aiAuthHeaders()).toEqual({ Authorization: "Bearer jwt-123" });
  });

  it("throwIfPaywalled ignora respostas != 402", async () => {
    const ok = new Response("{}", { status: 200 });
    await expect(throwIfPaywalled(ok, "compare")).resolves.toBeUndefined();
  });

  it("throwIfPaywalled lanca PaywallRequiredError no 402 com payload", async () => {
    const body = JSON.stringify({ currentUsage: 10, limit: 10, plan: "free" });
    const res = new Response(body, { status: 402 });
    await expect(throwIfPaywalled(res, "screener")).rejects.toBeInstanceOf(
      PaywallRequiredError
    );
    try {
      await throwIfPaywalled(new Response(body, { status: 402 }), "screener");
    } catch (e) {
      const err = e as PaywallRequiredError;
      expect(err.payload.feature).toBe("screener");
      expect(err.payload.currentUsage).toBe(10);
      expect(err.payload.limit).toBe(10);
      expect(err.payload.plan).toBe("free");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/aiAuth.test.ts`
Expected: FAIL — `Cannot find module './aiAuth'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/aiAuth.ts
import type { PaywalledFeature, PaywallRequiredPayload } from "@/types/stock";

/**
 * Token de acesso do usuário logado (JWT do Supabase). Registrado pelo App.tsx
 * em todo onAuthStateChange; lido pelos pontos que chamam /api/ai. Nível de
 * módulo (não React state) porque libs puras não têm acesso a hooks.
 */
let accessToken: string | null = null;

export function setAIAccessToken(token: string | null): void {
  accessToken = token;
}

/** Header Authorization quando há token; objeto vazio caso contrário. */
export function aiAuthHeaders(): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

/** Lançado quando o servidor responde 402 (cota free estourada). */
export class PaywallRequiredError extends Error {
  constructor(public payload: PaywallRequiredPayload) {
    super("paywall-required");
    this.name = "PaywallRequiredError";
  }
}

/**
 * Inspeciona a resposta de /api/ai. Se for 402, monta o payload e lança
 * PaywallRequiredError; caso contrário não faz nada (o caller segue o fluxo).
 * `feature` é injetado porque o corpo do 402 pode não repeti-lo.
 */
export async function throwIfPaywalled(
  response: Response,
  feature: PaywalledFeature
): Promise<void> {
  if (response.status !== 402) return;
  const data = (await response.json().catch(() => ({}))) as Partial<PaywallRequiredPayload>;
  throw new PaywallRequiredError({
    feature,
    currentUsage: typeof data.currentUsage === "number" ? data.currentUsage : 0,
    limit: typeof data.limit === "number" ? data.limit : 0,
    plan: data.plan ?? "free",
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/aiAuth.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/aiAuth.ts src/lib/aiAuth.test.ts
git commit -m "feat(billing): registrador de token IA + PaywallRequiredError"
```

---

## Task 3: `api/_usageGuard.ts` — o gate dormente

Este é o coração da feature dormente. Sem `BILLING_ENABLED=true`, libera todos sem tocar no Supabase.

**Files:**
- Create: `api/_usageGuard.ts`
- Test: `api/_usageGuard.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/_usageGuard.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocka o supabase-js antes de importar o módulo sob teste.
const getUser = vi.fn();
const rpc = vi.fn();
const single = vi.fn();
const maybeSingle = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser },
    rpc,
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({ limit: () => ({ maybeSingle }) }),
          maybeSingle,
          single,
        }),
      }),
    }),
  }),
}));

import { assertCanUseAI, UsageGuardError } from "./_usageGuard";

function req(token?: string) {
  return {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  } as unknown as import("@vercel/node").VercelRequest;
}

describe("assertCanUseAI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("BILLING_ENABLED", "");
    vi.stubEnv("SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "svc");
  });

  it("flag off => libera todos sem tocar Supabase", async () => {
    const r = await assertCanUseAI(req(), "compare");
    expect(r.isPro).toBe(true);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("flag on + sem token => 401", async () => {
    vi.stubEnv("BILLING_ENABLED", "true");
    await expect(assertCanUseAI(req(), "compare")).rejects.toMatchObject({ status: 401 });
  });

  it("flag on + token invalido => 401", async () => {
    vi.stubEnv("BILLING_ENABLED", "true");
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "bad" } });
    await expect(assertCanUseAI(req("jwtjwtjwtjwtjwtjwtjwt"), "compare")).rejects.toMatchObject({
      status: 401,
    });
  });

  it("flag on + pro ativo => passa", async () => {
    vi.stubEnv("BILLING_ENABLED", "true");
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    maybeSingle.mockResolvedValue({ data: { status: "active" }, error: null });
    const r = await assertCanUseAI(req("jwtjwtjwtjwtjwtjwtjwt"), "compare");
    expect(r.isPro).toBe(true);
    expect(r.userId).toBe("u1");
  });

  it("flag on + free no limite => 402 com payload", async () => {
    vi.stubEnv("BILLING_ENABLED", "true");
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    // 1a chamada maybeSingle = subscription (nenhuma => free)
    // 2a chamada maybeSingle = usage view (total 10)
    maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { total_this_month: 10 }, error: null });
    try {
      await assertCanUseAI(req("jwtjwtjwtjwtjwtjwtjwt"), "compare");
      throw new Error("deveria ter lançado");
    } catch (e) {
      const err = e as UsageGuardError;
      expect(err.status).toBe(402);
      expect(err.payload).toMatchObject({ feature: "compare", currentUsage: 10, limit: 10, plan: "free" });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/_usageGuard.test.ts`
Expected: FAIL — `Cannot find module './_usageGuard'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// api/_usageGuard.ts
import type { VercelRequest } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Gate de uso de IA. DORMENTE por padrão: só cobra quando BILLING_ENABLED==="true".
 *
 * - flag off  → retorna { userId: null, isPro: true } sem tocar no Supabase.
 * - flag on   → exige Bearer JWT, lê subscription + usage do mês, decide:
 *                 pro → passa · free < limite → passa · free >= limite → 402.
 */

const FREE_MONTHLY_LIMIT = 10; // espelha src/lib/billing.ts (server não importa src/)

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export interface PaywallPayload {
  feature: string;
  currentUsage: number;
  limit: number;
  plan: "free" | "pro";
}

/** Erro com status HTTP + payload opcional pro handler responder. */
export class UsageGuardError extends Error {
  constructor(public status: number, public payload?: PaywallPayload) {
    super(`usage-guard-${status}`);
    this.name = "UsageGuardError";
  }
}

export interface GuardResult {
  userId: string | null;
  isPro: boolean;
}

function billingEnabled(): boolean {
  return process.env.BILLING_ENABLED === "true";
}

function admin(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bearer(request: VercelRequest): string | null {
  const m = /^Bearer\s+(.+)$/i.exec(request.headers.authorization || "");
  if (!m) return null;
  const t = m[1].trim();
  return t.length >= 20 && t.length <= 4096 ? t : null;
}

export async function assertCanUseAI(
  request: VercelRequest,
  feature: string
): Promise<GuardResult> {
  if (!billingEnabled()) return { userId: null, isPro: true };

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    // Billing ligado mas Supabase ausente: falha fechada seria pior que aberta
    // num MVP — libera mas loga. (Não deve acontecer em prod configurado.)
    console.warn("[usageGuard] BILLING_ENABLED on mas Supabase ausente — liberando.");
    return { userId: null, isPro: true };
  }

  const token = bearer(request);
  if (!token) throw new UsageGuardError(401);

  const sb = admin();
  const { data: userData, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !userData?.user) throw new UsageGuardError(401);
  const userId = userData.user.id;

  // Subscription mais recente do user.
  const { data: subRow } = await sb
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isPro = subRow?.status === "active" || subRow?.status === "cancelled";
  if (isPro) return { userId, isPro: true };

  // Free: checa uso do mês via view agregada.
  const { data: usageRow } = await sb
    .from("current_month_usage")
    .select("total_this_month")
    .eq("user_id", userId)
    .maybeSingle();

  const total = Number(usageRow?.total_this_month ?? 0);
  if (total >= FREE_MONTHLY_LIMIT) {
    throw new UsageGuardError(402, {
      feature,
      currentUsage: total,
      limit: FREE_MONTHLY_LIMIT,
      plan: "free",
    });
  }
  return { userId, isPro: false };
}

/**
 * Conta +1 uso da feature pro user. Chamado DEPOIS do LLM responder com sucesso.
 * No-op quando billing off ou sem userId. Nunca derruba a request se falhar.
 */
export async function trackUsage(userId: string | null, feature: string): Promise<void> {
  if (!billingEnabled() || !userId || !SUPABASE_URL || !SERVICE_ROLE_KEY) return;
  try {
    await admin().rpc("increment_usage", { p_user_id: userId, p_feature: feature });
  } catch (e) {
    console.warn("[usageGuard] increment_usage falhou:", String((e as Error).message).slice(0, 80));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/_usageGuard.test.ts`
Expected: PASS (5 tests).

> Nota: se o encadeamento mockado de `.order().limit().maybeSingle()` vs `.maybeSingle()` direto divergir do real, ajustar o mock — a lógica de produção usa `.order().limit().maybeSingle()` pra subscription e `.maybeSingle()` pra view. O teste mocka ambos via o mesmo `maybeSingle` com `mockResolvedValueOnce` na ordem de chamada.

- [ ] **Step 5: Commit**

```bash
git add api/_usageGuard.ts api/_usageGuard.test.ts
git commit -m "feat(billing): gate de uso de IA dormente (BILLING_ENABLED)"
```

---

## Task 4: Wire o gate no `api/ai.ts`

**Files:**
- Modify: `api/ai.ts`

- [ ] **Step 1: Adicionar import e a checagem do gate**

Logo abaixo dos imports existentes (após a linha 5), adicionar:

```ts
import { assertCanUseAI, trackUsage, UsageGuardError } from "./_usageGuard";
```

- [ ] **Step 2: Inserir o gate antes da chamada ao LLM e o tracking depois**

Substituir o bloco `try { ... } catch (error) { ... }` (linhas 66–81) por:

```ts
  // Gate de billing (dormente quando BILLING_ENABLED != "true").
  const feature = typeof (body as { feature?: unknown }).feature === "string"
    ? (body as { feature: string }).feature
    : "ai-analysis";
  let guard: { userId: string | null; isPro: boolean };
  try {
    guard = await assertCanUseAI(request, feature);
  } catch (e) {
    if (e instanceof UsageGuardError) {
      if (e.status === 402) return response.status(402).json(e.payload);
      return response.status(401).json({ error: "auth-required" });
    }
    throw e;
  }

  try {
    const result = await callLLM({ provider, messages, temperature, max_tokens, response_format });
    setCached(key, result);
    // Conta uso só após sucesso (free não "gasta" cota em erro do provider).
    await trackUsage(guard.userId, feature);
    return response.status(200).json(result);
  } catch (error) {
    if (error instanceof LLMError) {
      console.error("[api/ai] %s %d %s", provider, error.status, String(error.message).slice(0, 120));
      const status = error.status === 401 || error.status === 403 ? 401 : error.status;
      const message = status === 401 ? `API key invalida para ${provider}` : error.message;
      return response.status(status).json({ error: message });
    }
    const msg = error instanceof Error ? error.message : "Erro interno";
    console.error("[api/ai] %s 500 %s", provider, msg.slice(0, 120));
    return response.status(500).json({ error: `Erro interno no servidor ao processar ${provider}` });
  }
```

> O gate roda DEPOIS do cache hit (linhas 58–64 ficam acima): um cache hit não consome cota nem exige auth, o que é desejável (resposta cacheada é grátis). Se quiser cobrar cache hit também, mover o gate pra antes do `getCached` — decisão de produto; MVP deixa cache grátis.

- [ ] **Step 3: Verificar build + testes existentes do ai handler**

Run: `npx vitest run api/` e `npx tsc --noEmit --project tsconfig.app.json`
Expected: PASS / 0 erros. (Com `BILLING_ENABLED` ausente nos testes, o gate é no-op e o comportamento atual do `api/ai` não muda.)

- [ ] **Step 4: Commit**

```bash
git add api/ai.ts
git commit -m "feat(billing): wire gate de uso + tracking no /api/ai"
```

---

## Task 5: Injetar auth + 402 nos 6 pontos que chamam `/api/ai`

Cada ponto recebe (a) `...aiAuthHeaders()` no header e (b) `await throwIfPaywalled(response, "<feature>")` logo após o `fetch`, antes do `!response.ok`. E `feature: "<feature>"` no body JSON.

Mapa ponto → feature:

| Arquivo | Linha do fetch | feature |
|---|---|---|
| `src/lib/ai.ts` (callAIServerless) | ~885 | derivada do `capability` (ver step) |
| `src/lib/aiDigest.ts` | ~107 | `"digest"` |
| `src/lib/aiNewsFeed.ts` | ~212 | `"classify-news"` |
| `src/lib/aiDividends.ts` | ~151 | `"optimize-dividends"` |
| `src/lib/aiNews.ts` | ~144 | `"classify-news"` |
| `src/lib/stockNews.ts` | ~177 | `"classify-news"` |

**Files:**
- Modify: `src/lib/ai.ts`, `src/lib/aiDigest.ts`, `src/lib/aiNewsFeed.ts`, `src/lib/aiDividends.ts`, `src/lib/aiNews.ts`, `src/lib/stockNews.ts`

- [ ] **Step 1: `src/lib/ai.ts` — mapear capability → feature e injetar**

No topo, adicionar import:

```ts
import { aiAuthHeaders, throwIfPaywalled } from "./aiAuth";
import type { PaywalledFeature } from "@/types/stock";
```

Dentro de `callAIServerless`, adicionar o mapa antes do `fetch` (após o gate `checkRateLimit`):

```ts
  const featureMap: Record<typeof capability, PaywalledFeature> = {
    analise: "ai-analysis",
    insights: "portfolio-insights",
    comparacao: "compare",
    news_topic: "classify-news",
    news_feed: "classify-news",
    screener: "screener",
  };
  const feature = featureMap[capability];
```

Trocar o objeto do `fetch` (linhas ~885–897) para incluir header e feature:

```ts
  const response = await fetch(AI_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...aiAuthHeaders() },
    body: JSON.stringify({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1200,
      response_format: { type: responseFormat },
      feature,
    }),
  });

  await throwIfPaywalled(response, feature);
```

- [ ] **Step 2: `src/lib/aiDigest.ts` — injetar (feature "digest")**

Adicionar import no topo:

```ts
import { aiAuthHeaders, throwIfPaywalled } from "./aiAuth";
```

No `fetch(AI_API_URL, {...})` (~107), adicionar `...aiAuthHeaders()` ao `headers`, adicionar `feature: "digest"` ao corpo JSON, e logo após o fetch:

```ts
  await throwIfPaywalled(response, "digest");
```

- [ ] **Step 3: Repetir para `aiNewsFeed.ts` / `aiNews.ts` / `stockNews.ts` (feature "classify-news") e `aiDividends.ts` (feature "optimize-dividends")**

Em cada arquivo: import de `aiAuth`, `...aiAuthHeaders()` no header do fetch, `feature: "<feature>"` no body, e `await throwIfPaywalled(response, "<feature>")` imediatamente após o `fetch` (antes de qualquer leitura de `response.ok`/`response.json`).

- [ ] **Step 4: Rodar testes existentes dessas libs**

Run: `npx vitest run src/lib/stockNews.test.ts src/lib/ai.test.ts`
Expected: PASS. Os mocks de fetch dessas suítes devolvem 200, então `throwIfPaywalled` é no-op. Se algum teste mockar `Response` sem `.status`, ajustar o mock para incluir `status: 200`.

- [ ] **Step 5: Build**

Run: `npx tsc --noEmit --project tsconfig.app.json`
Expected: 0 erros.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai.ts src/lib/aiDigest.ts src/lib/aiNewsFeed.ts src/lib/aiDividends.ts src/lib/aiNews.ts src/lib/stockNews.ts
git commit -m "feat(billing): injeta auth header + tratamento 402 nas chamadas /api/ai"
```

---

## Task 6: `src/lib/supabaseBilling.ts` — leitura de subscription + usage (client)

**Files:**
- Create: `src/lib/supabaseBilling.ts`

> Segue o padrão de cast de `src/lib/supabaseSync.ts` (o generic Database não é usado no MVP). Sem teste dedicado — é I/O fino; coberto indiretamente pelo hook e validado no smoke E2E da Entrega 3.

- [ ] **Step 1: Implementar**

```ts
// src/lib/supabaseBilling.ts
import { supabase } from "./supabase";
import { currentMonthKey } from "./billing";
import type { Subscription, UsageThisMonth, PaywalledFeature } from "@/types/stock";

/** Row crua da tabela subscriptions (snake_case do Postgres). */
interface SubscriptionRow {
  id: string;
  user_id: string;
  mp_preapproval_id: string | null;
  plan: "pro";
  status: Subscription["status"];
  amount_brl: number;
  started_at: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
}

function toSubscription(r: SubscriptionRow): Subscription {
  return {
    id: r.id,
    userId: r.user_id,
    mpPreapprovalId: r.mp_preapproval_id,
    plan: r.plan,
    status: r.status,
    amountBRL: Number(r.amount_brl),
    startedAt: r.started_at,
    currentPeriodEnd: r.current_period_end,
    cancelledAt: r.cancelled_at,
  };
}

/** Busca a subscription mais recente do user. null quando não há nenhuma. */
export async function fetchSubscriptionFromServer(
  userId: string
): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return toSubscription(data as SubscriptionRow);
}

/** Uso agregado do mês corrente. Zera quando não há linha. */
export async function fetchUsageThisMonth(userId: string): Promise<UsageThisMonth> {
  const month = currentMonthKey();
  const { data, error } = await supabase
    .from("current_month_usage")
    .select("total_this_month, by_feature")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return { total: 0, byFeature: {}, month };
  const row = data as { total_this_month: number | null; by_feature: Record<string, number> | null };
  return {
    total: Number(row.total_this_month ?? 0),
    byFeature: (row.by_feature ?? {}) as Partial<Record<PaywalledFeature, number>>,
    month,
  };
}
```

- [ ] **Step 2: Build**

Run: `npx tsc --noEmit --project tsconfig.app.json`
Expected: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabaseBilling.ts
git commit -m "feat(billing): leitura de subscription e uso do mes (client)"
```

---

## Task 7: `src/hooks/useSubscription.ts`

**Files:**
- Create: `src/hooks/useSubscription.ts`

- [ ] **Step 1: Implementar**

```ts
// src/hooks/useSubscription.ts
import { useCallback, useEffect, useState } from "react";
import { fetchSubscriptionFromServer, fetchUsageThisMonth } from "@/lib/supabaseBilling";
import { hasProAccess } from "@/lib/billing";
import type { Plan, Subscription, UsageThisMonth } from "@/types/stock";

interface SubscriptionState {
  plan: Plan;
  subscription: Subscription | null;
  usageThisMonth: UsageThisMonth | null;
  loading: boolean;
}

const EMPTY: SubscriptionState = {
  plan: "free",
  subscription: null,
  usageThisMonth: null,
  loading: false,
};

/**
 * Fonte de verdade do plano no client. Hidrata ao receber um userId (login) e
 * expõe `refresh` pra recarregar após assinar/cancelar. Sem realtime no MVP —
 * a UI chama refresh nos momentos relevantes (retorno do checkout, abrir billing).
 */
export function useSubscription(userId: string | null) {
  const [state, setState] = useState<SubscriptionState>(EMPTY);

  const load = useCallback(async (uid: string) => {
    setState((s) => ({ ...s, loading: true }));
    const [sub, usage] = await Promise.all([
      fetchSubscriptionFromServer(uid),
      fetchUsageThisMonth(uid),
    ]);
    setState({
      plan: hasProAccess(sub) ? "pro" : "free",
      subscription: sub,
      usageThisMonth: usage,
      loading: false,
    });
  }, []);

  useEffect(() => {
    if (!userId) {
      setState(EMPTY);
      return;
    }
    void load(userId);
  }, [userId, load]);

  const refresh = useCallback(() => {
    if (userId) void load(userId);
  }, [userId, load]);

  return { ...state, refresh };
}
```

- [ ] **Step 2: Build**

Run: `npx tsc --noEmit --project tsconfig.app.json`
Expected: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSubscription.ts
git commit -m "feat(billing): hook useSubscription (fonte de verdade do plano)"
```

---

## Task 8: `api/_mercadopago.ts` — helper REST + verificação de assinatura

**Files:**
- Create: `api/_mercadopago.ts`
- Test: `api/_mercadopago.test.ts`

- [ ] **Step 1: Write the failing test (foco na verificação de assinatura)**

```ts
// api/_mercadopago.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import { verifyWebhookSignature } from "./_mercadopago";

function signedReq(dataId: string, requestId: string, ts: string, secret: string) {
  // Manifest conforme docs MP: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac("sha256", secret).update(manifest).digest("hex");
  return {
    headers: {
      "x-signature": `ts=${ts},v1=${v1}`,
      "x-request-id": requestId,
    },
    query: { "data.id": dataId },
  } as unknown as import("@vercel/node").VercelRequest;
}

describe("verifyWebhookSignature", () => {
  beforeEach(() => vi.stubEnv("MP_WEBHOOK_SECRET", "topsecret"));

  it("aceita assinatura valida", () => {
    const req = signedReq("12345", "req-1", "1700000000", "topsecret");
    expect(verifyWebhookSignature(req)).toBe(true);
  });

  it("rejeita assinatura adulterada", () => {
    const req = signedReq("12345", "req-1", "1700000000", "topsecret");
    (req.headers as Record<string, string>)["x-signature"] = "ts=1700000000,v1=deadbeef";
    expect(verifyWebhookSignature(req)).toBe(false);
  });

  it("rejeita quando falta header", () => {
    const req = { headers: {}, query: {} } as unknown as import("@vercel/node").VercelRequest;
    expect(verifyWebhookSignature(req)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/_mercadopago.test.ts`
Expected: FAIL — `Cannot find module './_mercadopago'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// api/_mercadopago.ts
import type { VercelRequest } from "@vercel/node";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Helper da REST do Mercado Pago. Sem dep nova — fetch direto.
 * Docs assinatura: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */

const MP_BASE = "https://api.mercadopago.com";

export class MPError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "MPError";
  }
}

/** Chamada autenticada à API do MP. Lança MPError em status >= 400. */
export async function mpFetch<T = unknown>(
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown
): Promise<T> {
  const token = process.env.MP_ACCESS_TOKEN || "";
  if (!token) throw new MPError(503, "MP_ACCESS_TOKEN ausente");
  const res = await fetch(`${MP_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as T;
  if (res.status >= 400) {
    throw new MPError(res.status, `MP ${method} ${path} -> ${res.status}`);
  }
  return json;
}

/**
 * Valida a origem do webhook via HMAC-SHA256.
 * Header `x-signature: ts=<ts>,v1=<hash>`; manifest assinado é
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`.
 */
export function verifyWebhookSignature(request: VercelRequest): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET || "";
  if (!secret) return false;

  const sigHeader = (request.headers["x-signature"] as string | undefined) ?? "";
  const requestId = (request.headers["x-request-id"] as string | undefined) ?? "";
  const dataId = String((request.query?.["data.id"] as string | undefined) ?? "");
  if (!sigHeader || !requestId || !dataId) return false;

  const parts = Object.fromEntries(
    sigHeader.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim(), v?.trim()];
    })
  );
  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  // Comparação em tempo constante (evita timing attack). Tamanhos iguais → safe.
  const a = Buffer.from(v1, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Subset do schema de Preapproval do MP que usamos. */
export interface MPPreapproval {
  id: string;
  status: "pending" | "authorized" | "paused" | "cancelled";
  payer_id?: number;
  init_point?: string;
  next_payment_date?: string;
  external_reference?: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/_mercadopago.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add api/_mercadopago.ts api/_mercadopago.test.ts
git commit -m "feat(billing): helper REST Mercado Pago + verificacao de assinatura"
```

---

## Task 9: `api/checkout.ts` — cria Preapproval

**Files:**
- Create: `api/checkout.ts`

- [ ] **Step 1: Implementar**

```ts
// api/checkout.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { applyCors } from "./_cors";
import { checkRateLimit } from "./_ratelimit";
import { mpFetch, MPError, type MPPreapproval } from "./_mercadopago";

/**
 * Cria uma assinatura (Preapproval) recorrente no Mercado Pago e devolve o
 * `init_point` pro client redirecionar. Exige Bearer JWT do Supabase.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const PUBLIC_URL = process.env.PUBLIC_URL || "";
const PRO_PRICE_BRL = 29.0;

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (applyCors(request, response, "POST, OPTIONS")) return;
  if (request.method !== "POST") return response.status(405).json({ error: "method-not-allowed" });

  const rate = checkRateLimit(request, { windowMs: 60_000, max: 5, burstMax: 2, burstWindowMs: 5_000 });
  if (!rate.allowed) {
    response.setHeader("Retry-After", String(rate.retryAfterSec));
    return response.status(429).json({ error: "rate-limited", retryAfterSec: rate.retryAfterSec });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !process.env.MP_ACCESS_TOKEN) {
    return response.status(503).json({ error: "billing-not-configured" });
  }

  const m = /^Bearer\s+(.+)$/i.exec(request.headers.authorization || "");
  if (!m) return response.status(401).json({ error: "missing-bearer-token" });
  const accessToken = m[1].trim();

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await admin.auth.getUser(accessToken);
  if (userErr || !userData?.user?.email) {
    return response.status(401).json({ error: "invalid-token" });
  }
  const user = userData.user;

  try {
    const preapproval = await mpFetch<MPPreapproval>("POST", "/preapproval", {
      reason: "Praxia Pro — assinatura mensal",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: PRO_PRICE_BRL,
        currency_id: "BRL",
      },
      back_url: `${PUBLIC_URL}/billing/return`,
      payer_email: user.email,
      external_reference: user.id, // recuperado no webhook
      status: "pending",
    });

    // Registra subscription pendente (upsert por mp_preapproval_id).
    await admin.from("subscriptions").insert({
      user_id: user.id,
      mp_preapproval_id: preapproval.id,
      plan: "pro",
      status: "pending",
      amount_brl: PRO_PRICE_BRL,
    });

    return response.status(200).json({ init_point: preapproval.init_point });
  } catch (e) {
    const status = e instanceof MPError ? e.status : 500;
    console.error("[api/checkout] erro:", { userId: user.id, status });
    return response.status(status >= 500 ? 502 : status).json({ error: "checkout-failed" });
  }
}
```

- [ ] **Step 2: Build**

Run: `npx tsc --noEmit --project tsconfig.app.json` (ou o tsconfig que cobre `api/` — confirmar que `api/` compila; os outros handlers já compilam).
Expected: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add api/checkout.ts
git commit -m "feat(billing): endpoint checkout cria Preapproval no Mercado Pago"
```

---

## Task 10: `api/mp-webhook.ts` — recebe notificações do MP

**Files:**
- Create: `api/mp-webhook.ts`

- [ ] **Step 1: Implementar**

```ts
// api/mp-webhook.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { mpFetch, verifyWebhookSignature, type MPPreapproval } from "./_mercadopago";

/**
 * Webhook do Mercado Pago. NÃO usa Authorization Bearer (vem do MP) — valida via
 * assinatura HMAC. Idempotente: lê o estado atual do Preapproval no MP e espelha
 * em `subscriptions`. Eventos desconhecidos respondem 200 (não quebra retry do MP).
 *
 * Sem CORS estrito (servidor-a-servidor). Logs sem payload cru.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/** Mapeia status do Preapproval MP -> status interno. */
function mapStatus(mp: MPPreapproval["status"]): "active" | "paused" | "cancelled" | "pending" {
  switch (mp) {
    case "authorized":
      return "active";
    case "paused":
      return "paused";
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
  }
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== "POST") return response.status(405).json({ error: "method-not-allowed" });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return response.status(503).json({ error: "not-configured" });

  if (!verifyWebhookSignature(request)) {
    console.warn("[api/mp-webhook] assinatura invalida");
    return response.status(401).json({ error: "invalid-signature" });
  }

  const body = (request.body || {}) as { type?: string; action?: string; data?: { id?: string } };
  const type = body.type ?? "";
  const preapprovalId = body.data?.id;

  // Só tratamos eventos de assinatura. Pagamentos avulsos / outros → 200 e ignora.
  if (type !== "subscription_preapproval" || !preapprovalId) {
    return response.status(200).json({ ok: true, ignored: true });
  }

  try {
    const pre = await mpFetch<MPPreapproval>("GET", `/preapproval/${preapprovalId}`);
    const status = mapStatus(pre.status);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const patch: Record<string, unknown> = { status };
    if (status === "active") {
      patch.started_at = new Date().toISOString();
      if (pre.next_payment_date) patch.current_period_end = pre.next_payment_date;
    }
    if (status === "cancelled") patch.cancelled_at = new Date().toISOString();

    // Idempotente: atualiza a row pelo mp_preapproval_id (criada no checkout).
    const { error } = await admin
      .from("subscriptions")
      .update(patch)
      .eq("mp_preapproval_id", preapprovalId);

    if (error) {
      console.error("[api/mp-webhook] update falhou:", { preapprovalId, status });
      return response.status(500).json({ error: "update-failed" });
    }

    console.info("[api/mp-webhook] ok:", { preapprovalId, status });
    return response.status(200).json({ ok: true });
  } catch (e) {
    console.error("[api/mp-webhook] erro:", String((e as Error).message).slice(0, 120));
    return response.status(500).json({ error: "internal-error" });
  }
}
```

- [ ] **Step 2: Build**

Run: `npx tsc --noEmit --project tsconfig.app.json`
Expected: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add api/mp-webhook.ts
git commit -m "feat(billing): webhook MP espelha status da assinatura (idempotente)"
```

---

## Task 11: `api/cancel-subscription.ts`

**Files:**
- Create: `api/cancel-subscription.ts`

- [ ] **Step 1: Implementar**

```ts
// api/cancel-subscription.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { applyCors } from "./_cors";
import { checkRateLimit } from "./_ratelimit";
import { mpFetch, MPError } from "./_mercadopago";

/**
 * Cancela a assinatura ativa do usuário no Mercado Pago. O webhook subsequente
 * confirma o status `cancelled`; aqui já marcamos otimisticamente pra UI refletir.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (applyCors(request, response, "POST, OPTIONS")) return;
  if (request.method !== "POST") return response.status(405).json({ error: "method-not-allowed" });

  const rate = checkRateLimit(request, { windowMs: 60_000, max: 5, burstMax: 2, burstWindowMs: 5_000 });
  if (!rate.allowed) {
    response.setHeader("Retry-After", String(rate.retryAfterSec));
    return response.status(429).json({ error: "rate-limited", retryAfterSec: rate.retryAfterSec });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !process.env.MP_ACCESS_TOKEN) {
    return response.status(503).json({ error: "billing-not-configured" });
  }

  const m = /^Bearer\s+(.+)$/i.exec(request.headers.authorization || "");
  if (!m) return response.status(401).json({ error: "missing-bearer-token" });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await admin.auth.getUser(m[1].trim());
  if (userErr || !userData?.user) return response.status(401).json({ error: "invalid-token" });
  const userId = userData.user.id;

  const { data: sub } = await admin
    .from("subscriptions")
    .select("mp_preapproval_id")
    .eq("user_id", userId)
    .in("status", ["active", "pending"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub?.mp_preapproval_id) return response.status(404).json({ error: "no-active-subscription" });

  try {
    await mpFetch("PUT", `/preapproval/${sub.mp_preapproval_id}`, { status: "cancelled" });
    await admin
      .from("subscriptions")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("mp_preapproval_id", sub.mp_preapproval_id);
    return response.status(200).json({ ok: true });
  } catch (e) {
    const status = e instanceof MPError ? e.status : 500;
    console.error("[api/cancel-subscription] erro:", { userId, status });
    return response.status(status >= 500 ? 502 : status).json({ error: "cancel-failed" });
  }
}
```

- [ ] **Step 2: Build + commit**

Run: `npx tsc --noEmit --project tsconfig.app.json` → 0 erros.

```bash
git add api/cancel-subscription.ts
git commit -m "feat(billing): endpoint cancelar assinatura"
```

---

## Task 12: `src/components/praxia/PaywallModal.tsx`

**Files:**
- Create: `src/components/praxia/PaywallModal.tsx`

> Segue convenção de modal sibling do AppShell (`position:absolute; inset:0`), inline styles + `PraxiaTokens`, keyframes `praFadeIn`/`praSlideUp`. Confirmar imports exatos de tokens/Icon olhando um modal existente (`OptimizeDividendsModal.tsx`) antes de escrever — usar os MESMOS nomes de export.

- [ ] **Step 1: Implementar**

```tsx
// src/components/praxia/PaywallModal.tsx
import { PraxiaTokens } from "./tokens";
import { Icon } from "./Icon";
import { PRO_PRICE_BRL, featureLabels, PAYWALLED_FEATURES } from "@/lib/billing";
import type { PaywallRequiredPayload } from "@/types/stock";

interface PaywallModalProps {
  /** Payload do 402 que disparou o paywall; null = fechado. */
  payload: PaywallRequiredPayload | null;
  /** JWT pra autorizar o checkout. */
  accessToken: string | null;
  onClose: () => void;
}

export function PaywallModal({ payload, accessToken, onClose }: PaywallModalProps) {
  const T = PraxiaTokens;
  if (!payload) return null;

  async function assinar() {
    if (!accessToken) return;
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return;
    const { init_point } = (await res.json()) as { init_point?: string };
    if (init_point) window.location.href = init_point;
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 60,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "flex-end",
        animation: "praFadeIn 160ms ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          background: T.bgDeep,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: 24,
          animation: "praSlideUp 220ms ease",
          color: T.ink,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 26, margin: 0 }}>
            Praxia Pro
          </h2>
          <button onClick={onClose} aria-label="Fechar" style={{ background: "none", border: "none", color: T.ink, cursor: "pointer" }}>
            <Icon name="x" />
          </button>
        </div>

        <p style={{ color: T.ink70, marginTop: 8 }}>
          Você usou {payload.currentUsage} de {payload.limit} consultas de IA grátis este mês.
          Assine o Pro pra liberar tudo, sem limite.
        </p>

        <ul style={{ listStyle: "none", padding: 0, margin: "16px 0", display: "grid", gap: 8 }}>
          {PAYWALLED_FEATURES.map((f) => (
            <li key={f} style={{ display: "flex", gap: 8, alignItems: "center", color: T.ink }}>
              <Icon name="check" />
              {featureLabels[f]}
            </li>
          ))}
        </ul>

        <button
          onClick={assinar}
          disabled={!accessToken}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 12,
            border: "none",
            background: T.accent,
            color: T.bgDeep,
            fontWeight: 700,
            fontSize: 16,
            cursor: accessToken ? "pointer" : "not-allowed",
          }}
        >
          Assinar Praxia Pro — R$ {PRO_PRICE_BRL.toFixed(2).replace(".", ",")}/mês
        </button>
      </div>
    </div>
  );
}
```

> Se `Icon` não tiver os nomes `x`/`check`, usar os equivalentes existentes em `Icon.tsx` (verificar antes). Não inventar ícones novos.

- [ ] **Step 2: Build**

Run: `npx tsc --noEmit --project tsconfig.app.json`
Expected: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/praxia/PaywallModal.tsx
git commit -m "feat(billing): PaywallModal de upsell para Pro"
```

---

## Task 13: `src/components/praxia/screens/ScreenBilling.tsx`

**Files:**
- Create: `src/components/praxia/screens/ScreenBilling.tsx`

- [ ] **Step 1: Implementar**

```tsx
// src/components/praxia/screens/ScreenBilling.tsx
import { PraxiaTokens } from "../tokens";
import { FREE_MONTHLY_LIMIT, PRO_PRICE_BRL } from "@/lib/billing";
import type { Plan, Subscription, UsageThisMonth } from "@/types/stock";

interface ScreenBillingProps {
  plan: Plan;
  subscription: Subscription | null;
  usageThisMonth: UsageThisMonth | null;
  accessToken: string | null;
  onSubscribed: () => void;
}

export function ScreenBilling({ plan, subscription, usageThisMonth, accessToken, onSubscribed }: ScreenBillingProps) {
  const T = PraxiaTokens;

  async function assinar() {
    if (!accessToken) return;
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return;
    const { init_point } = (await res.json()) as { init_point?: string };
    if (init_point) window.location.href = init_point;
  }

  async function cancelar() {
    if (!accessToken) return;
    const res = await fetch("/api/cancel-subscription", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) onSubscribed(); // refresh do estado
  }

  return (
    <div style={{ padding: 20, color: T.ink }}>
      <h1 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 28 }}>Seu plano</h1>

      {plan === "pro" ? (
        <div style={{ marginTop: 16 }}>
          <p style={{ color: T.ink }}>Plano atual: <strong>Praxia Pro</strong></p>
          {subscription?.currentPeriodEnd && (
            <p style={{ color: T.ink70 }}>
              Renova em {new Date(subscription.currentPeriodEnd).toLocaleDateString("pt-BR")}
            </p>
          )}
          <p style={{ color: T.ink70 }}>R$ {PRO_PRICE_BRL.toFixed(2).replace(".", ",")}/mês</p>
          {subscription?.status === "active" && (
            <button onClick={cancelar} style={{ marginTop: 16, padding: "12px 16px", borderRadius: 12, border: `1px solid ${T.ink30}`, background: "transparent", color: T.ink, cursor: "pointer" }}>
              Cancelar assinatura
            </button>
          )}
          {subscription?.status === "cancelled" && (
            <p style={{ color: T.warn, marginTop: 12 }}>
              Assinatura cancelada — acesso Pro mantido até o fim do período pago.
            </p>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          <p style={{ color: T.ink }}>Plano atual: <strong>Grátis</strong></p>
          <p style={{ color: T.ink70 }}>
            {usageThisMonth?.total ?? 0} de {FREE_MONTHLY_LIMIT} consultas de IA usadas este mês.
          </p>
          <button onClick={assinar} disabled={!accessToken} style={{ marginTop: 16, padding: "14px 16px", borderRadius: 12, border: "none", background: T.accent, color: T.bgDeep, fontWeight: 700, cursor: accessToken ? "pointer" : "not-allowed" }}>
            Assinar Pro — R$ {PRO_PRICE_BRL.toFixed(2).replace(".", ",")}/mês
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build + commit**

Run: `npx tsc --noEmit --project tsconfig.app.json` → 0 erros.

```bash
git add src/components/praxia/screens/ScreenBilling.tsx
git commit -m "feat(billing): tela ScreenBilling (gerenciar plano)"
```

---

## Task 14: Wire em `src/App.tsx`

**Files:**
- Modify: `src/App.tsx`

> Antes de editar, ler `src/App.tsx` por completo pra achar: (a) o `type Screen` union (~linha 59), (b) onde `useAuth()`/`useStockQuotes()` são chamados, (c) onde os modais sibling são renderizados (~linha 564), (d) como `ScreenProfile` recebe props. Casar com os padrões existentes.

- [ ] **Step 1: Imports**

Adicionar no topo, junto aos outros imports de hooks/componentes:

```ts
import { useSubscription } from "@/hooks/useSubscription";
import { setAIAccessToken, PaywallRequiredError } from "@/lib/aiAuth";
import { PaywallModal } from "@/components/praxia/PaywallModal";
import type { PaywallRequiredPayload } from "@/types/stock";
```

E o lazy import da tela (junto aos outros lazy, ~linha 58):

```ts
const ScreenBilling = lazy(() =>
  import("@/components/praxia/screens/ScreenBilling").then((m) => ({ default: m.ScreenBilling }))
);
```

- [ ] **Step 2: Adicionar `"billing"` ao Screen union**

No `type Screen = ...` (~linha 59), acrescentar `| "billing"`.

- [ ] **Step 3: Lift do hook + registrar token + flag de billing**

Após o `const { user, ... } = useAuth();` (~linha 596), adicionar:

```ts
  const subscription = useSubscription(user?.id ?? null);
  const billingEnabled = import.meta.env.VITE_BILLING_ENABLED === "true";
  const [paywallPayload, setPaywallPayload] = useState<PaywallRequiredPayload | null>(null);

  // Mantém o token de acesso disponível pras chamadas /api/ai (lib aiAuth).
  useEffect(() => {
    setAIAccessToken(session?.access_token ?? null);
  }, [session]);
```

> `session` já vem do `useAuth()` — incluir na desestruturação se ainda não estiver: `const { user, session, loading: authLoading, signOut } = useAuth();`.

- [ ] **Step 4: Handler central de paywall**

Adicionar um helper que telas/modais usam ao chamar IA:

```ts
  // Envolve qualquer chamada de IA: converte PaywallRequiredError em abertura do modal.
  const runAI = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof PaywallRequiredError) {
        setPaywallPayload(e.payload);
        return null;
      }
      throw e;
    }
  }, []);
```

> `runAI` é opcional pro MVP dormente (com billing off nunca há 402). Passá-lo às telas que chamam IA é incremental; o essencial pro dormante é só o `PaywallModal` montado. Se preferir minimizar churn agora, pode pular a propagação de `runAI` e deixar o modal pronto pra quando billing ligar — registrar no doc da Entrega 3 que cada call-site de IA deve ser envolvido em `runAI` ao ativar.

- [ ] **Step 5: Render do PaywallModal + rota billing**

No bloco de modais sibling (~linha 564, junto ao `PortfolioInsightsModal`), adicionar:

```tsx
          <PaywallModal
            payload={paywallPayload}
            accessToken={session?.access_token ?? null}
            onClose={() => setPaywallPayload(null)}
          />
```

No switch/render de `screen`, adicionar o caso (junto aos outros `Screen*`):

```tsx
          {screen === "billing" && (
            <ScreenBilling
              plan={subscription.plan}
              subscription={subscription.subscription}
              usageThisMonth={subscription.usageThisMonth}
              accessToken={session?.access_token ?? null}
              onSubscribed={subscription.refresh}
            />
          )}
```

- [ ] **Step 6: Passar plan + billingEnabled pro ScreenProfile**

Onde `ScreenProfile` é renderizado, acrescentar props:

```tsx
              plan={subscription.plan}
              billingEnabled={billingEnabled}
              onOpenBilling={() => setScreen("billing")}
```

- [ ] **Step 7: Build**

Run: `npx tsc --noEmit --project tsconfig.app.json`
Expected: 0 erros. (Se `useCallback`/`useEffect`/`useState` não estiverem importados de `react`, adicionar.)

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx
git commit -m "feat(billing): lift useSubscription, registra token, monta PaywallModal e rota billing"
```

---

## Task 15: Botão "Gerenciar plano" em `ScreenProfile.tsx`

**Files:**
- Modify: `src/components/praxia/screens/ScreenProfile.tsx`

> Ler o componente primeiro pra ver a interface de props e o padrão dos botões/itens de menu existentes (ex.: o botão de Batch Valuation ou delete-account). Casar com esse padrão.

- [ ] **Step 1: Estender a interface de props**

Adicionar à interface de props do `ScreenProfile`:

```ts
  plan: import("@/types/stock").Plan;
  billingEnabled: boolean;
  onOpenBilling: () => void;
```

> Preferir importar `Plan` no topo do arquivo (`import type { Plan } from "@/types/stock";`) e usar `plan: Plan;` — o inline import acima é só ilustrativo.

- [ ] **Step 2: Renderizar o botão SÓ quando billing on**

Junto aos outros itens de menu/ações:

```tsx
      {billingEnabled && (
        <button onClick={onOpenBilling} style={/* mesmo estilo dos outros itens de menu do arquivo */}>
          Gerenciar plano {plan === "pro" ? "· Pro" : "· Grátis"}
        </button>
      )}
```

- [ ] **Step 3: Build**

Run: `npx tsc --noEmit --project tsconfig.app.json`
Expected: 0 erros.

- [ ] **Step 4: Commit**

```bash
git add src/components/praxia/screens/ScreenProfile.tsx
git commit -m "feat(billing): botao Gerenciar plano no perfil (gated por billing on)"
```

---

## Task 16: `.env.example`

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Acrescentar as vars de billing**

Adicionar ao fim do arquivo:

```bash
# ─── Billing (Mercado Pago) — só necessário pra LIGAR cobrança (Entrega 3) ───
# Deixe BILLING_ENABLED ausente/!=true pra rodar grátis e ilimitado (modo dormente).
BILLING_ENABLED=
VITE_BILLING_ENABLED=
# Credenciais do app no painel MP (use TEST primeiro):
MP_ACCESS_TOKEN=
MP_WEBHOOK_SECRET=
# URL pública do app (back_url do checkout + base do webhook):
PUBLIC_URL=https://praxia.vercel.app
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs(billing): documenta envs de billing no .env.example"
```

---

## Task 17: Rodar suíte completa + build final

**Files:** nenhum (verificação).

- [ ] **Step 1: Testes**

Run: `npm run test:run`
Expected: PASS — os 586 anteriores + os novos (billing, aiAuth, _usageGuard, _mercadopago). Sem regressão.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: baseline (~18 `any` + 2 warnings pré-existentes), 0 erros novos.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: verde, 0 erros TS.

- [ ] **Step 4: Commit (se lint/format ajustar algo)**

```bash
git add -A
git commit -m "chore(billing): suite verde + build apos billing dormante"
```

---

## Task 18: Doc de deploy grátis (Entrega 1) e flip-the-switch (Entrega 3)

**Files:**
- Create: `docs/deploy-vercel.md`
- Create: `docs/billing-flip-the-switch.md`

> Documentação — passos executados manualmente pelo usuário. Escrever em PT-BR, objetivo, em checklist.

- [ ] **Step 1: `docs/deploy-vercel.md`**

Conteúdo (checklist):
1. Criar conta no Vercel e conectar o repo (branch `main`).
2. Em Project Settings → Environment Variables (Production), setar:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (mesmos valores do `.env.local` atual).
   - `SUPABASE_URL` (= VITE_SUPABASE_URL), `SUPABASE_SERVICE_ROLE_KEY` (do Supabase Dashboard → Project Settings → API).
   - Chave do provider de IA (`OPENROUTER_API_KEY` ou a usada localmente — ver `api/_llm.ts`).
   - `PRAXIA_ALLOWED_ORIGINS=https://praxia.vercel.app` (CORS — ver `api/_cors.ts`).
   - **NÃO** setar `BILLING_ENABLED` nem `VITE_BILLING_ENABLED` (ausência = grátis/ilimitado).
3. No Supabase Dashboard → SQL Editor, rodar `supabase/migrations/001_initial.sql` e `002_billing.sql` (idempotência: só rodar uma vez; se já rodou a 001 em dev e é o mesmo projeto, rodar só a 002).
4. No Supabase → Authentication → URL Configuration: Site URL = `https://praxia.vercel.app`; adicionar `https://praxia.vercel.app/**` em Redirect URLs (senão o magic link volta pro localhost).
5. Deploy. Abrir `https://praxia.vercel.app`, fazer login por magic link de ponta a ponta (ponto que mais quebra é a Redirect URL do passo 4).

- [ ] **Step 2: `docs/billing-flip-the-switch.md`**

Conteúdo (checklist da Entrega 3):
1. Abrir conta Mercado Pago (empresarial/MEI) — leva ~3 dias úteis.
2. Painel de desenvolvedores MP → criar app → pegar credenciais **TEST**.
3. Vercel envs: `MP_ACCESS_TOKEN` (TEST), `MP_WEBHOOK_SECRET`, `PUBLIC_URL=https://praxia.vercel.app`.
4. MP → Webhooks: registrar `https://praxia.vercel.app/api/mp-webhook`, eventos `subscription_preapproval` (+ `payment` se desejado). Gerar e copiar o secret pro `MP_WEBHOOK_SECRET`.
5. Setar `BILLING_ENABLED=true` e `VITE_BILLING_ENABLED=true` no Vercel. Redeploy.
6. Smoke E2E com cartão de teste do MP: assinar → conferir redirect → conferir webhook chega → `subscriptions.status=active` → paywall some → "Gerenciar plano" aparece como Pro.
7. Envolver cada call-site de IA em `runAI` (App.tsx) se ainda não estiver (pra capturar 402 e abrir o PaywallModal) — ver nota da Task 14, Step 4.
8. Trocar credenciais TEST → produção. Validar uma assinatura real de R$ 29 e cancelar.

- [ ] **Step 3: Commit**

```bash
git add docs/deploy-vercel.md docs/billing-flip-the-switch.md
git commit -m "docs(billing): guia de deploy gratis + checklist de ativacao de cobranca"
```

---

## Self-Review (preenchido na escrita)

- **Spec coverage:** Entrega 1 → Task 18 (doc). Entrega 2 → Tasks 1–17. Entrega 3 → Task 18 (doc). Flag `BILLING_ENABLED`/`VITE_BILLING_ENABLED` → Tasks 3, 14, 16, 18. "Gerenciar plano" escondido com flag off → Task 15 (`billingEnabled &&`). Modelo 10/mês + R$29 → Tasks 1, 3.
- **Type consistency:** `assertCanUseAI(request, feature)` (Task 3) chamado com 2 args em Task 4. `trackUsage(userId, feature)` idem. `setAIAccessToken`/`aiAuthHeaders`/`throwIfPaywalled`/`PaywallRequiredError` (Task 2) usados em Tasks 5 e 14. `useSubscription(userId)` retorna `{plan, subscription, usageThisMonth, loading, refresh}` (Task 7) consumido em Task 14. `PaywallModal` props `{payload, accessToken, onClose}` (Task 12) batem com Task 14. `ScreenBilling` props (Task 13) batem com Task 14. Tipos `Plan`/`Subscription`/`UsageThisMonth`/`PaywallRequiredPayload`/`PaywalledFeature` já em `src/types/stock.ts`.
- **Placeholders:** sem TBD/TODO. Os pontos "ler o arquivo antes" (App.tsx, ScreenProfile, PaywallModal/Icon) são instruções de casamento com padrão existente, não placeholders de lógica — o código a inserir está completo.
- **Riscos conhecidos sinalizados inline:** nomes de `Icon` (Task 12), encadeamento de mock do supabase (Task 3), `runAI` opcional no dormante (Task 14).
