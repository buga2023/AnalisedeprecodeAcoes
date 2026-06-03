# Praxia — Situação Atual

> Documento vivo. Última atualização: 2026-06-03.
> Estado: **Roadmap 100% implementado** — todas as 10 fases + FIIs commitadas em `main`.
> Commit: `cad42e1` — feat(roadmap): implementa Fases 4, 5, 8, 9 + testes 557/557
> Próximo passo: **deploy MVP na Vercel**.

---

## 0. Norte do projeto

**Princípio fundamental:** cada feature deve ser aparente e descoberta pelo usuário sem esforço. O diferencial do Praxia são os cálculos fundamentalistas (Graham VI, Bazin, Graham com Crescimento, Margem de Segurança, ROIC, Score 0–100) — esses valores precisam aparecer em destaque, não escondidos.

---

## 1. Stack

| Camada | Escolha |
|---|---|
| UI | React 19 SPA + TypeScript 5.9 strict |
| Bundler | Vite 7 + `@vitejs/plugin-react` |
| Styling | Tailwind v4 (utilities) + inline com `PraxiaTokens` |
| Serverless | Vercel Functions (`api/*.ts`) |
| Auth | Supabase (magic-link + Postgres + RLS) |
| Persistência | `localStorage` + Supabase Postgres |
| IA | `/api/ai` multi-provider: Groq (default) / OpenAI / Anthropic / Gemini |
| Testes | Vitest 557/557 passando |

**Build atual** (2026-06-03): `npm run build` ✅ — 0 erros TS, bundle ~583 KB index (supabase-js), xlsx chunk 424 KB lazy.

---

## 2. Roadmap — status completo

| Fase | Feature | Status |
|---|---|---|
| 0 | UX Valuation — seção Graham/Bazin/Score em ScreenStockDetail | ✅ |
| 0.5 | Bug fix — alerta de margem Graham (×100 errado) | ✅ |
| 1 | ScreenAnalysis — tela central de análise de portfólio | ✅ |
| 2 | Notícias por ação + sentimento IA | ✅ |
| 3 | Calendário de dividendos + otimizador IA | ✅ |
| 4 | **Screener com IA** — tab "Descobrir ✦" em ScreenMarket | ✅ |
| 5 | **Rebalanceador IA** — sliders + ordens acionáveis | ✅ |
| 6 | Digest semanal IA | ✅ |
| 7 | Histórico de fundamentos (sparkline trimestral) | ✅ |
| 8 | **Suporte a FIIs** — score próprio, toggle Ações/FIIs | ✅ |
| 9 | **Calculadora de IR** — isenção R$20k, carryforward, DARF, exportação XLSX | ✅ |
| Extra | Auth real Supabase (magic-link + RLS + LGPD) | ✅ |
| Extra | Otimização IA (−30–45% tokens) + telemetria | ✅ |

---

## 3. O que foi feito nas últimas sessões (2026-06-03)

### Fase 4 — Screener com IA
- `api/screen.ts` — endpoint POST: query → LLM → filtros + tickers B3, rate-limit 8/min, cache 30min
- `src/lib/screener.ts` — `runScreener()`: chama API, busca cotações brapi bulk, aplica filtros, retorna top-10
- `ScreenMarketScreener.tsx` — UI com input livre, 6 quick queries, badges de filtros, lista ranqueada
- `ScreenMarket.tsx` — nova tab "Descobrir ✦" (não afeta tabs existentes)

### Fase 8 — FIIs
- `Stock.assetType: "stock" | "fii"` — detecção automática via `isFII()` (regex + blacklist ETFs)
- `src/lib/fiiScore.ts` — score FII: DY (40), P/VP (30), Segmento (15), Liquidez heurística (15)
- `FIIDetailStats.tsx` — card com DY anual, rendimento mensal estimado, P/VP, segmento, breakdown
- `ScreenStockDetail.tsx` — FIIs mostram FIIDetailStats no lugar da seção Graham
- `ScreenMarket.tsx` — toggle Ações | FIIs (aparece quando carteira tem ≥1 FII)

### Fase 5 — Rebalanceador IA
- `src/lib/rebalance.ts` — `generateRebalanceOrders()`: custo médio, maior score → compra, menor → venda
- `src/lib/ai.ts` — `explicarRebalanceamento()`: comentário IA 2-3 frases + alertas práticos
- `ScreenRebalance.tsx` — barras de alocação atual, sliders+botões por setor, ordens "Executar"
- Pontos de entrada: `ScreenAnalysis` (CTA contextual) + `PortfolioInsightsModal` (footer)

### Fase 9 — Calculadora de IR
- `src/lib/tax.ts` — custo médio ponderado, isenção swing <R$20k, 15% swing / 20% DT+FII, day trade automático, carryforward por categoria, DARF mínimo R$10
- `src/lib/exportTaxReport.ts` — XLSX 3 abas (lazy import = chunk próprio 2.4 KB)
- `ScreenTaxReport.tsx` — year picker, resumo anual, regras visuais, cards mensais colapsáveis
- Ponto de entrada: botão "Calcular IR" em `ScreenActivity` (aparece quando há vendas)

### Fix pré-existente
- `api/ai.ts` — validação de `messages` movida para antes da checagem de API key (400 antes de 503)

### Testes: 557/557 passando
- `tax.test.ts` — 37 casos (isenção, custo médio, carryforward, DT, FII, DARF min)
- `fiiScore.test.ts` — 23 casos (DY, P/VP, segmento, label, yield)
- `rebalance.test.ts` — 12 casos (normalizePcts, orders, score selection, edge cases)
- `screen.test.ts` — 14 casos (validação, LLM mock via vi.mock, sanitização, rate-limit)
- `stockMeta.test.ts` — +8 casos (isFII, detectSector FII)

---

## 4. Arquivos críticos de referência rápida

| O que procurar | Onde |
|---|---|
| Screen routing | `src/App.tsx:77` (type Screen) |
| Tokens / paleta / fontes | `src/components/praxia/tokens.ts` |
| Score ações 0–100 | `src/lib/calculators.ts:calculateStockScore` |
| Score FII 0–100 | `src/lib/fiiScore.ts:calculateFIIScore` |
| Detecção FII + segmento | `src/lib/stockMeta.ts` |
| Sistema de IR | `src/lib/tax.ts` |
| Rebalanceamento | `src/lib/rebalance.ts` |
| Screener (cliente) | `src/lib/screener.ts` |
| System prompt mestre da Pra | `src/lib/praxiaPrompt.ts` |
| Multi-provider IA | `api/ai.ts` |
| Endpoint screener | `api/screen.ts` |
| Tipos canônicos | `src/types/stock.ts` |
| Schema Supabase | `src/lib/supabaseSchema.ts` + `supabase/migrations/` |

---

## 5. Deploy MVP — checklist completo

### 5.1 Pré-requisitos externos (fora do código)

| Item | Status | Ação |
|---|---|---|
| Conta Vercel | ? | Criar ou logar em vercel.com |
| Projeto Vercel linkado ao repo GitHub | ? | `vercel link` ou via dashboard |
| Conta Supabase | ? | Criar projeto em supabase.com |
| Migration SQL aplicada | ? | Executar `supabase/migrations/001_initial.sql` no SQL Editor |
| Domínio custom (opcional) | ? | DNS → Vercel |

### 5.2 Variáveis de ambiente na Vercel (obrigatórias)

Configure em **Vercel Dashboard → Settings → Environment Variables** (ou `vercel env add`):

```
# IA (pelo menos 1 provider)
GROQ_API_KEY=gsk_...           # recomendado: free tier
AI_PROVIDER=groq               # ou omite (default já é groq)

# Supabase (frontend)
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Supabase (backend serverless — delete-account)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# CORS (produção)
PRAXIA_ALLOWED_ORIGINS=https://seu-dominio.vercel.app,https://praxia.com.br
```

### 5.3 Comando de deploy

```bash
# Primeira vez (via CLI)
npm i -g vercel
vercel --prod

# Deploys seguintes via GitHub (automático) ou:
vercel --prod
```

### 5.4 Validação pós-deploy

Testar manualmente (golden paths):

| Fluxo | O que verificar |
|---|---|
| Boot | Onboarding → Quiz → App carrega |
| Auth | Magic-link chega no e-mail, sessão persiste |
| Adicionar ação | Buscar PETR4, adicionar, score aparece |
| Adicionar FII | Buscar KNRI11, toggle FII aparece, score FII correto |
| Screener | Tab "Descobrir ✦" → query → resultados reais |
| Rebalancear | ScreenAnalysis → botão → sliders → "Gerar plano" → Executar |
| IR | ScreenActivity → "Calcular IR" → card com DARF |
| Exportar IR | Botão Exportar → `.xlsx` baixa |
| Chat Pra | Abrir chat, digitar mensagem, resposta chega |
| Notificações | Criar alerta em ScreenAlerts |

### 5.5 Cron (world-news)

`vercel.json` já tem o cron `0 */2 * * *` para `/api/world-news`. Ele funciona automaticamente no plano Pro da Vercel. No plano Free, chamar manualmente ou omitir.

### 5.6 Pendências de produto (pós-MVP)

| Item | Esforço | Dependência |
|---|---|---|
| **Billing Mercado Pago** (Fase 1.6) | 2-3 dias | Conta MP MEI ativa |
| **Landing page** (Fase 1.7) | 1 sessão | Domínio |
| **Sentry** — telemetria de erros | 4-6h | Conta Sentry |
| Revisão jurídica Termos de Uso | Externo | Advogado |
| Modo claro (toggle em ScreenProfile) | 1h | — |
| Playwright E2E nos fluxos críticos | 1 sessão | — |

---

## 6. Regras inegociáveis de implementação

1. **IA sempre via `/api/ai`** — nunca expor API key no cliente
2. **Cache em localStorage** com TTL + invalidação por signature
3. **Modais sempre como siblings de `AppShell`** em `App.tsx` — nunca dentro de scroll containers
4. **Sem novas deps npm** salvo necessidade absoluta
5. **`import type`** para todos os tipos (`verbatimModuleSyntax: true`)
6. **`npm run build` deve passar** após cada fase — baseline: 0 erros novos
7. **Features com IA**: texto começa "Pelo seu perfil…" + citações `[N]`
8. **Qualquer feature com `Transaction`**: log alimenta ScreenActivity + Calculadora IR
9. **Provider padrão: Groq + frugalidade de tokens** — prompts compactos, cache TTL+signature, nunca empurrar payload bruto

---

## 7. Como retomar (próxima sessão)

1. Ler esta seção + seção 3 (o que mudou)
2. Confirmar envs locais (`.env.local` com Supabase + GROQ)
3. `npm run dev` — testar magic-link
4. Próxima decisão: **deploy MVP** ou **Fase 1.6 (billing)**
