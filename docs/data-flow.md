# Fluxo de Dados

> Como cotações entram, são processadas e disparam efeitos (UI, score, alertas).

## 1. Portfólio — entrada de dados

```
Usuário adiciona ticker (ScreenMarket.onAddTicker)
       │
       ▼
useStockQuotes.addStock(ticker, cost, quantity)        src/hooks/useStockQuotes.ts:211
       │
       ▼
fetchStockQuote(ticker)                                 src/lib/api.ts:54
       │
       ▼
GET /api/brapi?endpoint=/quote/{TICKER}                api/brapi.ts
   &modules=summaryProfile,financialData,defaultKeyStatistics
       │
       ▼ (proxy Yahoo Finance — UA Chrome 120 + Origin/Referer)
       │
       ▼
mapQuoteToStock(quote, cost, quantity)                 src/hooks/useStockQuotes.ts:22
   ├─ calcula grahamValue       = √(22.5 × LPA × VPA)
   ├─ calcula debtToEbitda      = totalDebt / ebitda
   ├─ calcula evEbitda          = enterpriseValue / ebitda
   ├─ calcula ROIC              = NOPAT / (totalDebt + PL estimado)
   ├─ calcula marginOfSafety    = (graham - price) / graham × 100
   ├─ chama calculateStockScore → { total: 0-100, breakdown: 5 dimensões }
   └─ detecta market/sector/brandColor                 src/lib/stockMeta.ts
       │
       ▼
setStocks(prev => [newStock, ...prev])
       │
       ├──► useEffect → localStorage.setItem("stocks-ai-portfolio", JSON)
       └──► useEffect → fillMissingFundamentalsViaAI(stocks)
                             │
                             ▼
                       POST /api/fundamentals?ticker=PETR4 (IA estimando)
                             │  só quando p/l, p/vp, dy, roe vêm zerados
                             ▼
                       merge dos campos estimados → setStocks com aiEstimated=true
```

## 2. Polling de cotações (a cada 60s)

`useStockQuotes.ts:324-336` — `setInterval` chamando `refreshAll()`:

```
refreshAll()
   ├─ fetchMultipleQuotes(tickers)  → batch via /api/brapi?endpoint=/quote/T1,T2,T3
   ├─ setStocks(...) → mapQuoteToStock por ticker
   └─ setLastRefreshed(new Date())
```

A mudança no `stocks` dispara em cascata:
1. `useEffect` em `useStockQuotes` salva no localStorage
2. `useEffect` em `App.tsx:103` chama `checkAlerts(stocks)` do `useAlerts`
3. Componentes filhos re-renderizam com novos valores derivados

> **Pegadinha**: o intervalo é recriado quando `refreshAll` muda (que depende de `stocks`).
> O `stocks.length` no array de deps existe pra evitar recriação a cada poll quando só
> os preços mudam.

## 3. Engine de score (cálculo puro)

`src/lib/calculators.ts:calculateStockScore`

```
Total = priceScore + profitabilityScore + healthScore + dividendScore + valuationScore
              0-25          0-20             0-20          0-20            0-15

priceScore (25 pts)        = 25 se price < grahamValue, senão 0
profitabilityScore (20 pts) = 20 se ROE > 20% / 15 se 15-20% / 10 se 10-15% / 0 se < 10%
healthScore (20 pts)       = 20 se D/EBITDA < 1.5 / 15 < 2 / 10 ≤ 3 / 0 acima
dividendScore (20 pts)     = 20 se DY > 6% / 10 se 4-6% / 0 < 4%
valuationScore (15 pts)    = plScore (0-8) + evEbitdaScore (0-7)
   plScore       = 8 / 5 / 2 / 0 conforme P/L ≤ 10 / 20 / 30 / acima
   evEbitdaScore = 7 / 4 / 1 / 0 conforme EV/EBITDA < 6 / 12 / 20 / acima
```

Label (`getScoreLabel`):
- **> 80** → "Compra Forte"
- **≥ 50** → "Observação"
- **< 50** → "Risco Elevado"

> Função pura. Se score parece errado, fonte do bug está nos **inputs** (Yahoo
> retornando 0 em campo crítico, conversão de % vs fração) — não na fórmula.

### Valuation auxiliares

| Fórmula | Função |
|---|---|
| Graham VI = √(22.5 × LPA × VPA) | `calculateGrahamValue` |
| Graham com crescimento = LPA × (8.5 + 2g) | `calculateGrahamGrowth` |
| Bazin = DPA / 0.06 | `calculateBazinCeiling` |
| Margem de segurança = (VI − price) / VI × 100 | `calculateMarginOfSafety` |
| ROIC ≈ EBITDA × 0.75 × (1 − 0.34) / capital investido | `calculateROIC` |

## 4. Paper trading — `applyTransaction`

`useStockQuotes.ts:266`

```
applyTransaction(ticker, "buy" | "sell", shares, price)

buy:
  Se já tem o ticker → atualiza média ponderada
     newCost = (oldCost × oldQty + price × shares) / (oldQty + shares)
     newQty  = oldQty + shares
  Se não tem → fetchStockQuote(ticker), cria com cost=price, qty=shares

sell:
  Se shares ≤ qty → qty -= shares
     Se qty=0 E isFavorite=false → remove da lista
  Senão → setError("Quantidade insuficiente para venda.")
```

Quem chama: `App.tsx:confirmOrder` na tela de Order Review. Depois disso:
1. `applyTransaction` muda `stocks`
2. `useTransactions.record(...)` grava no log `praxia-transactions`
3. `setScreen("activity")` navega pro histórico

## 5. Alertas — engine de matching

`src/hooks/useAlerts.ts`

```
useEffect em App.tsx:103 — toda vez que `stocks` muda:
   useAlerts.checkAlerts(stocks)
       │
       ▼
   Pra cada alerta sem triggeredAt:
       Acha o stock pelo ticker
       Chama matches(alert, stock) — 4 tipos:
           price-above   → stock.price >= alert.value
           price-below   → stock.price > 0 && stock.price <= alert.value
           graham-margin → calculateMarginOfSafety(price, graham) × 100 >= alert.value
                          ⚠️  multiplicação por 100 dentro do match — vide notas
           change-drop   → stock.changePercent <= -|alert.value|
       Se bate:
           triggered = { ...alert, triggeredAt: now, triggerPrice: stock.price }
           fireNativeNotification("Praxia · alerta disparado", ...)
           announcedRef previne disparo duplicado na mesma sessão
   
   Retenção: ao carregar do localStorage, descarta alertas com triggeredAt > 30 dias
```

**Permissão Notification API**:
- Pedida lazy via `requestPermission()` quando o usuário cria o primeiro alerta
- Estado `permission`: `"granted" | "denied" | "default" | "unavailable"`
- Disparo silencia se permissão != `granted`

> **Quirk**: `calculateMarginOfSafety` já retorna **percentual** (ex.: 24 = 24%), mas
> `matches()` multiplica por 100 de novo. Se algum alerta de margem nunca disparar,
> esse é o lugar a checar. Comportamento atual mantido por compatibilidade com
> alertas existentes.

## 6. Batch valuation — CSV/Excel

`useBatchValuation` + `lib/sheetParser` + `lib/columnMappings`:

```
ScreenBatchValuation upload de .csv/.xlsx
       │
       ▼
parseSheet(file)        → linhas crus via papaparse / xlsx          src/lib/sheetParser.ts
       │
       ▼
detectColumns(headers)  → mapeia colunas heterogêneas pra schema    src/lib/columnMappings.ts
       │                  (ticker, qty, avgCost, eps, bvps, dpa)
       ▼
Pra cada linha:
   fetchStockQuote(ticker)               → preço atual
   calculateFullValuation(row, price)    → Bazin/Graham/GrahamG + margens + ROI
       │
       ▼
ValuationRow[] no state
       │
       ▼
exportResults(rows)     → gera .xlsx pra download                   src/lib/exportResults.ts
```

> Se uma planilha vem com nome de coluna diferente do esperado, o problema é em
> `columnMappings.ts` (mapa de aliases). Adicionar o alias lá resolve.

## 7. Persistência (localStorage)

Tudo em `localStorage`. Lista completa, owners e TTLs estão em
[state-and-cache.md](state-and-cache.md). Resumo:

- Carteira viva: `stocks-ai-portfolio`
- Perfil do investidor: `praxia-investor-profile`
- Chat da Pra: `praxia-pra-chat`
- Alertas: `praxia-alerts`
- Caches IA: `stocks-ai-analysis:{TICKER}` (24h), `stocks-ai-portfolio-insights` (6h)

## 8. Fluxo de erro

Tudo que vem de `/api/brapi` passa por `fetchStockQuote` que pode lançar:

| Status HTTP | Exceção | Como aparece |
|---|---|---|
| 404 | `TickerLookupError` com `suggestions[]` | Banner vermelho no topo + lista de sugestões |
| 429 | `Error("Limite de requisições atingido…")` | Banner |
| outros | `Error("Erro ao buscar cotação: NNN")` | Banner |

`useStockQuotes` captura e expõe `error` que `App.tsx` renderiza como faixa
clicável no topo. Clicar limpa via `clearError`.
