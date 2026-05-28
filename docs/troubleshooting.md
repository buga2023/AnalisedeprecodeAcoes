# Troubleshooting

> Problemas concretos já vistos no projeto + como resolver. Lista vai crescendo
> conforme novos bugs apareçam — adicione quando identificar um padrão.

## Cotações / API

### "Ticker XYZ não encontrado" mesmo o ticker existindo
**Causa provável**: Yahoo Finance bloqueando UA ou IP da função.

**Como verificar**:
```bash
curl -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
     -H "Referer: https://finance.yahoo.com/" \
     "https://query1.finance.yahoo.com/v8/finance/chart/PETR4.SA"
```

Se o curl direto também devolve erro: é o Yahoo, não o app. Espere ou troque a região
da função no Vercel.

### Todos os tickers BR ficam zerados (P/L=0, ROE=0…)
**Causa**: Yahoo às vezes não retorna `financialData` para algumas ações BR fora de
horário de pregão.

**Comportamento atual**: o app detecta via `needsAIFundamentals` e chama
`/api/fundamentals` para a IA estimar. Marca o `Stock` com `aiEstimated: true`.

**Fix manual**: se a estimativa estiver muito errada, editar valores via Order Review
ou adicionar override no `addStock(ticker, cost, qty, { lpa, vpa })`.

### Banner de erro "Limite de requisições atingido"
**Causa**: Yahoo 429 — geralmente rajada de busca em batch.

**Mitigação atual**: nenhuma. O usuário precisa esperar ~5-10min.

**Fix futuro**: backoff exponencial em `fetchMultipleQuotes` + cache em memória no
proxy `/api/brapi`.

## IA

### `/api/ai` retorna 503
**Causa**: falta env var `<PROVIDER>_API_KEY` no servidor.

**Fix**:
1. Criar `.env.local` na raiz com `GROQ_API_KEY=...` (grátis em groq.com)
2. Reiniciar `npm run dev`
3. Em produção: configurar no **Vercel Dashboard → Project → Settings → Environment Variables**

### Pra responde sem citações (sem bloco "Fontes:")
**Causa**: LLM ignorando o prompt — comum em modelos pequenos com `temperature` alta.

**Fix**:
- Abaixar `temperature` de `0.7` para `0.3-0.4` na chamada
- Trocar de provider (Anthropic/OpenAI seguem melhor instruções estruturadas)
- Verificar se `SOURCE_AND_PROFILE_RULES` está sendo incluído no prompt (debug
  no devtools mostra o `messages[]` enviado)

### Pra entra em loop perguntando perfil mesmo já existindo
**Causa**: cache do chat (`praxia-pra-chat`) tem mensagens antigas + a Pra perdeu
contexto na nova chamada.

**Fix**: zerar a conversa em `ChatSheet` (botão "Nova conversa") ou:
```js
localStorage.removeItem("praxia-pra-chat")
```

### `[PROFILE]{}[/PROFILE]` aparece literal no chat
**Causa**: regex em `usePraChat:tryExtractProfile` não casou. JSON malformado
(vírgula final, aspas erradas, campos extras) faz o parse falhar silenciosamente —
o marker fica visível ao invés de ser removido.

**Como verificar**: copiar o JSON do marker e rodar `JSON.parse(...)` no devtools.

**Fix**: ajustar o prompt pra reforçar o formato exato (ver `usePraChat:62`).

### Análise IA por ação volta sempre igual
**Causa**: cache de 24h ativo. Esperado.

**Forçar refresh**:
```js
delete localStorage["stocks-ai-analysis:PETR4"]
```

E clicar de novo em "Carregar análise".

## State / localStorage

### Carteira sumiu depois de mudança no schema
**Causa**: `Stock` mudou de shape, `JSON.parse` falha, hook devolve `[]`.

**Recuperação**: dados estão perdidos (não há backup). Para o futuro: validar shape
antes de retornar e migrar quando possível.

### Modal abre atrás do conteúdo
**Causa**: modal foi colocado dentro de um scroll container ou de um screen.

**Fix**: renderizar como **sibling** dentro do `<AppShell>` em `App.tsx`. Vide
`docs/architecture.md` → "Modais ativos hoje".

### Primeiro login sempre cai em onboarding
**Causa**: divergência entre as chaves `stocks-ai-investor-profile` (lida em
`App.tsx:406`) e `praxia-investor-profile` (escrita pelo hook).

**Comportamento atual**: mantido intencional — primeiro acesso sempre vê o pitch.

**Fix se quiser pular**: alinhar as duas chaves para `praxia-investor-profile`.

## Alertas

### Notification API não dispara
**Verificações**:
1. `Notification.permission === "granted"`? No devtools: `Notification.permission`
2. Permissão pedida no momento certo? `requestPermission()` só roda lazy quando
   o usuário cria o primeiro alerta — se ele negou, fica "denied" pra sempre
3. Browser permite Notification em HTTP? Em `localhost` sim, em produção exige HTTPS

**Fix**: chrome://settings/content/notifications → reset pro localhost.

### Alerta de margem Graham nunca dispara
**Possível bug**: `useAlerts.matches` multiplica `calculateMarginOfSafety()` por 100,
mas a função já retorna percentual. Ex.: margem real de 24% vira 2400 na comparação
contra `alert.value` (que vem como 20). Sempre passa, na verdade — vai acabar
disparando.

**Pegadinha oposta**: se você criou alerta no padrão antigo (valor em fração 0.2),
ele dispara sempre. Padrão atual espera valor em % (20 = 20%).

**Fix**: avaliar se quer normalizar pra fração ou pra %. Hoje o comportamento é
inconsistente.

## Build / dev

### `npm run build` falha com erro TS de import .ts
**Causa**: `verbatimModuleSyntax: true` em `tsconfig.app.json` exige `import type`
para tipos.

**Fix**:
```typescript
// Antes
import { Stock } from "@/types/stock";

// Depois
import type { Stock } from "@/types/stock";
```

### `npm run dev` não serve `/api/*`
**Causa**: `vite-api-plugin.ts` não está em `vite.config.ts`.

**Verificação**: `vite.config.ts` deve ter `viteApiPlugin()` no array de `plugins`.

### Lint mostra `~17 errors any` no baseline
**Esperado**. São libs legadas em `src/lib/api.ts`, `sheetParser.ts`, etc. Não bloqueia
build. Não introduzir **novos** `any` em código novo.

### Tailwind classes não aparecem
**Causa**: Tailwind v4 carrega do `@import "tailwindcss"` no `src/index.css`. Se você
deletar essa linha, nada de Tailwind funciona.

**Note**: maioria dos componentes do Praxia usa **inline styles + PraxiaTokens**, não
Tailwind. Se você espera uma classe utility funcionando, confirma que ela existe no
v4 (algumas mudaram do v3).

## Vercel / produção

### `vercel.json` com cron mas o cron não roda
**Causa**: cron exige plano **Pro** no Vercel. Free plan ignora.

**Fix**: usar UptimeRobot ou GitHub Action cron fazendo `curl` na rota.

### Função timeout em produção
**Default Vercel Free**: 10s. Free **Hobby**: também 10s.

**Culpados típicos**: `/api/scrape` (Cloudflare lento), `/api/world-news` (4 fontes
em paralelo). Cada upstream tem `AbortController` com timeout de 5-7s — se uma fonte
trava, ela aborta mas as outras continuam.

**Fix se persistir**: dividir em sub-rotas ou subir pra Pro (60s).

## Como adicionar uma nova entrada nesse doc

Padrão:
```
### <Sintoma observável pelo usuário ou erro literal>
**Causa**: descrição da raiz.
**Como verificar**: comando/console snippet pra confirmar.
**Fix**: passos concretos.
```

Manter ordem aproximada por subsistema (Cotações, IA, State, etc.). Quando uma entrada
deixar de ser válida (fix mergeado), remover (Git mantém histórico).
