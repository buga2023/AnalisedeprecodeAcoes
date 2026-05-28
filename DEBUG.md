# Praxia · Guia de Debug

> Ponto de entrada para investigar problemas no app. Cada seção aponta para um doc
> em `docs/` com o detalhe técnico. Use este arquivo como mapa quando algo quebrar.

## Quando algo quebra — por onde começar

| Sintoma | Onde olhar primeiro | Doc detalhado |
|---|---|---|
| Cotação não atualiza ou ticker dá 404 | `src/lib/api.ts` → `api/brapi.ts` (proxy Yahoo) | [docs/api-endpoints.md](docs/api-endpoints.md) |
| Score errado / valor de Graham estranho | `src/lib/calculators.ts` | [docs/data-flow.md](docs/data-flow.md) |
| IA não responde / retorna 503 | `api/ai.ts` (env var faltando) | [docs/ai-pipeline.md](docs/ai-pipeline.md) |
| IA não segue cadeia notícia→política→ticker | `src/lib/praxiaPrompt.ts` — system prompt mestre | [docs/ai-pipeline.md](docs/ai-pipeline.md) |
| Chat com a Pra perde mensagens / loop | `src/hooks/usePraChat.ts` + `localStorage["praxia-pra-chat"]` | [docs/ai-pipeline.md](docs/ai-pipeline.md) |
| Carteira sumiu / dados corrompidos | `localStorage["stocks-ai-portfolio"]` | [docs/state-and-cache.md](docs/state-and-cache.md) |
| Análise IA por ação não recarrega | Cache 24h em `localStorage["stocks-ai-analysis:{TICKER}"]` | [docs/state-and-cache.md](docs/state-and-cache.md) |
| Tela trava no boot | `src/App.tsx` → checar `bootStep` e `profile` | [docs/architecture.md](docs/architecture.md) |
| Modal aparece atrás do conteúdo | Render dentro de scroll container — deve ser sibling de `AppShell` | [docs/architecture.md](docs/architecture.md) |
| Alerta dispara/não dispara como deveria | `src/hooks/useAlerts.ts` + permissão Notification API | [docs/data-flow.md](docs/data-flow.md) |
| Notícias do mundo sumiram | `/api/world-news` (cron 2h em `vercel.json`) | [docs/api-endpoints.md](docs/api-endpoints.md) |
| Feed de notícias IA não personaliza | `aiNewsFeed.ts` — cache por carteira; verificar `stocks` chegando em `ScreenNews` | [docs/ai-pipeline.md](docs/ai-pipeline.md) |
| Tickers em batch dão erro de coluna | `src/lib/columnMappings.ts` + `src/lib/sheetParser.ts` | [docs/data-flow.md](docs/data-flow.md) |

## Docs detalhados

- **[Arquitetura](docs/architecture.md)** — boot flow, screen routing, padrões de modal, AppShell.
- **[Fluxo de dados](docs/data-flow.md)** — portfólio + polling 60s + score + transações + alertas + batch.
- **[Pipeline de IA](docs/ai-pipeline.md)** — `/api/ai` multi-provider, prompts, citações, perfil, contexto macro/news.
- **[Endpoints serverless](docs/api-endpoints.md)** — referência de cada arquivo em `api/*.ts` com input/output e erros conhecidos.
- **[State e cache](docs/state-and-cache.md)** — 13 chaves do localStorage, TTLs e invalidação.
- **[Módulos](docs/modules.md)** — mapa file-by-file (hooks, lib, componentes, screens, api).
- **[Troubleshooting](docs/troubleshooting.md)** — problemas concretos já vistos + solução.

## Comandos rápidos

```bash
npm run dev          # dev server (Vite + vite-api-plugin pra /api/*)
npm run build        # tsc -b && vite build
npm run lint         # ESLint flat config — baseline ~17 errors any em libs legadas
npm run preview      # serve dist/ local

# Smoke test endpoints (dev server rodando)
curl -s "http://localhost:5173/api/brapi?endpoint=/quote/PETR4" | head -c 200
curl -s "http://localhost:5173/api/macro" | head -c 200
curl -s -X POST "http://localhost:5173/api/ai" -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"oi"}],"max_tokens":50}'
```

## Env vars necessárias (dev e Vercel)

```bash
GROQ_API_KEY=...           # default; tem free tier
# opcional:
OPENAI_API_KEY=...         # gpt-4o
ANTHROPIC_API_KEY=...      # claude-3-5-sonnet
GEMINI_API_KEY=...         # gemini-1.5-flash
AI_PROVIDER=groq           # sobrescreve default
```

Sem nenhuma key, `/api/ai` retorna **503** com mensagem clara.

## Estrutura mínima do projeto (pós-limpeza)

```
AnalisedeprecodeAcoes/
├── api/                # serverless Vercel (handler default por arquivo)
├── docs/               # docs de debug (você está aqui)
├── public/             # static (só template-carteira.csv)
├── src/
│   ├── App.tsx         # screen state + routing
│   ├── main.tsx
│   ├── index.css       # tokens base + animações
│   ├── components/
│   │   ├── LoginScreen.tsx
│   │   └── praxia/     # tudo da UI bespoke
│   ├── hooks/          # 11 hooks (state + side-effects)
│   ├── lib/            # cálculos puros + clients de API
│   └── types/stock.ts  # tipos canônicos
├── .praxia-design/     # bundle de referência (NÃO vai pro bundle final)
├── CLAUDE.md           # instruções para Claude Code
├── PONTO.md            # estado do projeto v0 Engraved
├── ROADMAP.md          # features planejadas
├── ANALISE_SCREEN.md   # plano de tela Analysis
└── DEBUG.md            # este arquivo
```
