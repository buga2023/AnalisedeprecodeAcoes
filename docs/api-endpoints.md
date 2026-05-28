# Endpoints Serverless

> Cada arquivo em `api/*.ts` é um handler Vercel (export default). Em dev, o
> `vite-api-plugin.ts` intercepta `/api/*` e roda o mesmo handler. Em produção,
> Vercel executa como Function. Não há banco — todos buscam upstream e/ou cacheiam em
> memória da função.

## Tabela rápida

| Rota | Método | Função | Cache |
|---|---|---|---|
| `/api/brapi` | GET | Proxy Yahoo Finance (cotações, fundamentos, busca, chart) | — |
| `/api/ai` | POST | Multi-provider LLM router (Groq/OpenAI/Anthropic/Gemini) | — |
| `/api/macro` | GET | Indicadores macro (BCB SGS + Ibovespa Yahoo) | 5min em memória |
| `/api/news` | GET | Google News RSS por ticker/tópico/query | 30min em memória |
| `/api/world-news` | GET | Agregador GDELT + Google News + Reddit + BBC | 2h em memória (+ cron 2h) |
| `/api/market` | GET | USD/EUR/BTC + ouro/prata mock | 60s em memória |
| `/api/scrape` | GET | Scraping RI: Investidor10 → StatusInvest → Fundamentus | — |
| `/api/fundamentals` | GET | IA estima P/L, ROE, DY quando Yahoo retorna zerado | — |

---

## `/api/brapi` — proxy Yahoo Finance

**Source**: `api/brapi.ts`

### Sub-endpoints (via query `endpoint=...`)

#### `/quote/{TICKER}` — cotação + fundamentos
```
GET /api/brapi?endpoint=/quote/PETR4&modules=financialData
```
- Tickers múltiplos: `/quote/PETR4,VALE3,ITUB4`
- Modules opcionais: `summaryProfile`, `financialData`, `defaultKeyStatistics`
- Range: `range=1d&interval=15m` para chart (default)

**Response success**:
```json
{
  "results": [{
    "symbol": "PETR4",
    "regularMarketPrice": 45.12,
    "regularMarketChangePercent": -0.78,
    "earningsPerShare": 8.2,
    "bookValue": 26.4,
    "financialData": { "returnOnEquity": 0.18, "totalDebt": 2.3e11, ... }
  }],
  "requestedAt": "...",
  "took": "..."
}
```

**Response 404 com sugestões** (ticker errado):
```json
{
  "error": "Ticker \"ITUB2\" não encontrado.",
  "suggestions": [
    { "stock": "ITUB" },
    { "stock": "ITUB3" },
    { "stock": "ITUB4" }
  ]
}
```

> A heurística faz 2 buscas: primeiro literal, depois "stem" (remove dígitos finais).
> Ex.: `ITUB2` → busca `ITUB2` (vazio) → busca `ITUB` → retorna `ITUB3, ITUB4`.

#### `/search?q=...`
```
GET /api/brapi?endpoint=/search&q=petrobras
```
Retorna até 10 sugestões filtradas a `EQUITY`, `ETF`, `INDEX`, `MUTUALFUND`.

### Headers anti-bloqueio

Yahoo bloqueia UA básica. O handler manda **UA Chrome 120 + Referer + Origin +
Sec-Fetch-***. Se começar a aparecer 403 sistemático, é provável que o Yahoo mudou
algo — testar com `curl` no terminal usando os mesmos headers reproduz.

### Erros conhecidos

| Sintoma | Causa | Fix |
|---|---|---|
| Todos os tickers 404 silenciosamente | Yahoo bloqueou IP do edge | Esperar ou trocar de runtime/região |
| 429 | Rate limit Yahoo | Backoff exponencial no cliente — não implementado, hoje só mostra erro |
| Suggestions vazia | Stem ficou igual ao ticker (ex.: "PETR" sem dígito) | Comportamento esperado |

---

## `/api/ai` — multi-provider LLM router

**Source**: `api/ai.ts`

### Request
```
POST /api/ai
Content-Type: application/json

{
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "temperature": 0.6,
  "max_tokens": 700,
  "response_format": { "type": "json_object" },   // opcional, só Groq/OpenAI
  "provider": "groq"                              // opcional, default = env.AI_PROVIDER || "groq"
}
```

### Response
```json
{
  "content": "texto da resposta",
  "provider": "groq"
}
```

### Resolução de provider
1. `request.body.provider` (string)
2. `process.env.AI_PROVIDER`
3. `"groq"` (default)

### Models hardcoded
| Provider | Model | Endpoint upstream |
|---|---|---|
| `groq` | `llama-3.3-70b-versatile` | `https://api.groq.com/openai/v1/chat/completions` |
| `openai` | `gpt-4o` | `https://api.openai.com/v1/chat/completions` |
| `anthropic` | `claude-3-5-sonnet-20241022` | `https://api.anthropic.com/v1/messages` |
| `gemini` | `gemini-1.5-flash` | `https://generativelanguage.googleapis.com/...` |

### Status codes
| Code | Quando |
|---|---|
| 200 | Sucesso |
| 400 | Provider inválido ou `messages` vazio |
| 401 | API key inválida no upstream (mensagem genérica pra não vazar key) |
| 405 | Não-POST |
| 503 | Falta env var do provider escolhido |
| 5xx | Upstream falhou — repassa status original |

---

## `/api/macro` — indicadores macro Brasil

**Source**: `api/macro.ts`

```
GET /api/macro
```

Faz 7 chamadas paralelas ao BCB SGS:

| Código SGS | Indicador | Campo na resposta |
|---|---|---|
| 432 | SELIC meta (% a.a.) | `selicMeta` |
| 4189 | SELIC efetiva 12m acumulada | `selicEfetiva` |
| 433 | IPCA mensal | `ipca` |
| 13522 | IPCA 12m acumulado | `ipca12m` |
| 12 | CDI diário | `cdi` |
| 4391 | CDI 12m acumulado | `cdi12m` |
| 24364 | IBC-Br | `ibcbr` |
| 11753 | IGP-M mensal | `igpm` |

Além disso, busca `^BVSP` no Yahoo para o Ibovespa.

**Response shape**:
```json
{
  "selicMeta": { "valor": 14.5, "data": "2026-05-08" },
  "ipca12m":   { "valor": 4.39, "data": "2026-04-30" },
  "ibov":      { "price": 178200, "changePct": 0.42 },
  ...
}
```

Cache 5min em memória da função.

---

## `/api/news` — Google News RSS

**Source**: `api/news.ts`

```
GET /api/news?ticker=PETR4
GET /api/news?topic=politica       # ou economia, brasil, crise
GET /api/news?q=<texto livre>
```

### Resolução de query para ticker
1. Mapa `TICKER_TO_NAME` (PETR4 → "Petrobras")
2. Adiciona contexto "B3" / "ações"
3. Faz query no Google News RSS

### Response
```json
{
  "items": [
    { "titulo": "...", "link": "https://...", "fonte": "Folha", "publicado": "ISO" }
  ]
}
```

Até 8 manchetes. Cache 30min em memória.

> Se o ticker não tá no mapa, a busca usa o ticker cru — pode retornar lixo. Adicionar
> ao `TICKER_TO_NAME` quando aparecer novo ticker relevante.

---

## `/api/world-news` — agregador global

**Source**: `api/world-news.ts`

```
GET /api/world-news
GET /api/world-news?refresh=1     # força bypass do cache
```

Combina **4 fontes em paralelo**:
1. **GDELT 2.0 Doc API** — eventos políticos com tom (-1 a 1) e países
2. **Google News RSS** multi-país (US, UK, DE, JP, CN)
3. **Reddit r/worldnews** — top do dia (proxy de relevância via upvotes)
4. **BBC RSS politics** — checagem cruzada institucional

Cache **2 horas** em memória + **Vercel Cron** (`vercel.json`) que faz GET a cada 2h
pra manter a função quente.

### Tópicos atuais (`TOPICS` em `api/world-news.ts`)

| Tópico | Foco | Ângulo de arbitragem |
|---|---|---|
| `geopolitica` | Conflitos, tensões, sanções | Conflito → petróleo/ouro/dólar; sanções → exportadoras |
| `politica-eua` | Fed, tarifas, eleições EUA | Fed dovish → fluxo p/ emergentes; tarifas → exportadoras BR sofrem |
| `china` | Estímulos, propriedade, Taiwan | Estímulo → VALE3/CSNA3/GGBR4; crise imobiliária → minério |
| `commodities` | OPEP, minério, soja, café, ouro | OPEP corta → PETR4/PRIO3; minério cai → VALE3 |
| `brasil-fiscal` | Arcabouço, dívida, Congresso | Risco fiscal → dólar sobe, curva DI abre, bancos sofrem |
| `guerra` | Conflitos ativos (Ucrânia, Oriente Médio) | Conflito ativo → petróleo/ouro; cessar-fogo desfaz prêmio de risco |
| `mercado-acoes` | M&A, follow-on, recompra, quedas fortes B3 | M&A/recompra → prêmio direto; follow-on → diluição |

### Estrutura de resposta
```json
{
  "generatedAt": "ISO",
  "refreshIntervalMs": 7200000,
  "source": "GDELT 2.0 + Google News RSS (multi-país) + Reddit + BBC Politics",
  "resumoParaPrompt": "[topic] manchete (fonte) — ângulo...\n...",
  "topics": [
    {
      "topic": "guerra",
      "description": "...",
      "arbitrageAngle": "...",
      "items": [{ "titulo", "link", "fonte", "publicado", "tom?", "origem" }, ...]
    }
  ]
}
```

---

## `/api/market` — strip de cotações macro

**Source**: `api/market.ts`

```
GET /api/market
```

Cotações via Yahoo para `USDBRL=X`, `EURBRL=X`, `BTC-BRL`, `ETH-BRL`. Ouro/prata são
**mock fixo** (`XAUUSD: 2000, XAGUSD: 23`) — fallback honesto até API confiável.

Cache 60s em memória.

**Fallback secundário**: se Yahoo bombou, tenta AwesomeAPI (`economia.awesomeapi.com.br`).
Se ambos falham, devolve 503.

---

## `/api/scrape` — Investor Relations cascateado

**Source**: `api/scrape.ts`

```
GET /api/scrape?ticker=PETR4
```

Tenta 3 fontes em cascata:
1. `investidor10.com.br/acoes/petr4/`
2. `statusinvest.com.br/acoes/petr4`
3. `fundamentus.com.br/detalhes.php?papel=PETR4`

Para cada uma:
- UA Chrome 120 + Referer correto do próprio site (Cloudflare é menos chato)
- Extrai texto removendo `<script>`, `<style>` e tags
- Trunca pra ~12KB (chunk que o LLM consegue digerir)

Retorna o **primeiro** que funcionou + qual fonte foi usada.

> Sintoma comum: todos os 3 retornam Cloudflare challenge HTML — não há fix
> sem proxy residencial. Frontend cai pra usar só `/api/brapi` + `/api/news`.

---

## `/api/fundamentals` — IA estima fundamentos

**Source**: `api/fundamentals.ts`

```
GET /api/fundamentals?ticker=PETR4&price=45.12
```

Chamado **apenas** quando Yahoo retorna P/L, ROE, P/VP e DY todos zerados (heurística
em `useStockQuotes:needsAIFundamentals`). Pede à IA que **estime** os fundamentos
baseado em conhecimento geral. Marca o resultado com `aiEstimated: true` no Stock.

> Não é fonte primária. Não confiar pra decisão real — só pra preencher buracos do
> Yahoo e manter o score calculável.

---

## Padrão de erro em todos

```json
{ "error": "mensagem em português" }
```

Status sempre via HTTP code. Sem campo `code` estruturado — frontend já trata pelo
status (404 → TickerLookupError, 503 → IA não configurada, 429 → rate limit).
