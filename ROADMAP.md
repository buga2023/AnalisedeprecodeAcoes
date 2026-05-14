# Roadmap — Praxia

Documento vivo com as **10 features planejadas** + 2 bônus rápidos. Para cada feature: o que faz, como funciona, arquivos envolvidos, reuso do que já existe e como se conecta ao resto do app.

> Estado atual: portfolio com cotações em tempo real, score fundamentalista 0–100, chat conversacional Pra com elicitação de perfil, análise IA por ação, insights IA do portfolio, relatórios trimestrais. Toda IA via `/api/ai` com keys em env var.

---

## Princípios (valem pra todas as features)

1. **AI sempre via `/api/ai`** — nunca expor API key no cliente. Todo prompt novo segue o `SOURCE_AND_PROFILE_RULES` já em `src/lib/ai.ts` (perfil obrigatório + citações `[N]`)
2. **Cache em localStorage** com TTL + invalidação por assinatura — padrão já usado em `StockAIAnalysisSection` (24h por ticker) e `PortfolioInsightsModal` (6h por signature do portfólio)
3. **Reuso obrigatório de componentes** — `PraxiaCard`, `GlassButton`, `Icon`, `PraMark`, `Tag`, `DeltaPill`, animações `praDot`/`praFadeIn`/`praSlideUp` em `src/index.css`
4. **Modais sempre como siblings de `AppShell`** em `App.tsx` (ao lado do `ChatSheet`), nunca dentro de scroll containers — quebra z-index
5. **Sem novas dependências NPM** salvo se absolutamente necessário — usa o `AreaChart` SVG nativo

---

## Ordem de entrega proposta

| Fase | Features | Tempo |
|---|---|---|
| **1 — Quick wins** | #5 Alertas, #2 Comparador, Bônus A (Batch valuation), Bônus B (Macro widget) | 1–2 dias total |
| **2 — IA aplicada** | #1 Dividendos, #3 Rebalanceador, #4 Screener, #6 Notícias+sentimento, #9 Digest semanal | 3–5 dias total |
| **3 — Pesadas** | #7 IR, #8 FIIs, #10 Histórico de fundamentos | 1+ semana cada |

---

## Feature 1 — Calendário de dividendos

**O que é**: projeção mês-a-mês dos dividendos da carteira nos próximos 12 meses, total esperado por mês + detalhe por ticker.

**Como funciona**
- Tela ou seção lê `useStockQuotes().stocks`; pra cada ação busca histórico de dividendos via novo `/api/dividends?ticker=PETR4`
- Projeção: cadência dos últimos 4 pagamentos × DPA × quantidade do usuário
- Calendário vertical: cada mês = card com soma total + sub-items por ticker
- Botão "Otimize" (IA): sugere realocação pra subir DY médio sem perder qualidade

**Arquivos novos**
- `api/dividends.ts` — proxy serverless (Yahoo `chart` com `events=div`)
- `src/lib/dividends.ts` — `fetchDividendHistory(ticker)` + `projectDividends(stock, history)`
- `src/hooks/useDividendCalendar.ts` — cache 7 dias
- `src/components/praxia/screens/ScreenDividends.tsx`

**Reuso**: `useStockQuotes`, `fmt.brl/pct`, `PraxiaCard`

**Integração**: nova aba no `BottomNav` ou card no `ScreenHome` · Pra responde "qual minha renda passiva mês que vem?" · destrava #9 Digest

**Tamanho**: M (3 dias)

---

## Feature 2 — Comparador de ações lado a lado

**O que é**: pinçar 2–4 tickers e ver fundamentos em colunas paralelas + parecer IA de qual encaixa melhor no perfil.

**Como funciona**
- Botão "Comparar" em `ScreenStockDetail` adiciona ticker a uma lista global
- `ScreenCompare`: tabela com linhas (Preço, P/L, P/VP, ROE, DY, Div/EBITDA, score, margem Graham) e colunas por ticker; célula vencedora destacada
- Botão "Análise IA comparativa" → `compararAcoesComIA(stocks, profile)` retorna recomendação + tese de 3 frases por ticker
- Cache 24h por signature

**Arquivos novos**
- `src/components/praxia/screens/ScreenCompare.tsx`
- `src/components/praxia/CompareTable.tsx`

**Modificados**: `src/lib/ai.ts` (+`compararAcoesComIA`), `src/App.tsx` (novo `screen = "compare"`)

**Reuso**: tipo `Stock`, `calculateStockScore`, `calculateGrahamValue`, padrão de cache de `StockAIAnalysisSection`

**Integração**: chat "compara PETR4 com PRIO3" → Pra abre `ScreenCompare` via callback · resultados de #4 Screener podem alimentar via "Comparar todas"

**Tamanho**: M (2–3 dias)

---

## Feature 3 — Rebalanceador IA acionável

**O que é**: usuário define alocação-alvo por setor; IA gera plano com ordens concretas de compra/venda pra chegar lá.

**Como funciona**
- `ScreenRebalance`: sliders de alocação por setor (top 5 + outros); padrão sugerido pela IA com base no perfil
- Cálculo determinístico das ordens: pra cada setor com gap, busca melhor ação do setor por score e propõe quantidade
- IA refina: linguagem natural, identifica armadilhas ("vender ITUB4 antes do ex-dividendo dia 12 perde R$X")
- Cards de ordens com botão "Executar" → `applyTransaction` + `record` (paper-trading)

**Arquivos novos**
- `src/lib/rebalance.ts` — `generateOrders(stocks, target, profile)` (puro)
- `src/components/praxia/screens/ScreenRebalance.tsx`

**Modificados**: `src/lib/ai.ts` (+`explicarRebalanceamento`), `PortfolioInsightsModal.tsx`, `App.tsx`

**Reuso**: `sectorAllocation`/`dominantSector` (`lib/portfolio.ts`), `applyTransaction` (`useStockQuotes.ts:218`), `record` (`useTransactions`)

**Integração**: botão dentro de `PortfolioInsightsModal` quando há overweight · botão na `ScreenHome` · chat "como devo rebalancear?" · **alimenta #7 IR** (cada ordem vira `Transaction`)

**Tamanho**: M (3 dias)

---

## Feature 4 — Triagem de ações com IA (screener)

**O que é**: usuário descreve em linguagem natural ("ações pra dividendos com crescimento") → IA traduz pra filtros + retorna top-10 ranqueado.

**Como funciona**
- Aba "Descobrir" em `ScreenMarket` com input grande
- IA gera filtros JSON: `{ minROE, minDY, maxPL, sectors, marketCap }` + critério de ranking
- `api/screen.ts` filtra universo (IBOV 100 inicial) e ranqueia por score ponderado
- Top-10 como `HoldingRow` clicável → abre `ScreenStockDetail`
- Badge mostra filtros aplicados ("ROE > 15%, DY > 6%, P/L < 12")

**Arquivos novos**
- `api/screen.ts`
- `src/lib/screener.ts` — `parseScreenerQuery(text)` (IA) + `rankStocks(stocks, filters)` (puro)
- `src/components/praxia/screens/ScreenMarketScreener.tsx`

**Modificados**: `ScreenMarket.tsx`

**Reuso**: `fetchAvailableStocks`/`fetchMultipleQuotes` (`lib/api.ts`), `HoldingRow`, `calculateStockScore`, padrão JSON-mode de `fetchAIInsights`

**Integração**: tab "Para você" / "Buscar" / "Descobrir" em `ScreenMarket` · chat "sugere 3 ações pro meu perfil" · resultados → #2 Comparador

**Tamanho**: M (3 dias)

---

## Feature 5 — Alertas de preço inteligentes (web push)

**O que é**: alvo de preço, margem Graham ou queda %; quando bate, notificação no navegador.

**Como funciona**
- Em `ScreenStockDetail`/`QuickWatch`: botão "Criar alerta" → sheet com 3 opções (preço/margem/variação)
- Alertas em localStorage (`praxia-alerts`): `{ id, ticker, type, value, createdAt, triggeredAt? }`
- Polling de 60s existente em `useStockQuotes.ts:276` checa alertas ativos; dispara via `new Notification(...)` (permissão opt-in)
- `ScreenAlerts`: lista ativos, disparados (30 dias), editar/deletar

**Arquivos novos**
- `src/hooks/useAlerts.ts` — CRUD + matching
- `src/components/praxia/screens/ScreenAlerts.tsx`
- `src/components/praxia/AlertSheet.tsx`

**Modificados**: `useStockQuotes.ts` (callback no `refreshAll`), `ScreenStockDetail.tsx`, `ScreenHome.tsx`

**Reuso**: loop de polling existente, `calculateGrahamValue`/`calculateMarginOfSafety`, Notification API nativa

**Integração**: badge no top bar do `ScreenHome` · chat "me avisa quando PETR4 cair abaixo de R$32" · #6 Notícias podem criar alertas automáticos em eventos materiais

**Tamanho**: S (1–1.5 dias)

---

## Feature 6 — Notícias + sentimento por ação

**O que é**: últimas 5 manchetes por ação + sentimento classificado pela IA (positivo/neutro/negativo).

**Como funciona**
- `/api/news?ticker=PETR4` faz scrape de Google News RSS → `{ headline, url, source, publishedAt }[]`
- IA classifica em batch (1 chamada com até 5 manchetes) → sentimento por item + "destaque" se evento material
- `ScreenStockDetail`: seção "Notícias" abaixo de `StockReportsSection`
- `ScreenHome`: banner "📰 surpresa em VALE3" se evento material

**Arquivos novos**
- `api/news.ts` — proxy + parser RSS
- `src/lib/news.ts` — `fetchNews(ticker)`, `classifyNews(headlines, profile)`
- `src/components/praxia/StockNewsSection.tsx`
- `src/hooks/useNews.ts` — cache 1h por ticker

**Reuso**: padrão de `coletarDadosRI` (proxy + cache), padrão de prompt de `analisarAcaoComIA`, `PraxiaCard`

**Integração**: nova seção em `ScreenStockDetail` · **enriquece análise IA por ação** (passa headlines como contexto) · pode disparar alertas (#5) em eventos materiais

**Tamanho**: M (2–3 dias)

---

## Feature 7 — Calculadora de IR (Imposto de Renda) brasileiro

**O que é**: usa `useTransactions` pra calcular IR devido mensal com isenção de R$20k/mês em ações.

**Como funciona**
- `ScreenTaxReport` agrupa transações por mês:
  - Vendas < R$20k em swing-trade → **isento** ✅
  - Vendas ≥ R$20k → 15% sobre lucro (vendas − custo médio)
  - Day-trade: 20% sobre lucro, sem isenção
- Cada mês = card com status, DARF a pagar, código (6015), data limite
- Botão "Exportar relatório anual" → CSV pra anexar à declaração

**Arquivos novos**
- `src/lib/tax.ts` — `computeMonthlyTax(transactions, stocks)` (puro)
- `src/components/praxia/screens/ScreenTaxReport.tsx`
- `src/lib/exportTaxReport.ts` — gera CSV via `xlsx` (já é dep)

**Modificados**: `ScreenActivity.tsx`, `types/stock.ts` (Transaction.dayTrade? opcional)

**Reuso**: `useTransactions`, `useStockQuotes().stocks` (custo médio), padrão de export de `lib/exportResults.ts`

**Integração**: subaba em `ScreenActivity` · **#3 Rebalanceador alimenta automaticamente** (cada ordem vira `Transaction`) · chat "quanto vou pagar de IR esse mês?"

**Considerações**: tratar prejuízo acumulado (compensável). Distinguir day-trade × swing precisa de flag em `Transaction` (ou inferir pela proximidade temporal buy+sell no mesmo dia).

**Tamanho**: M-L (4–5 dias)

---

## Feature 8 — Suporte a FIIs (Fundos Imobiliários)

**O que é**: categoria separada na carteira para FIIs (`XXXX11`) com métricas próprias (DY mensal, P/VP, vacância) e score adaptado.

**Como funciona**
- Detecção automática em `addStock`: ticker `XX11` + `quoteType=ETF` → marca como FII
- `Stock` ganha `assetType: "stock" | "fii"`
- Score FII: DY mensal pesa 40, P/VP 30, vacância 15, segmento 15 (Graham não se aplica)
- `ScreenMarket`: toggle "Ações | FIIs"
- `ScreenStockDetail`: stats específicas (DY anualizado, último rendimento, gestora)
- `PortfolioInsightsModal`: separa análise em duas seções

**Arquivos novos**
- `src/lib/fiiScore.ts` — `calculateFIIScore(input)` (paralelo a `calculateStockScore`)
- `src/components/praxia/FIIDetailStats.tsx`

**Modificados**: `types/stock.ts` (Stock.assetType), `lib/api.ts` (detecção em `mapQuoteToStock`), `calculators.ts` (delega pra `calculateFIIScore`), `ScreenStockDetail.tsx`, `ScreenMarket.tsx`

**Reuso**: toda infra de cotação/score; só muda a fórmula. `useStockQuotes` continua igual.

**Integração**: propaga pra #4 Screener (filtro "melhores FIIs de logística") · #1 Dividendos (cadência mensal) · #7 IR (FIIs têm regra fiscal diferente: rendimentos isentos, ganho de capital 20%)

**Considerações**: brapi/Yahoo cobre alguns FIIs mas vacância/segmento podem precisar de outra fonte (Funds Explorer). Graceful degradation: se dado falta, "—" e exclui do score parcial.

**Tamanho**: L (5–7 dias)

---

## Feature 9 — Digest semanal IA

**O que é**: toda segunda de manhã, app gera resumo de 1 página do que aconteceu na carteira na semana + 3 ações sugeridas.

**Como funciona**
- Hook `useWeeklyDigest` checa se há digest da semana atual em localStorage; se não, dispara geração na primeira sessão da semana
- Coleta: variação % da semana, dividendos recebidos (#1), notícias materiais (#6), top mover, alertas disparados (#5)
- `gerarDigestSemanal(context, profile)` → `{ resumo, eventosNotaveis[], proximasAcoes[], destaque }`
- `ScreenWeeklyDigest` em tela cheia ou card destacado no topo da `ScreenHome`
- MVP on-demand; futuramente Vercel Cron + webhook/email

**Arquivos novos**
- `src/hooks/useWeeklyDigest.ts`
- `src/lib/digest.ts` + adição em `lib/ai.ts`
- `src/components/praxia/WeeklyDigestCard.tsx`

**Modificados**: `ScreenHome.tsx`, `src/lib/ai.ts`

**Reuso**: `useStockQuotes`, `useTransactions`, `useDividendCalendar` (#1), `useAlerts` (#5), `useNews` (#6); `PortfolioInsightsModal` como referência de layout

**Integração**: card no topo do `ScreenHome` na segunda · "próximas ações" com botões diretos (ex.: "rebalancear" → abre #3)

**Considerações**: usa quase TODOS os hooks novos — entregar depois de #1, #5, #6. Cache pela ISO-week (`2025-W18`).

**Tamanho**: M (2–3 dias) assumindo deps já existem

---

## Feature 10 — Histórico de fundamentos

**O que é**: gráfico de ROE, P/L, DY, margem líquida dos últimos 8 trimestres por ação — tendência de qualidade, não só snapshot.

**Como funciona**
- `/api/fundamentals-history?ticker=PETR4` retorna `{ periodo, roe, pl, dy, netMargin, debtToEbitda }[]` por trimestre
- Em `ScreenStockDetail`: seção "Tendência de fundamentos" com 4 mini-gráficos (`AreaChart`) em grid 2×2
- Cada mini-card: valor atual + delta vs 1 ano atrás + sparkline
- Tap expande pra visão full-width com escala e período (1Y / 3Y / 5Y)

**Arquivos novos**
- `api/fundamentals-history.ts` — proxy Yahoo `quarterly`
- `src/hooks/useFundamentalsHistory.ts` — cache 7 dias por ticker
- `src/components/praxia/StockFundamentalsTrend.tsx`

**Modificados**: `ScreenStockDetail.tsx`

**Reuso**: `AreaChart` (`components/praxia/Charts.tsx`), padrão de `useRelatorios`, `PraxiaCard`, `fmt.pct`/`fmt.compact`

**Integração**: aparece entre `StockAIAnalysisSection` e `StockReportsSection` · **eleva qualidade da análise IA** (passa tendência em vez de só snapshot) · #3 Rebalanceador usa pra dizer "VALE3 com ROE em queda há 3 trimestres, considere reduzir"

**Considerações**: Yahoo cobre dados trimestrais limitados pra B3 — fallback: derivar de `useRelatorios` (já tem receita+lucro). ROE histórico exige patrimônio líquido também.

**Tamanho**: M (3 dias)

---

## Bônus — 2 skills já 90% prontas

### Bônus A — Tela `ScreenBatchValuation` (~3h)

`useBatchValuation` e `calculateFullValuation` já existem (`src/hooks/useBatchValuation.ts`, `src/lib/calculators.ts:70`). Falta:
- Tela com upload de arquivo (CSV/XLSX), tabela de resultados, botão `exportResults()` (já existe)
- Wire em `ScreenProfile` (ferramentas) ou novo entry no `BottomNav`

### Bônus B — Widget de cotações macro (~1h)

`useMarketQuotes` retorna USD/EUR/BTC/ouro prontinho (`src/hooks/useMarketQuotes.ts`). Falta:
- Carrossel horizontal no topo do `ScreenHome` ou tab "Macro" em `ScreenMarket`
- Cada item: `code`, preço atual, `DeltaPill`

---

## Tabela resumo — arquivos por feature

| Feature | Arquivos novos | Arquivos modificados |
|---|---|---|
| #1 Dividendos | `api/dividends.ts`, `lib/dividends.ts`, `useDividendCalendar.ts`, `ScreenDividends.tsx` | `App.tsx`, `BottomNav.tsx` |
| #2 Comparador | `ScreenCompare.tsx`, `CompareTable.tsx` | `lib/ai.ts`, `App.tsx` |
| #3 Rebalanceador | `lib/rebalance.ts`, `ScreenRebalance.tsx` | `lib/ai.ts`, `PortfolioInsightsModal.tsx`, `App.tsx` |
| #4 Screener | `api/screen.ts`, `lib/screener.ts`, `ScreenMarketScreener.tsx` | `ScreenMarket.tsx` |
| #5 Alertas | `useAlerts.ts`, `ScreenAlerts.tsx`, `AlertSheet.tsx` | `useStockQuotes.ts`, `ScreenStockDetail.tsx`, `ScreenHome.tsx` |
| #6 Notícias | `api/news.ts`, `lib/news.ts`, `useNews.ts`, `StockNewsSection.tsx` | `ScreenStockDetail.tsx`, `lib/ai.ts` |
| #7 IR | `lib/tax.ts`, `ScreenTaxReport.tsx`, `lib/exportTaxReport.ts` | `ScreenActivity.tsx`, `types/stock.ts` |
| #8 FIIs | `lib/fiiScore.ts`, `FIIDetailStats.tsx` | `types/stock.ts`, `lib/api.ts`, `calculators.ts`, `ScreenStockDetail.tsx`, `ScreenMarket.tsx` |
| #9 Digest | `useWeeklyDigest.ts`, `lib/digest.ts`, `WeeklyDigestCard.tsx` | `ScreenHome.tsx`, `lib/ai.ts` |
| #10 Histórico fund. | `api/fundamentals-history.ts`, `useFundamentalsHistory.ts`, `StockFundamentalsTrend.tsx` | `ScreenStockDetail.tsx` |

---

## Diagrama de dependências entre features

`→` significa "alimenta / é input de":

```
#5 Alertas ───────────────────────────────┐
                                          ▼
#1 Dividendos ──┐               #9 Digest semanal
                ├───┐                     ▲
#3 Rebalance ───┘   │                     │
                    ▼                     │
              #7 IR (transações)          │
                                          │
#6 Notícias ──────────────────────────────┤
       │                                  │
       ▼                                  │
Análise IA por ação (existe) ─────────────┘

#10 Hist. fundamentos ──► Análise IA por ação

#4 Screener ──► #2 Comparador

#8 FIIs ────► afeta #1 (cadência mensal), #4 (filtro), #7 (regra fiscal)
```

**Sequência ideal** (minimiza retrabalho):
1. #5 Alertas + #2 Comparador + Bônus A + Bônus B (independentes)
2. #1 Dividendos + #6 Notícias + #3 Rebalanceador (alimentam outras)
3. #4 Screener + #10 Histórico
4. #9 Digest (consome todas as anteriores)
5. #7 IR + #8 FIIs (mais invasivas)

---

## Critérios de aceitação por feature

Pra qualquer feature ser considerada "done":

1. `npm run build` passa (`tsc -b` + `vite build`) — baseline atual: 0 erros
2. `npm run lint` não introduz novos erros (baseline: 18 pré-existentes em libs antigas)
3. Manual test do golden path da feature
4. Cache em localStorage validado: 1ª visita gera, 2ª devolve do cache, 3ª após TTL gera de novo
5. **Features com IA**: confirmar `[N]` citations no texto + recomendação começa referenciando o perfil (`SOURCE_AND_PROFILE_RULES`)
6. **Features que tocam `Transaction`**: log resultante alimenta corretamente IR (#7) quando a feature existir
7. **Features com modais novos**: render como sibling de `AppShell` em `App.tsx`, nunca dentro de scroll containers
