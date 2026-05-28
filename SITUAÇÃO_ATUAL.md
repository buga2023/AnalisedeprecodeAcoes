# Praxia — Situação Atual

> Documento vivo. Última atualização: 2026-05-28 (quarta passagem, pós-commit).
> Estado: Fases 0, 0.5, 1, 2, **3 (Dividendos)**, **6 (Digest Semanal IA)** e **7 (Histórico de Fundamentos)** concluídas e **commitadas no branch `main`** (9 commits desta sessão, working tree limpo).
> Pendentes: Fases 4 (Screener), 5 (Rebalanceador), 8 (FIIs), 9 (IR).

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
| IA | `/api/ai` multi-provider: Groq (default) / OpenAI / Anthropic / Gemini |
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
| **Fase 8** | Feature #8: Suporte a FIIs | 5–7 dias | Pendente |
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
