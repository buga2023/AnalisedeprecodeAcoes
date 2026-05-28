# State & Cache (localStorage)

> O app **não tem backend** — toda persistência vive em `localStorage`. 13 chaves
> conhecidas + caches em memória dentro das funções Vercel.

## Tabela completa de chaves

| Chave | Owner | Tipo de dado | TTL | Invalidação |
|---|---|---|---|---|
| `stocks-ai-portfolio` | `useStockQuotes` | `Stock[]` (carteira ativa) | Persistente | Manual (Profile → "Limpar dados locais") |
| `praxia-investor-profile` | `useInvestorProfile` | `InvestorProfile` | Persistente | Retake quiz / Reset |
| `praxia-pra-chat` | `usePraChat` | `ChatMessage[]` | Persistente | `reset()` do hook |
| `praxia-transactions` | `useTransactions` | `Transaction[]` | Persistente | `clear()` |
| `praxia-alerts` | `useAlerts` | `PriceAlert[]` | Rolling 30 dias para `triggeredAt` | Cleanup automático no load |
| `praxia-ui-prefs` | `useUIPreferences` | `{ accent, tone }` | Persistente | — |
| `stocks-ai-relatorios` | `useRelatorios` | `Record<TICKER, Relatorio[]>` | 24h por ticker | Refresh manual no card |
| `stocks-ai-analysis:{TICKER}` | `StockAIAnalysisSection` | `AnaliseIA` | 24h por ticker | `delete localStorage[key]` no devtools |
| `stocks-ai-portfolio-insights` | `PortfolioInsightsModal` | `{ data: AIResponse, signature, ts }` | 6h | Signature da carteira mudou |
| `stocks-ai-comparison:{TICKERS}` | `ScreenCompare` | `ComparisonResult` | 6h | Lista de tickers mudou |
| `praxia-news-summary:{topic}` | `aiNews.ts` (modo Tópicos) | `ResumoNoticiasIA` | 2h | Signature de manchetes (5 títulos) mudou |
| `praxia-news-feed-analysis:{hash}` | `aiNewsFeed.ts` (modo Feed) | `AnaliseNoticiaIA` | 24h | Tickers da carteira mudaram |
| `stocks-ai-batch-valuation` | `useBatchValuation` | `ValuationRow[]` | Persistente | Nova importação |
| `stocks-ai-brapi-token` | (legado) | Bearer token brapi.dev | Persistente | Manual |
| `stocks-ai-provider-config` | `useAIProvider` (dormente) | `AIProviderConfig` | Persistente | Profile → "Limpar provider" |

> Compare com `PONTO.md §11` se algo divergir — esse doc é a versão verificada da
> implementação atual.

## Caches IA — padrões de invalidação

### Análise per-stock (24h por ticker)

`StockAIAnalysisSection.tsx`:
```typescript
const KEY = `stocks-ai-analysis:${ticker}`;
const cached = localStorage.getItem(KEY);
if (cached) {
  const { data, ts } = JSON.parse(cached);
  if (Date.now() - ts < 24 * 60 * 60 * 1000) return data;  // hit
}
// miss → chama analisarAcaoComIA, grava com ts = Date.now()
```

**Forçar refresh**: botão "Atualizar análise" no card. Ou no devtools:
```js
delete localStorage["stocks-ai-analysis:PETR4"]
```

### Insights do portfólio (6h + signature)

`PortfolioInsightsModal.tsx`:
```typescript
const signature = stocks.map(s => `${s.ticker}:${s.quantity}`).join("|");
const cached = JSON.parse(localStorage.getItem("stocks-ai-portfolio-insights") || "{}");
if (cached.signature === signature && Date.now() - cached.ts < 6 * 60 * 60 * 1000) {
  return cached.data;
}
```

**Invalidação dupla**: por tempo (6h) ou por mudança na composição (qualquer add/remove
ou compra/venda muda a signature). Mexer só no `price` NÃO invalida — esperado, pois
insight é sobre tese de longo prazo.

### Comparação (6h por conjunto de tickers)

```typescript
const sorted = tickers.slice().sort().join(",");
const key = `stocks-ai-comparison:${sorted}`;
```

Como sorted, comparar `[PETR4, VALE3]` e `[VALE3, PETR4]` bate no mesmo cache.

## Migrations / mudanças de schema

Não há sistema de versionamento. Se mudar o shape do `Stock`, o `localStorage` antigo
quebra em runtime. Mitigação atual: `JSON.parse` está envolto em try/catch e devolve
`[]` em caso de erro — usuário "perde" a carteira mas o app não trava.

**Padrão recomendado** para mudanças não-triviais:
```typescript
function loadStocksFromStorage(): Stock[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // VALIDAR shape antes de retornar
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(s => typeof s?.ticker === "string");
  } catch {
    return [];
  }
}
```

Em mudança grande: criar nova chave (`stocks-ai-portfolio-v2`), migrar do v1 no boot,
deletar a v1. Há precedente em `praxia-alerts` (cleanup de retenção no load).

## Caches em memória (server-side)

Cada função Vercel mantém `let cachedData` no escopo do módulo. Funciona enquanto a
mesma instância tá quente:

| Função | TTL | Var |
|---|---|---|
| `api/market.ts` | 60s | `cachedData` + `lastFetchTime` |
| `api/macro.ts` | 5min | objeto interno |
| `api/news.ts` | 30min | Map por query |
| `api/world-news.ts` | 2h | + Cron `0 */2 * * *` em `vercel.json` |

**Pegadinha**: em Vercel, instâncias morrem por inatividade. Cache "quente" não é
garantido entre requests separadas. Por isso o cron do `world-news` — força um GET a
cada 2h pra manter a função aquecida e o cache pronto pro usuário.

## Como zerar tudo (procedimento canônico)

```js
// devtools console
Object.keys(localStorage)
  .filter(k => k.startsWith("praxia-") || k.startsWith("stocks-ai-"))
  .forEach(k => localStorage.removeItem(k));
location.reload();
```

Ou usar o botão "Limpar dados locais" em Profile → confirmação → recarrega.

## Limites a observar

- `localStorage` browser tem limite de **~5-10MB por origin**
- Chat da Pra pode crescer indefinidamente (não há truncamento) — usuário pesado
  pode estourar
- Cache de relatórios trimestrais por ticker cresce com a carteira
- Mitigação futura: rotação por idade (manter só últimas 50 mensagens, últimos 8
  trimestres por ticker, etc.)

## Onde os dados NÃO vivem

- **Não há cookies**
- **Não há IndexedDB**
- **Não há service worker** (sem PWA por enquanto)
- **Não há backend / banco**
- **API keys NUNCA vão pro cliente** — só env vars do servidor
