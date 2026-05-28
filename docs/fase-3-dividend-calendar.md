# Fase 3 — Calendário de Dividendos

> **Status**: em implementação · iniciada 2026-05-28
>
> **Equivalente no `ROADMAP.md`**: Feature #1 — Calendário de dividendos
>
> Documento vivo: atualizado a cada sub-entrega com o que foi feito, decisões técnicas e como debugar.

---

## 1. O que é

Projeção mês-a-mês dos dividendos da carteira do usuário para os próximos 12 meses, com total esperado por mês e detalhamento por ticker. Inclui botão "Otimize com IA" que sugere realocação para subir o DY médio sem perder qualidade do score.

**Motivação:** a aba `ScreenActivity` mostra dividendos passados; o usuário precisa enxergar o futuro pra planejar renda passiva (perfil "div" do `InvestorProfile`).

---

## 2. Plano de execução em sub-entregas

| Sub | Conteúdo | Status |
|---|---|---|
| **Sub-entrega 1** | Backend `api/dividends.ts` + lib pura `src/lib/dividends.ts` + testes Vitest | ✅ concluída (27/27 testes; cobertura ≥86%) |
| **Sub-entrega 2** | Hook `useDividendCalendar` + tela `ScreenDividends.tsx` + wire em `App.tsx` + entrada em `ScreenProfile.tsx` | ✅ concluída (hook 95% cobertura via 8 testes; tela coberta por convenção do projeto que exclui `screens/**` da cobertura) |
| **Sub-entrega 3** | Otimizador IA via `src/lib/aiDividends.ts` (módulo isolado para não tocar `src/lib/ai.ts` editado pelo outro Claude) + `OptimizeDividendsModal` sibling de AppShell + botão na tela | ✅ concluída (8 testes lib IA, build verde, modal excluído da cobertura por seguir convenção dos outros modais do projeto) |

> **2026-05-28 — Decisão de isolamento de IA**: o roadmap original previa adicionar `otimizarDividendos` em `src/lib/ai.ts`, mas esse arquivo está modificado em working tree pelo outro Claude (Fases 1+2 não commitadas). Para evitar conflito de merge e dependência de mudanças não revisadas, a função foi colocada em `src/lib/aiDividends.ts` (novo arquivo só meu), replicando localmente o helper `callAIServerless` (~30 linhas). Custo aceito pelo isolamento. Quando o `lib/ai.ts` estabilizar, podemos refatorar `aiDividends.ts` para reusar `callAIServerless` exportado.

> **2026-05-28 — Pausa de commit**: ao validar com `npm run test:run` descobri que o working tree estava sujo com mudanças não commitadas das Fases 1 e 2 (outro Claude). `src/lib/ai.ts` modificado por essa origem quebra 4 testes em `src/lib/ai.test.ts` — fora do meu escopo. Meus 43 testes da Fase 3 passam isoladamente e meus arquivos não fazem overlap com os do outro Claude (conferido por diff em `App.tsx`, `ScreenProfile.tsx` e `ScreenDividends.tsx`). Decisão: aguardar Gustavo fechar Fases 1+2 primeiro, depois commitar Fase 3 em cima do baseline limpo.

### Cobertura por arquivo (Fase 3 isolada, run em 2026-05-28)

| Arquivo | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| `api/dividends.ts` | 86.36% | 80.55% | 100% | 86.36% |
| `src/lib/dividends.ts` | 99.22% | 85.36% | 100% | 99.22% |
| `src/lib/aiDividends.ts` | 97.58% | 65.51% | 100% | 97.58% |
| `src/hooks/useDividendCalendar.ts` | 95.16% | 82.5% | 100% | 95.16% |
| **Total Fase 3** | **95.26%** | **78.7%** | **100%** | **95.26%** |

Threshold do projeto: 70% statements/functions/lines, 60% branches — **todos os limites atingidos com folga**. Comando de validação: `npx vitest run --coverage --coverage.include="api/dividends.ts" --coverage.include="src/lib/dividends.ts" --coverage.include="src/lib/aiDividends.ts" --coverage.include="src/hooks/useDividendCalendar.ts" api/dividends.test.ts src/lib/dividends.test.ts src/lib/aiDividends.test.ts src/hooks/useDividendCalendar.test.ts`.

---

## 3. Arquivos novos / modificados

### Novos (Sub-entrega 1)
- `api/dividends.ts` — proxy Yahoo Finance `chart?events=div&range=5y&interval=1mo`. Retorna `{ ticker, history: DividendEvent[], generatedAt, source }`. Falha silenciosa: 5xx/429 → `history: []` com status 200.
- `api/dividends.test.ts` — 9 testes Vitest cobrindo OPTIONS, 400 sem ticker, ordenação por data, history vazio quando Yahoo não tem `events.dividends`, fallback `.SA`, 500/429 silencioso, normalização de ticker.
- `src/lib/dividends.ts` — `fetchDividendHistory(ticker)`, `detectCadence(history)`, `projectDividends(stock, history, now?)`. 100% puro exceto o fetcher.
- `src/lib/dividends.test.ts` — 18 testes cobrindo as 4 cadências + irregular + unknown + edge cases (quantity 0, history vazio, JSON malformado, eventos com shape inválido).

### Modificados (Sub-entrega 1)
- Nenhum. Endpoint e lib novos não precisaram mexer em arquivos existentes.

### Novos (Sub-entrega 2)
- `src/hooks/useDividendCalendar.ts` — orquestra `fetchDividendHistory` + `projectDividends`, cache 7 dias em `localStorage` (`praxia-dividend-history:{TICKER}`), invalida quando a signature da carteira (`ticker:quantity` ordenados) muda. Abort controller cancela requisições in-flight.
- `src/components/praxia/screens/ScreenDividends.tsx` — calendário vertical: header com voltar/refresh, card de resumo (total anual + média mensal + nº de tickers projetando), 12 cards mensais (mês cinza quando soma=0), breakdown por ticker dentro de cada card.

### Modificados (Sub-entrega 2)
- `src/App.tsx` — adicionado lazy import de `ScreenDividends`, `"dividends"` ao `type Screen` union, render condicional dentro do `<Suspense>` (volta pra `profile`), prop `onOpenDividends` em `ScreenProfile`.
- `src/components/praxia/screens/ScreenProfile.tsx` — nova prop opcional `onOpenDividends`, novo `ToolButton "Calendário de dividendos"` na seção Ferramentas (acima do Valuation em lote).

### Novos (Sub-entrega 3)
- `src/lib/aiDividends.ts` — `otimizarDividendos(stocks, buckets, profile)` chama `/api/ai` com prompt no padrão `SOURCE_AND_PROFILE_RULES`. Replica `callAIServerless` localmente (decisão de isolamento, ver acima). Retorna `DividendOptimization { resumo, sugestoes, fontes }` com normalização defensiva — `acao` inválida vira `"manter"`, sugestões sem ticker/tese são filtradas.
- `src/lib/aiDividends.test.ts` — 8 testes Vitest cobrindo: rejeição com carteira vazia, parse de JSON puro, parse com `\`\`\`json` fences, normalização de `acao` inválida, erro HTTP, conteúdo vazio, JSON malformado, profile null.
- `src/hooks/useDividendCalendar.test.ts` — 8 testes Vitest cobrindo: estado vazio, ignorar quantity ≤ 0, fluxo completo de fetch+cache, hit de cache em re-render, `refetch()` ignora cache, agregação de múltiplos tickers, cache corrompido, cache expirado (>7d).
- `src/components/praxia/OptimizeDividendsModal.tsx` — bottom-sheet sibling de `AppShell` (regra inegociável de modais). Recebe `open, onClose, stocks, profile, annualProjected, accent`. `useEffect` dispara `otimizarDividendos` ao abrir; renderiza loading/erro/resultado (resumo + sugestões com badges de ação + impacto estimado + chips de fontes).

### Modificados (Sub-entrega 3)
- `src/App.tsx` — lazy import `OptimizeDividendsModal`, state `optimizeOpen`/`optimizeAnnual`, render como sibling do `AppShell`, callback `onOptimize` passado pro `ScreenDividends` que dispara `setOptimizeAnnual(annual) + setOptimizeOpen(true)`.
- `src/components/praxia/screens/ScreenDividends.tsx` — prop opcional `onOptimize(annualProjected: number)`, botão "Otimizar renda passiva com IA" no card de resumo (só aparece se `hasProjection && onOptimize`).
- `src/hooks/useDividendCalendar.ts` — campo novo `rawHistoryByTicker: Record<string, DividendEvent[]>` retornado pelo hook (histórico bruto para features futuras como digest semanal).
- `vitest.config.ts` — adicionado `OptimizeDividendsModal.tsx` à lista de exclusão de cobertura (segue convenção dos outros modais grandes do projeto: `PortfolioInsightsModal`, `ChatSheet`, etc.).

---

## 4. Decisões técnicas

### 4.1 Fonte de dividendos
Yahoo Finance `chart` endpoint com `events=div&range=2y&interval=1mo`. Mesma rota já usada por `api/brapi.ts` — apenas adiciona `events=div` para receber a lista de dividendos pagos no período. Retorna pares `{ timestamp, amount }` que o backend normaliza.

**Por que Yahoo e não scraping**: já temos a infra de headers/timeout/fallback de sufixo `.SA` em `api/brapi.ts`. Yahoo é a fonte mais estável para B3 hoje. Para FIIs (que pagam mensal) e ações com pagamento irregular, Yahoo cobre razoavelmente. Onde Yahoo zerar, devolvemos `[]` e a projeção fica em zero (sem inventar valor — regra do projeto).

### 4.2 Detecção de cadência
Lib pura inspeciona os intervalos entre os últimos pagamentos:
- ≤ 45 dias médio → **mensal** (típico de FIIs)
- 60–110 dias → **trimestral** (ITUB, BBAS, etc)
- 150–210 dias → **semestral**
- 320–400 dias → **anual**
- demais → **irregular** — projeta usando média dos últimos 12 meses dividida por 12, repetida mensalmente

### 4.3 Projeção dos próximos 12 meses
- Para cada ticker, soma `DPA × quantity` na posição do mês correspondente, baseado na cadência detectada e na data do último pagamento.
- DPA estimado = média dos últimos 4 pagamentos (ou todos se < 4).
- Quando `cadencia = 'irregular'`, distribui o total anual estimado de forma uniforme nos 12 meses.
- Resultado: `MonthlyProjection[]` com `{ month: 'YYYY-MM', total: number, byTicker: { ticker, amount }[] }`.

### 4.4 Cache
- `localStorage` key `praxia-dividend-history:{TICKER}` — TTL 7 dias.
- `useDividendCalendar` invalida quando o conjunto de tickers da carteira muda (assinatura `ticker1|ticker2|...`).

### 4.5 Entrada na UI
- Adiciona `"dividends"` ao `type Screen` em `App.tsx:62` (já tem `"analysis"`, `"alerts"`, etc).
- Lazy import (padrão do projeto, ver `App.tsx:18–47`).
- Entrada via **botão "Calendário de dividendos"** dentro de `ScreenProfile` na seção de ferramentas (padrão usado por `ScreenBatchValuation`). **Não mexer no `BottomNav`** — manter as 4 abas atuais (home/market/activity/profile).

---

## 5. Como debugar

### 5.1 Endpoint
```powershell
# Localhost (após npm run dev)
curl "http://localhost:5173/api/dividends?ticker=PETR4"

# Esperado: { ticker, history: [{ date, amount }], generatedAt, source: 'Yahoo Finance' }
```

### 5.2 Lib pura
```typescript
// Console do browser, após carregar a app
import('./src/lib/dividends').then(m => m.projectDividends(stock, history))
```

### 5.3 Tela
- Logar como usuário com ao menos 2 tickers pagadores (`PETR4`, `BBAS3`, `ITUB4`)
- Abrir `Perfil → Calendário de dividendos`
- Esperado: 12 cards mensais, com soma > 0 nos meses correspondentes à cadência de cada ticker

### 5.4 Cache
- `localStorage.getItem("praxia-dividend-history:PETR4")` → `{ data: [...], cachedAt: '...' }`
- Para invalidar: `localStorage.removeItem("praxia-dividend-history:PETR4")` ou esperar 7 dias

---

## 6. Validação por sub-entrega

| Sub | Comando |
|---|---|
| 1 | `npm run test:run -- api/dividends src/lib/dividends` deve passar; `npm run build` sem novos erros |
| 2 | `npm run build` sem novos erros; smoke manual: tela carrega 12 meses com soma plausível |
| 3 | smoke manual: botão "Otimize com IA" retorna sugestão com `[N]` citations e referência ao perfil do usuário |

---

## 7. Critérios de aceitação (do roadmap)

1. ✅ `npm run build` passa
2. ✅ `npm run lint` sem novos erros
3. ✅ Cache 1ª visita gera / 2ª devolve do cache / 3ª após TTL gera de novo
4. ✅ IA: texto começa com "Pelo seu perfil…" + citações `[N]`
5. ✅ Modais (se houver) renderizados como siblings de `AppShell`

---

## 8. Troubleshooting esperado

| Sintoma | Causa provável | Como diagnosticar |
|---|---|---|
| Calendário vazio em todos os meses | Yahoo retornou `[]` para todos os tickers (ticker novo, sem histórico, ou rate-limit) | `curl /api/dividends?ticker=X` no console; ver `console.error` do backend |
| Calendário com valores plausíveis exceto FIIs | Cadência mensal não detectada — verificar limiares na lib | Logar `detectCadence(history)` na lib |
| "Otimize com IA" devolve texto sem citações | Prompt não está usando `SOURCE_AND_PROFILE_RULES` em `src/lib/ai.ts` | Conferir `otimizarDividendos` no PR |
| Tela quebra no first paint | Lazy import sem `Suspense` ao redor | Conferir wrapping em `App.tsx` (mesmo padrão das outras telas) |
| Cache não invalida quando usuário adiciona ticker novo | `useDividendCalendar` não está rebuildando a signature | Logar `signature` no hook |

---

## 9. Referências cruzadas

- `ROADMAP.md` — Feature #1 (especificação completa)
- `SITUAÇÃO_ATUAL.md` — Fase 3 (este documento atualiza a tabela do item 5)
- `CLAUDE.md` — regras do projeto (`tokens.ts`, IA via `/api/ai`, sem novas deps)
- `api/brapi.ts` — referência para o padrão de proxy Yahoo
- `api/news.test.ts` — referência para o padrão de teste Vitest de endpoint serverless
- `src/hooks/useAlerts.ts` — referência para o padrão de hook com cache localStorage + invalidação por signature

---

## 10. Decisões / desvios do roadmap original

| Decisão | Justificativa |
|---|---|
| Entrada via `ScreenProfile` em vez de nova aba no `BottomNav` | BottomNav tem 4 abas firmes; trocar uma quebra hábito do usuário. `ScreenBatchValuation` segue o mesmo padrão. |
| Cache 7 dias (em vez de 24h) | Yahoo só atualiza dividendos após pagamento real → frequência baixa, cache mais longo evita ruído. |
| Sem nova dep npm | Regra inegociável do projeto (CLAUDE.md item 7). Toda a lógica em TS puro. |
