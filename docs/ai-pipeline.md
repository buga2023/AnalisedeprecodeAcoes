# Pipeline de IA

> Tudo que envolve a Pra (chat), análise por ação, insights de portfólio e comparação
> de ações. Todas as chamadas passam por `POST /api/ai` — keys ficam SÓ no servidor.

## System prompt mestre — `src/lib/praxiaPrompt.ts`

A Praxia tem **um único system prompt mestre** (`PRAXIA_SYSTEM_PROMPT`) que é
enviado como `role: "system"` em TODAS as 6 capacidades de IA. Ele segue as
boas práticas oficiais da Anthropic:

- **XML tags estruturais**: `<role>`, `<context_received>`, `<reasoning_chain>`, `<transmission_chains>`, `<arbitration_mandate>`, `<three_questions>`, `<rules>`, `<examples>`, `<output_format>`
- **3 exemplos few-shot** diversos cobrindo: guerra→petróleo, mudança SELIC, M&A corporativo
- **Chain of thought obrigatório** via tag `<thinking>` antes de cada resposta
- **Output format explícito** distinguindo modo "chat" (texto livre) de modo "json"
- **Role bem definido** no início — não é um chatbot, é uma analista

### Cadeia de raciocínio que a Pra segue em todo prompt

```
INFO RECEBIDA (manchete, dado macro, fato corporativo)
       ↓
IMPACTO POLÍTICO  (postura de gov BR, Fed, Congresso, OPEP, China?)
       ↓
IMPACTO MACRO  (SELIC, dólar, petróleo, minério, prêmio de risco?)
       ↓
IMPACTO SETORIAL  (aplica uma das 8 transmission_chains)
       ↓
TICKER ESPECÍFICO  (priorize quem o usuário TEM em carteira)
       ↓
AÇÃO CONCRETA  (criar alerta / reduzir / aumentar / sem ação imediata)
```

### Helpers de contexto

`praxiaPrompt.ts` exporta 4 utilitários para os user prompts:
- `describeProfileLine(profile)` — frase normalizada com perfil
- `describePortfolioLine(stocks)` — lista compacta de carteira com prioridade
- `JSON_ONLY_SUFFIX` — sufixo pra reforçar "responda só JSON"
- `CHAT_OUTPUT_SUFFIX` — sufixo pra modo chat (thinking + texto + Fontes)

### Onde é aplicado

| Capacidade | Arquivo | Modo de output |
|---|---|---|
| Chat com a Pra | `usePraChat.ts` | chat (texto livre + `<thinking>` + Fontes) |
| Análise per-stock | `ai.ts:analisarAcaoComIA` | JSON |
| Insights portfólio | `ai.ts:fetchAIInsights` | JSON |
| Comparação | `ai.ts:compararAcoesComIA` | JSON |
| Resumo por tópico | `aiNews.ts:resumirNoticiasComIA` | JSON |
| Feed personalizado | `aiNewsFeed.ts:analisarNoticiaParaCarteira` | JSON |

## Visão geral

```
Cliente (browser)
    │  POST /api/ai
    │  { messages, temperature, max_tokens, response_format?, provider? }
    ▼
api/ai.ts (multi-provider router)
    │
    ├─ Resolve provider: body.provider → env.AI_PROVIDER → "groq" (default)
    ├─ Lê key: GROQ_API_KEY | OPENAI_API_KEY | ANTHROPIC_API_KEY | GEMINI_API_KEY
    ├─ Sem key → 503 com mensagem clara
    └─ Encaminha pra handler:
         handleGroq      → https://api.groq.com/openai/v1/chat/completions   (llama-3.3-70b)
         handleOpenAI    → https://api.openai.com/v1/chat/completions        (gpt-4o)
         handleAnthropic → https://api.anthropic.com/v1/messages             (claude-3-5-sonnet-20241022)
         handleGemini    → https://generativelanguage.googleapis.com/...     (gemini-1.5-flash)
    │
    ▼
Resposta normalizada: { content: string, provider: string }
```

> Anthropic exige separar `system` de `messages` — `handleAnthropic` faz isso por você.

## 6 capacidades de IA

| Capacidade | Hook / função | UI | Cache |
|---|---|---|---|
| Chat com a Pra (conversacional + elicitação de perfil) | `usePraChat` | `ChatSheet` (modal via FAB) | `praxia-pra-chat` (persistente) |
| Análise per-stock (COMPRAR/SEGURAR/VENDER + red flags + resumo trimestral) | `analisarAcaoComIA` (`src/lib/ai.ts`) | `StockAIAnalysisSection` | `stocks-ai-analysis:{TICKER}` (24h) |
| Insights do portfólio (4-8 cards + sentimento) | `fetchAIInsights` (`src/lib/ai.ts`) | `PortfolioInsightsModal` | `stocks-ai-portfolio-insights` (6h, por signature) |
| Comparação de 2-4 ações | `compararAcoesComIA` (`src/lib/ai.ts`) | `ScreenCompare` | `stocks-ai-comparison:{TICKERS}` (6h) |
| Resumo de tópico de notícias (agregado) | `resumirNoticiasComIA` (`src/lib/aiNews.ts`) | `ScreenNews` modo "Tópicos" | `praxia-news-summary:{topic}` (2h por signature de manchetes) |
| Análise por notícia + carteira (Feed) | `analisarNoticiaParaCarteira` (`src/lib/aiNewsFeed.ts`) | `NewsFeedCard` em `ScreenNews` modo "Feed" | `praxia-news-feed-analysis:{hash}` (24h por URL + carteira) |

Outras chamadas IA usadas como suporte (não direto na UI):
- `fetchFundamentalsFromAI` — preenche fundamentos quando Yahoo retorna zerado

## Feed personalizado de notícias

`src/lib/aiNewsFeed.ts:analisarNoticiaParaCarteira(item, profile, stocks, topicLabel?)`

Diferente do resumo de tópico (`aiNews.ts`), essa função analisa **uma notícia
individual** cruzando com a carteira atual do usuário. Útil pra responder "como ISSO
mexe com MEUS ativos especificamente".

### Input no prompt
- Manchete completa + fonte + URL + data + tom GDELT (quando há)
- Perfil do usuário (risco + horizonte)
- Lista compacta da carteira (`TICKER (qty=N, preço R$X, var%, score)`)
- Tópico atribuído pelo agregador (`guerra`, `mercado-acoes`, `commodities`, etc.)

### Output JSON (validado e normalizado no cliente)
```typescript
{
  tese: string;                  // 2-3 frases iniciando por "Pelo seu perfil X..."
  tickersImpactados: [{
    ticker: "PETR4",
    direcao: "ganha" | "perde" | "neutro",
    intensidade: 1 | 2 | 3,       // 1=leve, 2=relevante, 3=forte
    motivo: string,
    emCarteira: boolean,           // sobrescrito no cliente — fonte da verdade é stocks[]
  }],
  acaoSugerida: string,            // "criar alerta em X..." | "sem ação imediata"
  categoria: "guerra" | "queda-acoes" | "ma-corporativo" | "macro" | "setor" | "outro",
  fontes: string[];                // URL da notícia obrigatória; "Yahoo Finance"/"cálculo do app" se aplicável
}
```

### Cache
- Chave: `praxia-news-feed-analysis:{djb2-hash da URL}`
- TTL: 24h
- Signature: tickers da carteira ordenados (mudou de carteira → análise antiga continua válida pra mesma URL; só recalcula em refresh manual ou TTL expirado)

### Pegadinhas
- IA pode quebrar o contrato do JSON — o código tem defesas (`normalized`) que
  garantem tipos e valores default.
- `emCarteira` retornado pela IA é **ignorado** — o cliente reescreve baseado nos
  `stocks` reais. Evita IA inventar que tem ticker que o usuário não tem.
- Sort: em-carteira primeiro, depois maior intensidade. Garantia visual de que
  o usuário vê os tickers dele em destaque.

## Chat — `usePraChat`

`src/hooks/usePraChat.ts`

### Estado
- `messages` em `localStorage["praxia-pra-chat"]` — persiste entre sessões
- `thinking` boolean — flag de loading durante chamada

### Prompt system — montado em `buildSystemPrompt`

Concatena 8 blocos:
1. **Personalidade** — `tone === "formal"` → tom profissional; `casual` → tom amiga.
2. **Idioma** — "Responda em portugues brasileiro."
3. **Tamanho** — "Respostas curtas (2-4 frases), análise (4-8 frases) com fontes no final."
4. **Profile summary** — risco/horizonte/interesses ou "ainda não definido".
5. **Portfolio summary** — `Patrimonio R$ X. Ativos (N): TICKER (preço, var, P/L, P/VP, DY, ROE, Score, Graham, MoS); ...`
6. **Strategy mission** — "Seu papel: ajudar o usuário a planejar estratégias…"
7. **Profile rule** — Sem perfil: descobrir em até 3 perguntas + emitir marker. Com perfil: TODA recomendação começa por "Pelo seu perfil X…"
8. **Source rule** — citações `[1]` `[2]` no corpo + bloco "Fontes:" no final.

### Marker `[PROFILE]...[/PROFILE]`

Quando `profile === null`, a Pra é instruída a perguntar 3 coisas e emitir:

```
[PROFILE]{"risk":"low|mid|high","horizon":"short|mid|long","interests":["div|gro|esg|tec"]}[/PROFILE]
```

`tryExtractProfile` no hook:
1. Regex extrai o JSON
2. Valida campos contra os enums
3. Se válido → chama `onProfileDetected(draft)` (que salva via `useInvestorProfile`)
4. Remove o marker do texto antes de mostrar pro usuário

> Se a Pra entrou em loop perguntando perfil, abre o devtools, busca `[PROFILE]` no
> texto bruto do response — se o JSON tá quebrado (vírgula final, aspas), a regex
> falha silenciosa e o user não vê fim.

### Fallback offline

Se `/api/ai` retorna erro (503/timeout/etc.), `fallbackReply(userMsg)` devolve um
texto canned com base em keywords (`dividend`, `risco`, `rebalance`). O erro original
aparece em parênteses no final pra debug.

## Análise por ação — `analisarAcaoComIA`

`src/lib/ai.ts:analisarAcaoComIA` (assinatura completa lá)

```
Input: stock, profile
       │
       ├─ coletarDadosRI(ticker)    → /api/scrape (Investidor10 → StatusInvest → Fundamentus)
       ├─ fetchMacroContext()       → /api/macro (Banco Central SGS + Ibovespa)
       ├─ fetchTickerNews(ticker)   → /api/news?ticker=X (Google News RSS)
       └─ describeProfile(profile)  → string para o prompt
       │
       ▼
buildContextBlock(macro, news[]) → string consolidada
       │
       ▼
prompt + SOURCE_AND_PROFILE_RULES + dados de RI
       │
       ▼
POST /api/ai (response_format: json_object)
       │
       ▼
AnaliseIA: {
   resumoTrimestral, recomendacao: "COMPRAR"|"SEGURAR"|"VENDER",
   justificativa, redFlags[], comparacaoTrimestre, periodoAnalisado, fonte, fontes[]
}
       │
       ▼
Cache em localStorage["stocks-ai-analysis:PETR4"] por 24h
```

## Insights do portfólio — `fetchAIInsights`

Mesmo padrão. Coleta em paralelo:
1. Macro (`fetchMacroContext`)
2. Notícias políticas (`fetchTopicNews("politica")`)
3. Notícias econômicas (`fetchTopicNews("economia")`)
4. World news (`fetchWorldNews` — `/api/world-news`)

Retorna `AIResponse`:
```typescript
{
  insights: AIInsight[];           // 4-8 cards com tipo (alta|baixa|neutro|alerta)
  resumo: string;                  // 2-3 frases
  sentimento: "otimista" | "pessimista" | "neutro";
  fontes: string[];                // URLs + rótulos
}
```

Cache em `stocks-ai-portfolio-insights` (6h). **Invalidação**: a "signature" do
portfólio é `ticker:quantity|ticker:quantity|...` — se algo muda, o cache é
descartado mesmo dentro das 6h.

## Regras inegociáveis do prompt (`SOURCE_AND_PROFILE_RULES`)

`src/lib/ai.ts:76` — bloco copiado em TODOS os prompts:

1. **Enquadramento**: "Você gera SUGESTÕES com fonte para paper trading. Decisão é do usuário."
2. **Perfil obrigatório**: "TODA sugestão DEVE começar por 'Pelo seu perfil X…'."
3. **Fontes por afirmação fatual**:
   - URL completa de notícia (vinda do bloco "NOTICIAS RECENTES")
   - URL de RI / B3 / CVM
   - "Yahoo Finance" → preço/histórico/fundamentos
   - "Banco Central do Brasil (SGS)" → SELIC/IPCA/CDI/IBC-Br/IGP-M
   - "calculo do app" → Graham, score, margem
   - "perfil do usuario" → quiz
4. **Sem fonte** → escrever "(sem fonte verificavel)" e NÃO afirmar o fato
5. **Numerar** `[1]` `[2]`… matching com o array `fontes`
6. **Sempre encerrar** lembrando que a decisão é do usuário

Sintoma de violação: resposta sem `Fontes:` no final, ou recomendação sem prefixo
"Pelo seu perfil…". Geralmente isso vem de prompt mal-construído (faltou o bloco)
ou o LLM ignorou — abaixar a `temperature` ajuda.

## `response_format: json_object` (só OpenAI + Groq)

Quando o cliente passa `response_format: { type: "json_object" }`, a chamada exige
JSON estruturado do LLM. Anthropic e Gemini IGNORAM esse campo — a resposta pode
vir como texto livre que precisa ser parseado manualmente. Está documentado em
`api/ai.ts:46`.

## Custos / providers

| Provider | Modelo | Custo aproximado | Latência típica |
|---|---|---|---|
| Groq (default) | llama-3.3-70b-versatile | Free tier generoso | ~1-2s |
| OpenAI | gpt-4o | ~$5/1M input, $15/1M output | ~2-4s |
| Anthropic | claude-3-5-sonnet-20241022 | ~$3/1M input, $15/1M output | ~3-5s |
| Gemini | gemini-1.5-flash | Free tier 15 RPM | ~2-3s |

> Groq é o default por conta do free tier — sem cartão, sem cobrança surpresa. Para
> análises mais profundas (per-stock) considere subir `AI_PROVIDER=anthropic` em
> produção.

## Debug rápido

| Sintoma | Onde olhar |
|---|---|
| "IA nao configurada" / 503 | Falta env var `<PROVIDER>_API_KEY`. Verifica `.env.local` e Vercel Dashboard. |
| Resposta sem citações | Prompt não inclui `SOURCE_AND_PROFILE_RULES`. Conferir o que vai em `messages[0].content`. |
| Pra entra em loop perguntando perfil | Marker `[PROFILE]` malformado — buscar regex `/\[PROFILE\][\s\S]*?\[\/PROFILE\]/` na resposta. |
| JSON parse error nas análises | LLM devolveu texto fora do JSON. Aumentar `max_tokens` ou abaixar `temperature` pra 0.3. |
| Análise mesma toda vez (não atualiza) | Cache de 24h ainda válido. Em devtools: `delete localStorage["stocks-ai-analysis:PETR4"]`. |
| Insights do portfólio não recarregam | Signature não mudou. Adicionar/remover ticker força refresh. |
