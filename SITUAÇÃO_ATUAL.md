# Praxia — Situação Atual

> Documento vivo. Última atualização: 2026-05-30 (prontidão de beta gratuito: LGPD + Sentry — ver seção 17).
> Estado: Fases 0, 0.5, 1, 2, **3 (Dividendos)**, **4 (Screener "Descobrir")**, **5 (Rebalanceador)**, **6 (Digest Semanal IA)** e **7 (Histórico de Fundamentos)** concluídas e **commitadas no branch `main`**.
> Pendentes: Fase 9 (IR). **Fase 8 (FIIs) — MVP concluído** no branch `feat/fase-8-fiis` (ver seção 16).
>
> **Sessão 2026-05-29 (4 agentes paralelos em git worktrees, integrados via merge validado):**
> - Fase 4 (Screener) e Fase 5 (Rebalanceador) implementadas e mergeadas (zero conflito, build/tsc/lint = baseline).
> - Cobertura de testes ampliada: 517 → **586 testes** (sync Supabase, useAuth, hooks de estado a 97–100%; +2 e2e LGPD/add-ticker). Cobertura global 73,7% → ~77,5%.
> - Auditoria LGPD concluída (`docs/lgpd-auditoria.md`): 0 crítico, 3 Alto (portabilidade declarada-mas-ausente, base legal não declarada, consentimento sem recusa). Implementação das correções **pendente de decisão**.
> - Pendência de infra: e2e não rodam localmente (chromium bloqueado por proxy) — `npx playwright install chromium` para validar.

---

## 0. Norte do projeto

**Princípio fundamental adotado nesta sessão:** cada feature deve ser aparente e descoberta pelo usuário sem esforço. O diferencial do Praxia são os cálculos fundamentalistas (Graham VI, Bazin, Graham com Crescimento, Margem de Segurança, ROIC, Score 0–100) — esses valores precisam aparecer em destaque, não escondidos dentro de números sem contexto.

Implicação prática: antes de adicionar features novas, garantir que o que já está implementado está **visível e compreensível** para o usuário.

---

## 1. Versão e identidade visual

**v0 "Engraved"** — rebrand fundacional (2026-05-14).

| Token | Valor |
|---|---|
| Fundo | `#0a0a10` onyx warm |
| Acento único | `#c8a25c` champagne gold |
| Texto | `#f4ecdf` parchment |
| Display | Cormorant Garamond + SC |
| Body | Manrope |
| Mono | JetBrains Mono |

Referência viva do design: `.praxia-design/` (não vai para o bundle).

---

## 2. Stack

| Camada | Escolha |
|---|---|
| UI | React 19 SPA + TypeScript 5.9 strict |
| Bundler | Vite 7 + `@vitejs/plugin-react` |
| Styling | Tailwind v4 (utilities) + inline com `PraxiaTokens` |
| Serverless | Vercel Functions (`api/*.ts`) + `vite-api-plugin.ts` em dev |
| Persistência | `localStorage` (15 chaves) — sem backend |
| IA | `/api/ai` multi-provider: OpenRouter (default) / Groq / OpenAI / Anthropic / Gemini |
| Fontes | Cormorant, Playfair, EB Garamond, Manrope, JetBrains Mono |

**Build atual** (2026-05-28, pós Fases 3+6+7): `npm run build` OK, **343 KB** index (+22 KB pelas 3 fases) + ~459 KB (xlsx chunk) + chunks por feature (OptimizeDividendsModal 8.7 KB, ScreenStockDetail 45 KB com hist. fundamentos), 0 erros TS, 0 erros lint novos.

---

## 3. Features já implementadas (status v0)

| Feature | Status | Observação |
|---|---|---|
| Boot flow (Onboarding A/B → Login → Quiz → App) | ✅ | |
| Login placeholder (admin/1234) | ✅ | sem auth real |
| ScreenHome (patrimônio, AI insight, posições, alocação) | ✅ | |
| ScreenMarket (tabs Em Alta / Para Você / Watchlist / B3 / NASDAQ) | ✅ | sem tab Descobrir |
| ScreenStockDetail (chart + stats + análise IA + relatórios) | ✅ | |
| ScreenOrder / ScreenOrderReview (paper trading) | ✅ | |
| ScreenActivity (histórico transações) | ✅ | |
| ScreenProfile (accent, tom Pra, clear data) | ✅ | |
| ScreenBatchValuation (CSV/XLSX → Graham/Bazin em lote) | ✅ | acessível só via Profile |
| ScreenAlerts (4 tipos + Notification API) | ✅ | |
| ScreenCompare (2–4 ações lado a lado + IA) | ✅ | |
| ScreenNews (Feed + Tópicos, GDELT + Google News RSS) | ✅ | totalmente implementado |
| ChatSheet — Pra conversacional + elicitação de perfil | ✅ | |
| QuickWatch overlay | ✅ | |
| AlertSheet wizard | ✅ | |
| PortfolioInsightsModal (análise IA 4–8 cards + sentimento) | ✅ | |
| MacroQuotesStrip (USD/EUR/BTC/ETH) | ✅ | no ScreenHome |
| Score 0–100 com 5 dimensões | ✅ | |
| Polling 60s + alert engine | ✅ | |
| Multi-provider IA (env-driven) | ✅ | |
| System prompt mestre (`praxiaPrompt.ts`) | ✅ | XML + few-shot + chain of thought |
| Caching localStorage por TTL + signature | ✅ | |

---

## 4. O que mudou nesta sessão (2026-05-28)

### Fase 0 — UX de descoberta de valuation (✅)
Adicionada seção "Valuation — Como calculamos" em `ScreenStockDetail` antes da `StockAIAnalysisSection`. Contém:
- **6 células de valuation**: Graham VI (√22,5×LPA×VPA), Teto Bazin (DPA÷0,06), Graham c/ Crescimento (LPA×(8,5+2×7)), Margem de Segurança, ROIC, Preço vs. Graham — cada uma com a fórmula em mono e tooltip explicativo.
- **Score breakdown visual**: 5 barras de progresso (Graham/Rentabilidade/Saúde/DY/Valuation) com pts/max e valor real do ativo vs. limiar.
- **CTA Batch Valuation**: botão "Calcule em lote — importe sua planilha" — agora cabeado em `App.tsx:381`.

**Ícones adicionados a Icon.tsx**: `upload`, `tableRows`.

### Fase 0.5 — Bug corrigido (✅)
**Arquivo**: `src/hooks/useAlerts.ts` linhas 42 e 60.

`calculateMarginOfSafety` retorna percentual (ex: 24 para 24%), mas o código multiplicava por 100 de novo → comparava 2400 ≥ 20, alerta disparava sempre.

**Fix**: removido o `× 100` nas duas ocorrências. Agora a comparação é `margin(%) >= alert.value(%)`, que é o comportamento correto.

### Fase 1 — ScreenAnalysis: tela central de análise (✅)
Nova aba "Análise" no BottomNav (substitui a posição de "Atividade" no nav principal — Atividade segue acessível via Profile). Estrutura:
- `src/lib/portfolioScore.ts` — score agregado da carteira
- `src/components/praxia/PortfolioScoreHero.tsx` — hero com score e variação do dia
- `src/components/praxia/PortfolioInsightsContent.tsx` — extraído do `PortfolioInsightsModal` para uso embutido na tela
- `src/components/praxia/screens/ScreenAnalysis.tsx` — tela com hero, mini-métricas (retorno YTD, nº ativos, setor líder), insights IA, movimentos do dia, melhores scores, alocação setorial
- `App.tsx` — `Screen` union recebe `"analysis"`, `BottomNav` mostra a aba

### Fase 3 — Feature #1: Calendário de Dividendos + Otimização IA (✅)
Endpoint, hook e tela já existiam (~95% prontos). Fechamento desta sessão:
- `api/dividends.ts`: hardening — regex de ticker (B3/US) + `checkRateLimit` (30 req/min).
- `src/lib/ai.ts`: nova função `otimizarDividendosComIA(stocks, annual, profile, candidates)` que calcula DY ponderado real e DY/scoreAvg em código, filtra candidatos por qualidade (DY > média e score ≥ média−10), e envia ao LLM com lista fechada (não inventa tickers).
- `src/lib/aiDividends.ts` (pré-existente): usado como motor do modal — função `otimizarDividendos(stocks, buckets, profile)` retorna `{resumo, sugestoes:[{ticker,acao,tese,impactoEstimado,fontes}], fontes}`.
- `src/components/praxia/OptimizeDividendsModal.tsx`: modal sibling de `AppShell` com hero do total anual, resumo IA e cards por sugestão (Manter/Aumentar/Reduzir/Adicionar + tese + impacto + fontes).
- `src/hooks/useDividendCalendar.ts`: agora expõe `rawHistoryByTicker` (eventos brutos do Yahoo) para reuso na Fase 6.
- Integração: botão "Otimizar renda passiva com IA" em `ScreenDividends`; modal montado como sibling em `App.tsx`.

### Fase 6 — Feature #9: Digest Semanal IA (✅)
Card no topo do `ScreenHome` que sintetiza a semana ANTERIOR usando APENAS dados reais. Geração sob demanda (custo de IA), cache por ISO-week (8 dias).
- `src/lib/isoWeek.ts`: utilitários ISO-8601 puros (`getISOWeekString`, `getWeekStart/End`, `isInWeek`, `formatWeekLabelPtBR`).
- `src/lib/digest.ts`: agregador puro `assembleDigestContext` que combina histórico Yahoo de dividendos PAGOS na semana, transações registradas, alertas com `triggeredAt` na janela, notícias materiais do cache de `useStockNews` e snapshot do portfólio. Variação % só quando há snapshot real do início da semana (sem fake).
- `src/lib/aiDigest.ts`: `gerarDigestSemanal(context, profile)` — prompt veta alucinação ("se um campo está vazio, omita a frase; use APENAS o JSON fornecido"). JSON: `{resumo, destaque, eventosNotaveis[], proximasAcoes[{acao,motivo,screenAlvo}], fontes}`.
- `src/hooks/useWeeklyDigest.ts`: cache `praxia-digest:{ISO-WEEK}` TTL 8d. Recebe inputs (não chama hooks globais — evita duplicar polling/fetches).
- `src/components/praxia/WeeklyDigestCard.tsx`: estados empty/loading/pronto/erro; hero com `destaque`, lista de eventos com barras douradas, grid de próximas ações com navegação via callback.
- Integração: `App.tsx` lift de `useDividendCalendar`; `ScreenHome` recebe `transactions`, `triggeredAlerts`, `dividendHistoryByTicker`, `onNavigate`; card renderiza entre `DisclaimerBar` e `AIInsightCard`. Card só aparece se carteira ≥1 stock com posição.

### Fase 7 — Feature #10: Histórico de Fundamentos (✅)
Seção "Tendência de fundamentos" em `ScreenStockDetail` com mini-charts dos últimos trimestres REAIS do Yahoo.
- `api/fundamentals-history.ts`: novo endpoint serverless. Chama Yahoo `quoteSummary` v10 com módulos `incomeStatementHistoryQuarterly + balanceSheetHistoryQuarterly + defaultKeyStatistics + summaryDetail + price`. Calcula ROE (netIncome × 4 / equity), margem líquida (netIncome / revenue), e dívida/EBITDA TTM (rolling 4Q). DY/P/L injetados apenas no último trimestre (Yahoo só publica leitura atual). Hardening: regex ticker + rate-limit 30/min + log restrito.
- `src/lib/fundamentalsHistory.ts`: cliente + fallback `deriveQuartersFromRelatorios` que usa relatórios do BrAPI já cacheados para preencher margem quando Yahoo falha. `mergeQuarters` prevalece Yahoo nos campos auditados.
- `src/hooks/useFundamentalsHistory.ts`: cache `praxia-fundamentals-history:{TICKER}` TTL 7d. Lazy via prop `enabled`.
- `src/components/praxia/StockFundamentalsTrend.tsx`: grid 2×2 (ROE, Margem Líq., Dív/EBITDA, DY) com `Sparkline` real + `DeltaPill` YoY + tap para expandir em `AreaChart` full-width com seletor 1Y/3Y/5Y. Lazy mount via `IntersectionObserver`. Estado parcial mostra "—" + tooltip.
- Integração: inserido em `ScreenStockDetail` entre `StockAIAnalysisSection` e `StockNewsSection`.

**Endpoints novos**: `GET /api/fundamentals-history?ticker=X` (proxy Yahoo quoteSummary + computação trimestral).
**Novas chaves de cache**: `praxia-digest:{ISO-WEEK}` (TTL 8d), `praxia-fundamentals-history:{TICKER}` (TTL 7d), `praxia-dividend-optimize:{SIGNATURE}` (TTL 6h).

### Fase 2 — Feature #6: Notícias por ação + sentimento (✅)
Manchetes do ticker classificadas pela Pra (sentimento positivo/neutro/negativo + sinalização "material" + 1 frase de impacto), com cache 1h por ticker.
- `src/lib/stockNews.ts` — `analisarNoticiasAcao(ticker, profile)`, `getCachedStockNews(ticker)`, `clearStockNewsCache()`
- `src/hooks/useStockNews.ts` — hook com `load` (lazy on-demand), `refresh` (ignora cache), `fromCache`
- `src/components/praxia/StockNewsSection.tsx` — seção visual com pill de sentimento por item, badge MATERIAL, impacto colorido e fontes
- `src/components/praxia/MaterialEventBanner.tsx` — banner no topo do `ScreenHome` que aparece SÓ se houver cache fresco (< 24h) com item material em algum ticker da carteira; tap abre o stock detail
- Integração em `ScreenStockDetail.tsx` (entre `StockAIAnalysisSection` e `StockReportsSection`) e `ScreenHome.tsx` (após `MacroQuotesStrip`)

**Endpoints reutilizados**: `/api/news?ticker=X` (já existia), `/api/ai` (já existia).
**Nova chave de cache**: `praxia-stock-news:{TICKER}` (TTL 1h).

### Extra (fora do roadmap) — Hardening de API + Telemetry + Refactors

Mudanças transversais introduzidas em paralelo às fases acima:

- **`api/_llm.ts`**: helper centralizado para chamada aos provedores LLM (Groq/OpenAI/Anthropic/Gemini) — `api/ai.ts` agora delega o roteamento e fica focado em validação/cache.
- **Hardening de proxies serverless** (`api/brapi.ts`, `api/fundamentals.ts`, `api/news.ts`, `api/scrape.ts`): `checkRateLimit` (30 req/min por IP, burst 3 em 5s), validação `TICKER_RE`, fallback de sufixo `.SA` consistente, headers Yahoo realistas, falha silenciosa em 5xx/429 (devolve dado vazio com status 200 em vez de quebrar a UI).
- **Telemetry shim** (`src/lib/telemetry.ts` + `src/lib/aiTelemetry.ts`): contadores in-memory em `localStorage` para uso de IA (chamadas por capacidade, hit/miss de cache, tokens estimados) — interface estável pronta para virar Sentry quando a conta for configurada (instruções no header do arquivo).
- **`portfolioInsightsUtils`**: lib pura extraída de `PortfolioInsightsContent`, com test suite — separa cálculo do componente pra ficar testável.
- **`justificativaTemplate`**: template determinístico para a "justificativa" da análise per-stock — antes a IA gastava ~150 tokens reescrevendo Graham/MoS/Score/Label que o app já tem; agora a IA fica só com a camada qualitativa (1-2 frases) e o template cuida do resto.
- **Atualização de dependência**: `@vercel/node ^3.0.0 → ^5.8.7`, remoção da dep não usada `codex`.

### Estado git desta sessão

9 commits criados nesta sessão sobre o `main` (working tree limpo, **nenhum push feito ainda** — `git push origin main` fica a critério):

```
7ba5ac6 feat(fundamentals-history): Feature 10 — historico de fundamentos
eb18012 docs: atualiza SITUACAO_ATUAL e adiciona docs/fase-3-dividend-calendar
ad82564 feat(dividends): Fase 3 — Calendario de Dividendos + otimizador IA
31585aa refactor(ui): extrai portfolioInsightsUtils, wire news/digest nas telas
4d43248 feat(telemetry): contadores in-memory para uso de IA e endpoints
2b29483 feat(digest): digest semanal IA + isoWeek + WeeklyDigestCard
ea5ccce feat(news): noticias por acao + banner home + sentimento via IA
02194ae feat(api): endurece proxies e adiciona _llm + fundamentals-history
af3975d chore: ignora test-results e playwright-report
```

Validação consolidada antes dos commits: `npm run test:run` → **426/426 passam** (51 files), `npm run build` → verde em ~8s, lint dos arquivos novos limpo.

---

## 5. Roadmap — 10 fases de implementação

Aprovado na sessão de 2026-05-28. Documento completo no plano salvo em `~/.claude/plans/abstract-wishing-platypus.md`.

| Fase | O que é | Estimativa | Status |
|---|---|---|---|
| **Fase 0** | UX de Descoberta: seção Valuation + score breakdown + CTA Batch | 1–2 dias | ✅ **Concluída** |
| **Fase 0.5** | Bug: alerta margem Graham ×100 | < 30 min | ✅ **Concluída** |
| **Fase 1** | ScreenAnalysis: tela central de análise do portfólio | 2–3 dias | ✅ **Concluída** |
| **Fase 2** | Feature #6: Notícias + sentimento por ação | 2–3 dias | ✅ **Concluída** |
| **Fase 3** | Feature #1: Calendário de dividendos + otimização IA | 3 dias | ✅ **Concluída** |
| **Fase 4** | Feature #4: Screener com IA (tab Descobrir) | 3 dias | Pendente |
| **Fase 5** | Feature #3: Rebalanceador IA acionável | 3 dias | Pendente |
| **Fase 6** | Feature #9: Digest semanal IA | 2–3 dias | ✅ **Concluída** |
| **Fase 7** | Feature #10: Histórico de fundamentos | 3 dias | ✅ **Concluída** |
| **Fase 8** | Feature #8: Suporte a FIIs | 5–7 dias | ✅ **MVP concluído** (branch `feat/fase-8-fiis` — ver seção 16) |
| **Fase 9** | Feature #7: Calculadora de IR (depende de #8) | 4–5 dias | Pendente |

---

## 6. Próximos passos — opções para a próxima fase

3 fases candidatas pra próxima sessão. Cada uma é independente das outras — escolha guiada pelo objetivo do dia (UX de descoberta vs. ação acionável vs. completude de produto).

### Opção A — Fase 4: Screener com IA (Feature #4) — **recomendada**

**O que entrega**: tab "Descobrir" em `ScreenMarket` com input em linguagem natural ("ações pra dividendos com crescimento") → IA traduz pra filtros JSON (`{minROE, minDY, maxPL, sectors, marketCap}`) → endpoint `/api/screen` filtra universo (IBOV 100) e ranqueia por score ponderado → top-10 como `HoldingRow` clicável.

**Por que primeiro**:
- Caminho de descoberta é o ponto mais fraco da UX hoje (`ScreenMarket` tem só Em Alta/Para Você/Watchlist/B3/NASDAQ — falta o "ajuda a achar").
- Reusa `useStockSearch` que está órfão (item de pendência abaixo).
- Alimenta `ScreenCompare` ("comparar todas as sugestões") sem novas integrações.
- Independente — não bloqueia nada nem é bloqueada.

**Tamanho**: M (3 dias). **Arquivos novos**: `api/screen.ts`, `src/lib/screener.ts`, `src/components/praxia/screens/ScreenMarketScreener.tsx`. **Modifica**: `ScreenMarket.tsx`.

### Opção B — Fase 5: Rebalanceador IA acionável (Feature #3)

**O que entrega**: sliders de alocação-alvo por setor em `ScreenRebalance`; cálculo determinístico das ordens de compra/venda em código; IA refina em linguagem natural ("vender ITUB4 antes do ex-dividendo dia 12 perde R$X"); botão "Executar" → `applyTransaction` (paper-trading).

**Por que considerar**: gera `Transaction`s → alimenta `ScreenActivity` E a futura Fase 9 (IR). Integra com `PortfolioInsightsModal` existente como atalho contextual ("você está overweight em bancos, rebalancear?").

**Cons**: UX de slider em mobile (440px column) precisa de cuidado; complexidade média; novo prompt IA aumenta custo de tokens.

**Tamanho**: M (3 dias). **Arquivos novos**: `src/lib/rebalance.ts`, `src/components/praxia/screens/ScreenRebalance.tsx`. **Modifica**: `lib/ai.ts`, `PortfolioInsightsModal.tsx`, `App.tsx`.

### Opção C — Fase 8: Suporte a FIIs (Feature #8)

**O que entrega**: categoria separada na carteira; detecção automática em `addStock` (ticker `XX11` + `quoteType=ETF` → marca como FII); `Stock.assetType: "stock" | "fii"`; score FII com fórmula própria (DY mensal 40, P/VP 30, vacância 15, segmento 15 — Graham não se aplica); toggle "Ações | FIIs" em `ScreenMarket`; stats específicas em `ScreenStockDetail` (DY anualizado, último rendimento, gestora); `PortfolioInsightsModal` separa análise.

**Por que considerar**: destrava Fase 9 (IR — FIIs têm regra fiscal diferente, rendimentos isentos vs. ganho de capital 20%); enriquece Fase 3 Calendário (FIIs pagam mensal); enriquece Fase 4 Screener (filtro "melhores FIIs de logística").

**Cons**: a mais invasiva — toca `types/stock.ts`, `lib/api.ts` (`mapQuoteToStock`), `calculators.ts` (delega pra `calculateFIIScore`), `ScreenStockDetail.tsx`, `ScreenMarket.tsx`. Dado de vacância/segmento pode precisar de outra fonte além do Yahoo (Funds Explorer) — graceful degradation: "—" e exclui do score parcial.

**Tamanho**: L (5–7 dias). **Arquivos novos**: `src/lib/fiiScore.ts`, `src/components/praxia/FIIDetailStats.tsx`.

### Recomendação

Atacar na ordem **A → B → C → Fase 9 (IR)**. Justificativa:
- A entrega UX visível em 3 dias, baixo risco, e reusa código órfão.
- B fica natural depois porque "descobriu uma ação no Screener" → "vai pra Comparador" → "fica óbvio querer rebalancear pra incluir".
- C é o maior empreendimento e bloqueia Fase 9; melhor deixar pro fim quando o resto do produto está sólido.

Se preferir outra ordem, troque livremente — todas as 3 opções são independentes entre si.

---

## 7. Pendências conhecidas (revisadas pós-commit)

| Item | Tipo | Impacto | Sugestão |
|---|---|---|---|
| `useStockSearch` implementado mas órfão | Faltante | Busca global não funciona | Resolver junto da **Fase 4 (Screener)** — usa a mesma infra |
| ScreenBatchValuation acessível só via Profile | UX | Feature escondida do roadmap original | Adicionar link em `ScreenStockDetail` (CTA já cabeado via `onOpenBatch`) |
| Login placeholder (admin/1234) | Limitação | Sem auth real | Roadmap v0.4 (fora do escopo das 10 fases) |
| Bundle `ScreenBatchValuation` 459 KB (xlsx chunk) | Performance | Maior chunk lazy do app | Lazy import dinâmico do `xlsx` dentro do componente — fácil |
| Cobertura de UI ainda baixa | Qualidade | Testes em hooks/lib estão fortes (~95% nos arquivos novos); telas e modais grandes excluídos por convenção | Considerar Playwright E2E para fluxos críticos (compra → execução → IR) quando Fase 9 começar |
| Modo claro (paper) disponível nos tokens | Feature | Sem toggle UI | Planejado para v0.1 — toggle em `ScreenProfile` |
| `aiTelemetry`/`telemetry` apenas console — Sentry não plugado | Observabilidade | Sem visibilidade externa de uso de IA | Quando a conta Sentry existir: 1 commit (instruções no header do `telemetry.ts`) |
| `memory/` apareceu durante a sessão como artefato local | Higiene | Provavelmente dump de agente paralelo | Já existe e está no working tree limpo agora; checar manualmente se precisa entrar no `.gitignore` no futuro |

---

## 8. Arquivos críticos de referência rápida

| O que procurar | Onde |
|---|---|
| Screen routing | `src/App.tsx:59` (type Screen) |
| Tokens / paleta / fontes | `src/components/praxia/tokens.ts` |
| Score 0–100 | `src/lib/calculators.ts:calculateStockScore` |
| Fórmulas Graham/Bazin/Margem | `src/lib/calculators.ts` |
| System prompt mestre da Pra | `src/lib/praxiaPrompt.ts` |
| Multi-provider IA | `api/ai.ts` |
| Proxy Yahoo Finance | `api/brapi.ts` |
| Macro BCB SGS | `api/macro.ts` |
| Notícias RSS | `api/news.ts` |
| Notícias globais (GDELT + Reddit + BBC) | `api/world-news.ts` |
| Tipos canônicos | `src/types/stock.ts` |
| Todos os hooks | `src/hooks/` |
| Debug e troubleshooting | `DEBUG.md` → `docs/` |
| Roadmap completo | `ROADMAP.md` |
| Plano de execução | `~/.claude/plans/abstract-wishing-platypus.md` |

---

## 9. Regras inegociáveis de implementação

1. **IA sempre via `/api/ai`** — nunca expor API key no cliente
2. **Cache em localStorage** com TTL + invalidação por signature
3. **Modais sempre como siblings de `AppShell`** em `App.tsx` — nunca dentro de scroll containers
4. **Sem novas deps npm** salvo necessidade absoluta
5. **`import type`** para todos os tipos (`verbatimModuleSyntax: true`)
6. **`npm run build` deve passar** após cada fase — baseline: 0 erros novos
7. **Features com IA**: texto começa "Pelo seu perfil…" + citações `[N]`
8. **Qualquer feature com `Transaction`**: log alimenta ScreenActivity
9. **Provider padrão: Groq + frugalidade de tokens** — Praxia roda em free tier. Antes de subir `max_tokens`, mexer em prompt ou criar nova capacidade IA, pensar em custo: prompt compacto, `response_format` estrito, cache TTL+signature como primeira defesa, nunca empurrar payload bruto pra LLM (envia ID + métricas, não JSON inteiro). Adicionado em 2026-05-29.

---

## 10. Sessão 2026-05-29 — Otimização IA + MVP Fase 1 (auth + Supabase + LGPD)

### 10.1 Otimização IA "funcionar melhor fazendo menos" (Fases A–F do plano `shiny-weaving-engelbart.md`)

Reduzir tokens/chamadas LLM ~30–45% sem perda de qualidade. Tudo entregue:

| Fase | O que entrou |
|---|---|
| **A** | `max_tokens` 2048→1200 em `ai.ts`; chat 1400→900 em `usePraChat`. `SOURCE_AND_PROFILE_RULES` (24 linhas) → `RULES_REMINDER` (1 linha). Few-shots: 1 detalhado (GUERRA+PETR4) + 2 enxutos (SELIC, M&A). **NOVO** `src/lib/transmissionChains.ts` (chains 5-8 injetadas sob demanda via keyword). |
| **D + C.4** | **NOVO** `src/lib/justificativaTemplate.ts` (Graham/Score/MoS deterministicamente; IA só complemento qualitativo). `portfolioInsightsUtils.computePortfolioSentiment` (heurística por média de score). `aiNewsFeed.classifyCategoriaByTitle` (classifier por keyword omite campo do schema da IA quando bate). `CHAT_OUTPUT_SUFFIX` pede thinking com 3 bullets max. |
| **B** | Signature em `stocks-ai-analysis:{TICKER}` virou `{TICKER}|s{score}|r{roe5pp}|d{debt0.5}|p{price1dec}`. `compararAcoesComIA` ganhou cache 2h. djb2 → djb2+FNV-1a (64 bits). |
| **C** | `usePraChat`: `MAX_HISTORY=30` + truncamento FIFO. `buildChatWindow` com sliding window: >10 turns vira resumo heurístico (tickers + 4 substantivos) + últimas 6 mensagens. `chatContextMemo` memoizado por hash. `useUIPreferences.aiVerbosity`. |
| **F** | **NOVO** `src/lib/aiTelemetry.ts`: `recordCall`, `recordHit`, `getStats`, `clearStats`, `clearCacheByKind`, `checkRateLimit` (8 req/60s). Cabeado em `ai.ts:callAIServerless`, `usePraChat`, `aiNews.ts`, `aiNewsFeed.ts`, `StockAIAnalysisSection`, `PortfolioInsightsContent`. Card "Uso de IA" em `ScreenProfile` com 3 stat boxes + 4 botões de cache clear granular. |
| **E** | `CHAT_OUTPUT_SUFFIX` condensa instruções de reasoning + ignora `<examples>` JSON em modo chat. **NOVO** `buildContextReceivedTag(blocks)` helper opcional, cabeado em `aiNewsFeed.ts`. |

### 10.2 MVP Fase 1 — Auth real + persistência server-side + LGPD/CVM

Tudo entregue. Stack: **Supabase** (auth magic-link + Postgres com RLS) + **Mercado Pago** previsto pra 1.6.

| Sub | O que entrou |
|---|---|
| **1.1** | `@supabase/supabase-js` instalado (precisa `NODE_OPTIONS=--use-system-ca` por Kaspersky MITM). **NOVOS** `src/lib/supabase.ts` (client singleton), `src/lib/supabaseSchema.ts` (tipos das 4 tabelas), `supabase/migrations/001_initial.sql` (`profiles`, `portfolio_stocks`, `transactions`, `preferences` + RLS + triggers + auto-criação no signup), `.env.example`. |
| **1.2** | **NOVO** `src/hooks/useAuth.ts` (`{user,session,loading,isAuthenticated,signInWithMagicLink,signOut}` + onAuthStateChange). `LoginScreen.tsx` reescrito (email único + magic link, 2 steps `input`→`sent`, mantém visual editorial). `App.tsx` plugado com loading state. Username vem do email. |
| **1.3** | **NOVO** `src/lib/supabaseSync.ts` (helpers genéricos por tabela). `useStockQuotes` sync on login + write-through em add/sell/remove + migração one-time localStorage→Postgres. |
| **1.4** | Mesmo padrão em `useInvestorProfile`, `useTransactions`, `useUIPreferences`. `useTransactions.makeId` agora UUID v4 (schema Supabase é uuid). |
| **1.5** | `api/delete-account.ts` (CORS + rate-limit + Bearer JWT + cascade delete 4 tabelas + `admin.deleteUser` + 207 partial). `ScreenLegalDoc.tsx` (privacy/terms). `ScreenDeleteAccount.tsx` (LGPD Art. 18). `CookieConsentBanner.tsx`. `App.tsx` roteia `privacy/terms/delete-account`. **Atualizei `lib/legal.ts`** pra refletir Supabase como processador (LGPD §1, §2, §4, §6). `CVM_DISCLAIMER` cita Resolução CVM 14. |

### 10.3 Decisões técnicas dignas de memória

- **Generic `<Database>` do supabase-js v2.106+** exige shape `__InternalSupabase` que só `supabase gen types` produz. MVP usa client sem generic, tipos locais aplicados nos helpers de `supabaseSync.ts`. Sem perda de safety nas chamadas externas.
- **`tsconfig.app.json`**: `"ignoreDeprecations"` aceita até `"5.0"` em TS 5.9 (não `"6.0"`).
- **`useStockQuotes` mutação em closure** dentro de `setStocks((prev) => ...)`: refatorada pra calcular fora do callback — TS não conseguia narrow.

### 10.4 Pendentes pro MVP viável (próxima sessão)

| # | Item | Esforço | Pré-requisito |
|---|---|---|---|
| **1.6** | **Billing Mercado Pago Subscriptions** — Edge Function pra criar subscription, webhook de status (`payment.created`/`payment.approved`/`payment.cancelled`), tabela `plan` em `profiles` já existe, paywall em features Pro. | 2-3 dias | Conta MP empresarial/MEI ativa (3 dias úteis pra abrir) |
| **1.7** | **Landing 1 página** — HTML estático em `landing/` (sem dep nova) com Hero + 3 features + pricing Free/Pro + CTA. Deployável separado do app. | 1 sessão | Domínio registrado |
| **c** | **Polir Fase 1 (ScreenAnalysis)** — já existe em `src/components/praxia/screens/ScreenAnalysis.tsx` (PortfolioScoreHero + mini metrics + insights autoLoad + movers + best scores + alocação). Falta: tooltips das métricas, CTAs concretos pós-análise, refinar copy. | 1 sessão | nenhum |
| **–** | **Sentry** — front + backend, telemetria de erro. Free tier basta. | 4-6h | conta Sentry |
| **–** | **Termos de uso revisão jurídica** | externo | advogado |

### 10.5 Como retomar

1. Ler `~/.claude/plans/shiny-weaving-engelbart.md` (plano IA — entregue).
2. Ler esta seção 10 + seção 8 (arquivos críticos).
3. Confirmar estado das envs locais (`.env.local` deve ter `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`).
4. `npm run dev` — testar magic link de ponta a ponta antes de seguir.
5. Próxima decisão: **1.6 (billing)** ou **polir Fase 1 (ScreenAnalysis) + 1.7 (landing)**.

### 10.6 Build status final desta sessão

- `npx tsc --noEmit --project tsconfig.app.json`: ✅ 0 erros
- `npm run build`: ✅ ~17–25s
- Warning de chunk index >500KB (569KB) — supabase-js adicionou ~50KB. Otimização (manualChunks) é polish, não bloqueia MVP.

---

## 11. Sessão 2026-05-29 (tarde) — OpenRouter default + Billing 1.6 implementado

### 11.1 Migração de provider IA: Groq → OpenRouter (default)

`api/_llm.ts` ganhou o provider `openrouter` (OpenAI-compatible, `https://openrouter.ai/api/v1`).
`defaultProvider()` agora resolve `AI_PROVIDER` → **`openrouter`**. Modelo via `OPENROUTER_MODEL`
(default `meta-llama/llama-3.3-70b-instruct:free`). `AIProvider` (types) e `.env.example` atualizados.
Fix no `.env` local: a chave estava em `GROQ_API_KEY` mas era OpenRouter (`sk-or-v1-…`) → renomeada
para `OPENROUTER_API_KEY` (sem isso a IA caía em 503). Testes: novo caso em `api/ai.test.ts`.

### 11.2 Billing 1.6 — Mercado Pago Subscriptions (implementado, **dormente por flag**)

Seguiu o `BILLING_PLAN.md` + spec aprovado (`docs/superpowers/specs/2026-05-29-deploy-e-billing-design.md`).
Gate controlado por `BILLING_ENABLED` (server) / `VITE_BILLING_ENABLED` (client). **Default off** =
app grátis e ilimitado; nenhum paywall aparece. Modelo: Pro R$ 29/mês, free = 10 chamadas IA/mês.

**Novos arquivos:**
- `src/lib/billing.ts` (puro: `PRO_PRICE_BRL`, `FREE_MONTHLY_LIMIT`, `PAYWALLED_FEATURES`, `hasProAccess`, `currentMonthKey`, `featureLabels`) + teste.
- `src/lib/supabaseBilling.ts` (`fetchSubscriptionFromServer`, `fetchUsageThisMonth`).
- `src/lib/aiAuth.ts` (token a nível de módulo via `setAIAccessToken`; `aiAuthHeaders`; `PaywallRequiredError`; `throwIfPaywalled`; handler global `setPaywallHandler`) + teste.
- `src/lib/checkoutClient.ts` (`startProCheckout` → `/api/checkout` → redirect `init_point`).
- `src/hooks/useSubscription.ts` (`{plan, subscription, usageThisMonth, isPro, refresh}`, hidrata ao login).
- `api/_mercadopago.ts` (`mpFetch`, `verifyWebhookSignature` HMAC-SHA256, `mpStatusToSubscriptionStatus`) + teste.
- `api/_usageGuard.ts` (`assertCanUseAI` + `trackUsage`; flag off → bypass) + teste.
- `api/checkout.ts` (cria Preapproval, salva subscription pending, devolve init_point).
- `api/mp-webhook.ts` (valida assinatura, re-busca preapproval, atualiza `subscriptions` + espelha `profiles.plan`, idempotente).
- `src/components/praxia/PaywallModal.tsx` (sibling de AppShell, dispara no 402).
- `src/components/praxia/screens/ScreenBilling.tsx` (gerenciar plano, via Profile quando billing ligado).

**Modificados:** `api/ai.ts` (gate antes do LLM + `trackUsage` após sucesso); as 6 libs que chamam
`/api/ai` (`ai.ts`, `aiDividends.ts`, `aiDigest.ts`, `stockNews.ts`, `aiNews.ts`, `aiNewsFeed.ts`) →
enviam `Authorization` + `feature` e tratam 402; `src/App.tsx` (lift `useSubscription`, registra
`setAIAccessToken`/`setPaywallHandler`, rota `billing`, `PaywallModal` sibling); `ScreenProfile.tsx`
(card "Plano" + botão, só com billing ligado); `.env.example`.

**Validação:** `tsc -b` ✅, `npm run test:run` → **612/612** (67 files), `npm run build` ✅ ~4,5s, lint dos novos = limpo.

### 11.3 Pendências / cuidados do billing (antes de ligar `BILLING_ENABLED=true`)

- ⚠️ **Credenciais MP são de PRODUÇÃO** (`APP_USR-…` no `.env`), não TEST. Cobra de verdade no
  primeiro teste — usar usuário de teste do painel MP ou credenciais `TEST-…` antes de ativar.
- Rodar `002_billing.sql` no Supabase Dashboard antes de ligar.
- Registrar webhook `…/api/mp-webhook` no painel MP + gerar/salvar `MERCADO_PAGO_WEBHOOK_SECRET`.
- **View `current_month_usage`** (migration 002): **CORRIGIDO na seção 13** — recriada com
  `security_invoker = on` (cada usuário só lê o próprio uso; RLS de `usage_log` passa a ser respeitada).
  Era um vazamento cross-tenant de contadores de uso. Comentário enganoso removido.
- `api/fundamentals-history.ts` não passa pelo gate (não é LLM) embora `"fundamentals-history"` exista
  em `PAYWALLED_FEATURES` — só os endpoints `/api/ai` são gateados. Decisão consciente (dado, não IA).

---

## 12. Sessão 2026-05-29 — Auth por email + senha (substitui magic-link como principal)

Spec aprovado: `docs/superpowers/specs/2026-05-29-login-email-senha-design.md`. Implementado via TDD.

### 12.1 O que entrou

Login/cadastro por **email + senha**, sem confirmação de email no cadastro. Magic-link mantido
como alternativa e **reset de senha por email** adicionado. Senha mínima de 8 caracteres.

| Arquivo | Mudança |
|---|---|
| `src/hooks/useAuth.ts` | **Novas ações** `signInWithPassword`, `signUpWithPassword` (retorna `{ok:true, needsConfirmation:true}` se a sessão vier nula — confirmação ainda ligada no painel), `resetPassword` (`resetPasswordForEmail` + `redirectTo: origin`), `updatePassword` (`updateUser`). **Novo estado** `passwordRecovery`, ligado no evento `PASSWORD_RECOVERY` e resetado após `updatePassword`. Magic-link e `signOut` preservados. Helper `normalizeEmail` (trim+lowercase) e guard `isSupabaseConfigured` em todas as ações. |
| `src/components/LoginScreen.tsx` | Reescrito no mesmo visual editorial. Toggle **Entrar / Criar conta** (`mode`), campos email + senha (botão ver/ocultar), validação client (email regex + senha ≥ 8), link "Esqueci minha senha", botão "Entrar com link mágico". Steps: `input | sent | reset-sent | recovery`. Prop `recoveryMode` abre direto no step de nova senha. Prop morta `onLogin` removida. |
| `src/App.tsx` | `useAuth` expõe `passwordRecovery`; quando true, renderiza `<LoginScreen recoveryMode />` antes do bloco `if (user)` (a sessão de recuperação já autentica). |
| `src/lib/supabase.ts` | Só comentário de cabeçalho (config `pkce`/`detectSessionInUrl` inalterada — magic-link e link de reset dependem dela). |
| `src/hooks/useAuth.test.ts` | **NOVO** — 9 testes mockando `@/lib/supabase` via `vi.hoisted` (signin/signup ok+erro, `needsConfirmation`, reset, recovery, evento `PASSWORD_RECOVERY`, guard sem config). |

### 12.2 Passos manuais no painel Supabase (pré-requisito pra testar/ligar)

1. **Authentication → Providers → Email → "Confirm email" = OFF** (login direto sem confirmar email).
2. **Authentication → Settings → Minimum password length = 8** (alinha com a validação do client).

### 12.3 Validação

`npx tsc -b` ✅ 0 erros · `npm run test:run` → **621/621** (68 files; era 612) · `npm run build` ✅ ~4,4s
(index 608 KB, warning de chunk >500KB pré-existente) · lint dos arquivos tocados limpo. Os 2 avisos
`react-hooks/set-state-in-effect` remanescentes (`useAuth.ts:45`, `App.tsx:643`) são código
pré-existente (guard de config e `setBootStep`), não introduzidos nesta feature.

### 12.4 Mensagens humanizadas + tutoriais por feature

Após a auth base, duas melhorias de UX (também via TDD):

- **Erros de auth em PT-BR** — `src/lib/authErrors.ts` (`humanizeAuthError`) mapeia as mensagens
  técnicas do Supabase ("Invalid login credentials", "User already registered", rate limit, rede…)
  para texto claro na voz do app; mensagens desconhecidas são repassadas. Cabeado no `LoginScreen`
  em todos os pontos que mostram erro. Teste: `src/lib/authErrors.test.ts` (9 casos).
- **Banners de tutorial por tela** — `src/lib/tutorialHints.ts` (registro `TUTORIAL_HINTS` +
  `isHintDismissed`/`dismissHint`/`resetTutorialHints`, persistido em `praxia-tutorial-hints`) e
  `src/components/praxia/FeatureHintBanner.tsx` (banner dismissível "Como usar · …" com botão
  Entendi/fechar; some 1 vez e não volta). Inserido no topo de 9 telas: Home, Mercado, Análise,
  Detalhe da ação, Dividendos, Rebalanceador, Notícias, Comparar, Alertas. Teste:
  `src/lib/tutorialHints.test.ts` (6 casos). **Nova chave de cache:** `praxia-tutorial-hints`.

**Validação 12.4:** `tsc -b` ✅ · `npm run test:run` → **648/648** (71 files) ✅ · `npm run build` ✅ ·
lint dos arquivos novos + 9 telas limpo.

---

## 13. Sessão 2026-05-29 (fim) — Validação consolidada + push GitHub + UX de simulação

> Contexto: esta passagem rodou em paralelo a um agente que expandiu o escopo bem além de "billing"
> (cache IA, semantic cache, auth email+senha, tutorial hints, mexidas em telas e no core). O trabalho
> foi **validado em conjunto e empurrado pro GitHub** a pedido. Histórico ficou misturado por frente —
> reorganizar em PRs separados é opcional e pode ser feito agora que está salvo no remoto.

### 13.1 UX — fluxo de ordem explícito como SIMULAÇÃO (paper trading) — commit `d7da7aa`
O Praxia é ferramenta de **análise**, não corretora; o fluxo de compra/venda dava a entender compra
real (clareza + risco CVM). Mudanças:
- `ScreenOrder` / `ScreenOrderReview`: header "Simular compra/venda", **banner amarelo "SIMULAÇÃO"**
  ("operação fictícia para treino — sem dinheiro real nem corretora, só atualiza a carteira no app"),
  botões "Revisar simulação" / "Confirmar simulação", subtítulos explícitos.
- `ScreenStockDetail` + `QuickWatch`: botões de entrada → "Simular compra" / "Simular venda".
- Os rótulos COMPRAR/SEGURAR/VENDER das análises **ficaram intactos** (é o veredito da análise — função do app).

### 13.2 Correção do RLS (ver 11.3)
`002_billing.sql`: view `current_month_usage` recriada com `security_invoker = on`; comentário enganoso
("herda RLS por padrão") corrigido.

### 13.3 Validação consolidada de toda a árvore
- `npm run build` ✅ (index ~613 KB; warning de chunk >500KB pré-existente).
- `npm run test:run` → **655/655** (72 files) ✅.
- `npm run coverage` → global **72,07% linhas / 72,07% stmts / 88,57% funcs / 75,44% branches** (≥ 70%).
- `npm run lint` → **baseline pré-existente** (13 erros `any` antigos + warnings `unused eslint-disable`
  auto-fixáveis; sem regressão introduzida).

**Lacunas de cobertura conhecidas (0% — testar quando a árvore estabilizar):** `useSubscription`,
`checkoutClient`, `supabaseBilling` (billing client), `rebalance.ts` (Fase 5), `screener.ts` (~18%),
`useWeeklyDigest`.

### 13.4 Commit + push pro GitHub
- Consolidado no commit **`db68467`** (53 arquivos): billing dormente + cache IA (`_aicache` durable +
  `_semanticCache`, migrations 003/004 + `supabase/functions`) + migração OpenRouter + auth email+senha
  + tutorial hints + UX de simulação + fix de RLS.
- **Push:** branch **`feat/billing-dormante`** → `origin` (github.com/buga2023/AnalisedeprecodeAcoes).
  PR: https://github.com/buga2023/AnalisedeprecodeAcoes/pull/new/feat/billing-dormante
- **NÃO mergeado na `main`** — fica a critério abrir o PR. Branch trackeia `origin/feat/billing-dormante`.

### 13.5 Pendente pra LIGAR a cobrança (recap dos bloqueadores externos)
1. **Credenciais MP de TEST** antes de `BILLING_ENABLED=true` — as atuais são de produção (cobram de verdade).
2. Rodar migrations **002 (com fix RLS) + 003 + 004** no Supabase Dashboard.
3. Registrar webhook `…/api/mp-webhook` no painel MP + salvar `MERCADO_PAGO_WEBHOOK_SECRET`.

---

## 14. Sessão 2026-05-29 — Balanceamento de IA em 2 níveis (economia de cota free)

Objetivo: distribuir as chamadas LLM pra preservar a cota free (cada provedor/modelo
tem cota separada). Implementado em dois níveis:

### 14.1 Rodízio dos 3 modelos free do OpenRouter (`api/_llm.ts`)
`resolveOpenRouterModels()` antes fixava DeepSeek V4 Flash como primário (os outros 2
só entravam em fallback). Agora o **primário gira por requisição** (round-robin via
`orModelCursor`): req N começa pelo modelo `N % 3` (DeepSeek → Qwen3-80B → GPT-OSS-120B),
os outros 2 seguem como fallback automático do OpenRouter em 429/503. Não fragmenta o
cache (chave em `ai.ts` é `provider:"balanced"` + messages, não inclui o modelo).

### 14.2 Balanceamento de provedores Groq + Gemini + OpenRouter (já existia)
`balancedChain()` (`_llm.ts:69`) já fazia round-robin entre os providers do `BALANCE_POOL`
**que têm chave** — comportamento intacto e testado (`ai.test.ts:129`, exige início
determinístico em `groq`, por isso o cursor NÃO foi semeado com tempo). Como só o
OpenRouter tinha chave, não havia o que balancear. Para ativar de verdade falta só colar
as 2 chaves free no `.env`:
- `GROQ_API_KEY=` → console.groq.com/keys (`gsk_...`)
- `GEMINI_API_KEY=` → aistudio.google.com/apikey (`AIza...`)

Linhas deixadas **vazias** no `.env` (vazio = `getProviderApiKey` retorna null → balanceador
ignora → nada quebra até colar). Assim que houver chave válida, o provedor entra no rodízio.

### 14.3 Cuidado conhecido
Cursores (`rrCursor`, `orModelCursor`) são por instância serverless: giram certo em
instância quente; cold start reinicia no item 0. Irrelevante pro tráfego do Praxia e
exigido pelo teste determinístico. Se um dia precisar de balanceamento robusto a cold
start, seria preciso estado persistido (e ajustar o teste).

### 14.4 Validação
`npm run test:run` → **657/657** (72 files; +1 teste novo cobrindo o rodízio de modelos
do OpenRouter em `ai.test.ts`). `npm run build` ✅ ~13,5s (warning de chunk >500KB
pré-existente). Lint dos arquivos tocados (`_llm.ts`, `ai.test.ts`) limpo.

> ⚠️ **Branch:** a seção 14 + a 15 foram commitadas em **`feat/fase-8-fiis`** (não em
> `feat/billing-dormante`), porque esse era o HEAD ativo. Como `fase-8-fiis` = `billing-dormante`
> + Fase 8, o trabalho chega no `billing-dormante` quando o fase-8 mergear. Optou-se por
> NÃO mover o commit: a Fase 8 (FIIs) estava sendo escrita **em paralelo no mesmo branch**,
> e cirurgia de branch (checkout/reset) com outro agente mutando o working tree é insegura.

---

## 15. Sessão 2026-05-30 — Limpezas (RLS, lint baseline, chunk de build)

Três correções pequenas e cirúrgicas, cada uma em commit próprio no `feat/fase-8-fiis`.
Contexto: rodaram em paralelo à implementação da Fase 8 (FIIs) e a um hardening de
segurança (worktree `.claude/worktrees/hardening`) — por isso o escopo foi deliberadamente
restrito a arquivos fora do território desses agentes, pra evitar colisão/merge conflict.

### 15.1 Fix de segurança — `increment_usage` (commit `6f6ac81`)
`supabase/migrations/002_billing.sql`: removido `grant execute ... to authenticated` da
função `increment_usage(uuid, text)`. Como ela é `security definer` e recebe `p_user_id`
arbitrário, expô-la via PostgREST RPC permitia um usuário logado incrementar o contador de
uso de OUTRO (cross-tenant write, empurrando a vítima além do limite free). O servidor chama
via `service_role` (ignora grants), então a função fica restrita a ele. **Complementa** o fix
de RLS da view `current_month_usage` (seção 13.2) — fecha o outro vetor da mesma migração.

### 15.2 Redução do lint baseline (commit `0486ff2`)
Subconjunto seguro (type-only/comentário, **zero runtime**), −3 erros e −16 warnings:
- `eslint.config.js`: ignora `coverage/` (arquivos gerados pelo istanbul disparavam warnings).
- `src/lib/sheetParser.ts`: `as any[][]` → `as unknown[][]` (uso já narrowa via `typeof`/`String`).
- `src/hooks/useStockSearch.ts`: estado tipado com `StockSearchResult`; `catch {}` sem binding ocioso.
- `supabaseSync.ts` / `supabase.ts` / `ScreenProfile.tsx`: `eslint-disable no-console` órfãos (`--fix`).

**Deixado de fora de propósito:** `any` em `api/brapi.ts`/`api/market.ts` (território do hardening)
e `src/lib/api.ts`/`fiiScore.ts` (território da Fase 8, c/ `@ts-nocheck`); `setState`-em-effect
(`App.tsx`/`useAuth.ts`), `Date.now` no render (`WeeklyDigestCard`), refactor de exports
(`Citations.tsx`), dep de `useMarketQuotes` — pré-existentes e/ou mudança de comportamento.
⚠️ O `npm run lint` global ainda acusa ~39 problemas, mas o aumento vem do `fiiScore.ts` (WIP da
Fase 8), não destas mudanças. Passada final de lint quando a Fase 8 estabilizar.

### 15.3 Chunk de build >500KB (commit `81f62ef`)
`vite.config.ts`: `build.rollupOptions.output.manualChunks` separa `react-vendor` e `supabase`
em chunks próprios. `index` caiu de **613 KB → 394 KB** (abaixo do limite), `supabase` (207 KB)
isolado → melhor cache. Total de bytes igual, só reparticionado. Mata o warning de chunk.

### 15.4 Validação
`tsc -b` ✅ · `npm run build` ✅ ~16s, **sem warning de chunk** · lint limpo nos arquivos
tocados. Suíte completa não re-rodada nesta passada (incluiria o `fiiScore.test.ts` WIP da Fase 8);
as mudanças do 15.2/15.3 são type-only/config, cobertas por `tsc -b` + build verde.

---

## 16. Sessão 2026-05-30 — Fase 8 (MVP): Suporte a FIIs

Spec: `docs/superpowers/specs/2026-05-29-fase-8-fiis-mvp-design.md`. Plano:
`docs/superpowers/plans/2026-05-29-fase-8-fiis-mvp.md`. Implementado via subagent-driven
(TDD por task) no branch `feat/fase-8-fiis`. **MVP enxuto** — alocação separada Ações/FIIs,
calendário mensal e stats de gestora/cotistas ficam pra fase posterior.

### 16.1 O que entrou

| Camada | Mudança |
|---|---|
| **Tipos** | `Stock.assetType?: "stock" \| "fii"` + `Stock.vacancyRate?: number` (opcionais, retrocompatíveis). |
| **Detecção** | `src/lib/stockMeta.ts`: `detectAssetType(ticker, name)` — FII só se `^[A-Z]{4}11$` **E** nome casa `/F\.?I\.?I\|IMOB\|FDO\.?\s*INV\|IMOBILI/i` (desempata FII vs. units tipo SANB11/TAEE11). `detectFIISegment(ticker)` via mapa estático `FII_SEGMENTS`. |
| **Score FII** | **NOVO** `src/lib/fiiScore.ts`: `calculateFIIScore` — DY 40 · P/VP 30 · Vacância 15 · Segmento 15; **renormaliza** sobre dims com dado (omite vacância/DY/P-VP ausentes). Reusa `ScoreBreakdown`. |
| **DY em cascata** | DY do FII (Yahoo summary entregava ~0) resolvido por: **(a)** histórico (`dividendYieldFromHistory` novo em `dividends.ts` = soma 12m ÷ preço) → **(b)** Yahoo `summaryDetail` → **(c)** scraping. |
| **Yahoo summaryDetail** | `api/brapi.ts`: módulo `summaryDetail` adicionado; DY passa a ser lido de lá **como fração** (unidade canônica que UI×100 e `calculateStockScore`>0.06 já esperavam). **Efeito colateral benéfico:** ativa a dimensão DY do score de **ações** (antes morta). |
| **Scraping estruturado** | **NOVO** `api/fii-data.ts` (parser puro `parseFIIFields` → vacância + DY%, degradação 200) + cliente `src/lib/fiiData.ts` (cache `praxia-fii-data:{TICKER}` 7d). |
| **Mapper** | `src/lib/stockMapper.ts`: ramifica score por `assetType` (FII → `calculateFIIScore`, DY×100 fração→%); path de ação **idêntico** ao anterior. |
| **UI** | **NOVO** `FIIDetailStats.tsx` (DY/P-VP/segmento/vacância + 4 barras; vacância lazy via scrape, score recomputa). `ScoreDimBar` extraído pra `src/components/praxia/ScoreDimBar.tsx` (reuso). `ScreenStockDetail`: FII esconde "Valuation — Como calculamos" (Graham não se aplica) e mostra `FIIDetailStats`. `ScreenMarket`: toggle **Ações \| FIIs** + lista `DISCOVERY_FII`. |

**Endpoint novo:** `GET /api/fii-data?ticker=XXXX11` (vacância + DY de scraping).
**Chave de cache nova:** `praxia-fii-data:{TICKER}` (TTL 7d).

### 16.2 Validação
`tsc -b` ✅ 0 erros · `npm run test:run` → **679/679** (75 files; +24 casos: stockMeta, fiiScore,
dividends, stockMapper, fii-data) · `npm run build` ✅ · lint **sem erro novo** (o único introduzido
— escape no regex de segmento — foi corrigido; depois o `segment` do scraping foi removido por ser
caminho morto, conforme code review). Code review final: 0 Critical; ajustes I1 (effect só por
ticker, evita refetch de `/api/dividends` no polling de preço) e I2/I3 (remove `segment` morto)
aplicados.

### 16.3 Pendente / verificação manual
- **Próxima fase de FII:** alocação separada Ações/FIIs na Home/Análise, integração com calendário
  mensal, stats de gestora/nº cotistas; depois Fase 9 (IR — FIIs têm regra fiscal própria).
- Branch `feat/fase-8-fiis` tem histórico **intercalado** com commits de limpeza de outro agente
  (lint/build/RLS/IA) — não mergeado na `main`; abrir PR fica a critério.

### 16.4 Verificação no app (2026-05-30) + correções que ela revelou

Verificado **end-to-end no Edge** (Playwright `channel:'msedge'`; conta de teste descartável
criada/apagada via admin Supabase). Login → Mercado → toggle Ações|FIIs → buscar `HGLG11`
(detectado "FII HGLG PAXCI · Logística") → adicionar → abrir detalhe. Confirmado: detecção,
segmento, **Score FII 91/100**, `FIIDetailStats` (DY 8.5% · P/VP 0.98 · Logística · vacância "—").

A verificação revelou bugs que foram corrigidos nesta sessão:

1. **Yahoo `quoteSummary` 401 "Invalid Crumb"** (`api/_yahooCrumb.ts` novo, wired em `api/brapi.ts`
   e `api/fundamentals-history.ts`). Desde ~2023 o endpoint exige crumb+cookie; sem isso TODO o
   fundamento (bookValue/EPS/ROE/dívida/DY) vinha vazio → score fundamentalista zerado p/ ações E
   P/VP+DY dos FIIs. Helper com cache 30min + retry em 401. **Efeito colateral bom:** ativou a
   dimensão DY do score de ações. Provado ao vivo (PETR4/HGLG11 com dados reais).
2. **Leaks de Graham na tela de FII** — o MVP só escondeu o card "Valuation — Como calculamos";
   faltava esconder, no `ScreenStockDetail`, o card **"Análise calculada"** (mensagem Graham) e o
   **grid de stats de ação** (P/L, ROE, Preço-teto Graham, Margem seg). Agora ambos saem p/ FII
   (`assetType !== "fii"`). `buildJustificativaTemplate` ganhou branch FII (DY/P-VP/segmento, sem
   Graham) + teste.

**Validação:** `tsc -b` ✅ · `npm run test:run` **681/681** (76 files) ✅ · `npm run build` ✅ ·
lint sem erro novo. Commits: `63d038a`, `d4eef41` (crumb), `5ee433c` (justificativa FII),
`fec34b3` (esconde Graham no detalhe).

**Follow-up restante:** o **complemento qualitativo da IA** (`analisarAcaoComIA`) ainda usa prompt
com Graham; pra FII precisa de prompt próprio (custa tokens) — não feito. Na verificação a IA nem
carregou (429/404), então não apareceu; mas quando carregar, pode citar Graham. Item separado.

---

## 17. Sessão 2026-05-30 — Prontidão de beta gratuito: LGPD + Observabilidade

Plano: `~/.claude/plans/zazzy-waddling-lynx.md`. Objetivo: destravar um **beta gratuito** (billing
DORMENTE, intacto). Decisão de produto: base legal do storage = **execução de contrato** (logo o
banner é AVISO, sem "Recusar", sem migration). Landing page = fast-follow. Commits intercalados no
`feat/fase-8-fiis` (mesmo branch da Fase 8), ordem fria→quente pra minimizar colisão.

### 17.1 Observabilidade — Sentry (commit `9018122`)
`@sentry/react` + `@sentry/node` instalados (proxy MITM não bloqueou). Mantida a interface do shim
`telemetry.ts`: sem `VITE_SENTRY_DSN`/`SENTRY_DSN` → no-op/console (dev e testes sem rede); com DSN →
client carrega `@sentry/react` por **dynamic import** (chunk à parte) e `captureError/captureMessage`
encaminham (`beforeSend` remove cookies/headers/body). **NOVO** `api/_sentry.ts` (`captureServer`,
`@sentry/node` lazy) plugado nos catch fatais de `api/ai.ts` e `api/delete-account.ts`. ErrorBoundary
global em `main.tsx`. `.env.example` documenta os 2 DSNs. +1 teste (forward com DSN).

### 17.2 LGPD (commits `ae3a2fe`, `59b8d12`, `e22e4be`, `f785e65`)
Fecha os 3 "Alto" + o "Médio" da auditoria (`docs/lgpd-auditoria.md`):
- **Portabilidade (Art. 18 V):** **NOVO** `src/lib/dataExport.ts` (export client-side sob a RLS do
  usuário, reusa os `fetch*FromServer` do `supabaseSync`; `buildExportPayload` puro; `downloadJson` via
  Blob, sem dep) + **NOVO** `ScreenExportData.tsx` (cabeada no `App.tsx` como `screen:"export-data"` +
  `ToolButton` "Exportar meus dados" no `ScreenProfile`). **NOVO** `src/lib/localKeys.ts`: lista de
  chaves do localStorage compartilhada por export e exclusão (fim da duplicata no `ScreenDeleteAccount`).
- **Base legal (Art. 7) + Transferência internacional (Art. 33):** novas seções na `PRIVACY_POLICY`
  (`legal.ts`); execução de contrato p/ conta/carteira/perfil, legítimo interesse p/ IP; retenção
  declarada; portabilidade corrigida ("Exportar meus dados", era "Exportar resultados").
- **Consentimento (Art. 8):** `CookieConsentBanner` reposicionado como **aviso de transparência** (base =
  contrato → sem "Recusar"); `LGPD_COOKIE_NOTICE` perde a linguagem de consentimento; `CONSENT_VERSION`
  bumpada pra reexibir.
- **Exclusão atômica (Art. 18 VI):** `api/delete-account.ts` apaga `subscriptions` + `usage_log`
  explicitamente (antes só por cascade); teste happy-path 4→6 tabelas.

### 17.3 Validação
`tsc -b` ✅ · `npm run build` ✅ (index **399 KB**, sem warning de chunk) · `npm run test:run` →
**691/691** (77 files; +novos: telemetry forward, dataExport×6, legal×3, delete-account 6 tabelas) ·
lint dos arquivos tocados limpo (o único erro acusado — `setState`-em-effect no `App.tsx:651` do
boot — é **pré-existente**, não introduzido aqui).

### 17.4 Pendente (fast-follow, não bloqueia o beta)
- **Link Política/Termos no `LoginScreen`** (pré-login) — adiado: exige rota pré-auth no `App.tsx`
  (arquivo mais quente) por ganho marginal; banner pós-login + telas legais no Profile já cobrem.
- **Sentry real:** criar projeto Sentry e setar `VITE_SENTRY_DSN`/`SENTRY_DSN` na Vercel (código pronto).
- **Landing page**, testes dos 6 módulos de billing/IA, upgrade `xlsx`, busca global (`useStockSearch`
  órfã), PWA — fast-follows já listados no plano.
