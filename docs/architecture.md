# Arquitetura

> Como o app inicializa, navega entre telas e renderiza modais. Tudo gira em torno de
> `src/App.tsx` que mantém o `screen` state como union type.

## Boot flow

```
main.tsx
  └─ <App /> (src/App.tsx)
       ├─ bootStep = "onboardingA" | "onboardingB" | "login" | "app"
       │    Resolve no useState inicial verificando localStorage:
       │      hasProfile = !!localStorage.getItem("stocks-ai-investor-profile")
       │    Se tem profile → "login"; senão → "onboardingA".
       │
       ├─ Se authenticated=true OU bootStep="app" → renderiza <PraxiaApp />
       ├─ Se bootStep="onboardingA" → <ScreenOnboarding />
       ├─ Se bootStep="onboardingB" → <ScreenOnboardingB />
       └─ Senão → <LoginScreen /> (admin / 1234, placeholder)
```

> Hardcoded em `src/App.tsx:406`: `localStorage.getItem("stocks-ai-investor-profile")`.
> Mas o hook `useInvestorProfile` salva em `praxia-investor-profile` — divergência conhecida.
> Em prática: a primeira vez sempre passa por onboarding porque a chave hardcoded é
> diferente da chave real. **Comportamento atual mantido como tal** (cobre o caso de
> "limpar perfil e voltar pro fluxo de onboarding").

## PraxiaApp — o "miolo"

`PraxiaApp` é o componente que controla todo o app autenticado. Concentra:

- 11 hooks de state global (carteira, perfil, transações, alertas, UI prefs…)
- `screen` state que decide qual tela renderiza
- Modais sempre como **sibling** do conteúdo principal dentro do `<AppShell>`

### Screen union

```typescript
type Screen =
  | "home" | "market" | "stock" | "order" | "review"
  | "activity" | "profile" | "batch" | "alerts"
  | "compare" | "news";
```

Cada valor mapeia 1:1 para um `Screen*` component em
`src/components/praxia/screens/`. A navegação é feita por `setScreen(...)` chamado
das próprias telas via callbacks.

### Telas que mostram a `BottomNav` + FAB

```typescript
const showNav = ["home", "market", "activity", "profile"].includes(screen);
const showFab = showNav;
```

Outras telas (stock detail, order, review, batch, alerts, compare, news) escondem o
nav e o FAB — dão o feedback de "tela full-screen com voltar".

### State de navegação dependente

| State | O que guarda | Vive em |
|---|---|---|
| `activeTicker` | Ticker em foco (Stock Detail / Order / Review) | `App.tsx` |
| `activeFallback` | Snapshot de `Stock` quando o ticker não está na carteira | `App.tsx` |
| `orderDraft` | `{ shares, total, fee, orderType, type }` pendente de revisão | `App.tsx` |
| `quickWatch` | Stock aberta no overlay QuickWatch | `App.tsx` |
| `compareTickers` | Array de tickers selecionados pra comparar (max 4) | `App.tsx` |

> **Padrão**: dados que sobrevivem entre telas vivem em `App.tsx`. Dados internos da
> tela vivem no próprio `Screen*`.

## AppShell — coluna mobile-first

`src/components/praxia/AppShell.tsx` cria a coluna ~440px em desktop, full-width em
phones. Ela é `position: relative` e os modais usam `position: absolute; inset: 0`
pra cobrir o conteúdo **dentro da coluna**.

**Regra crítica**: modal renderizado dentro de scroll container quebra z-index e
gesture handlers. Sempre renderizar como sibling do `Screen*` dentro do `<AppShell>`
(mesmo nível na árvore JSX).

```tsx
<AppShell>
  {screen === "home" && <ScreenHome />}
  {/* outros screens */}

  {/* MODAIS — siblings dos screens, NÃO dentro deles */}
  <QuickWatch open={quickWatch !== null} ... />
  <ChatSheet open={chatOpen} ... />
  <AlertSheet open={alertSheetStock !== null} ... />
  <PortfolioInsightsModal open={insightsOpen} ... />
</AppShell>
```

## Modais ativos hoje

| Modal | Quando abre | Closer |
|---|---|---|
| `<QuickWatch>` | `setQuickWatch(stock)` em Home/Market | `setQuickWatch(null)` |
| `<ChatSheet>` | `setChatOpen(true)` (FAB ou deep-links) | `setChatOpen(false)` |
| `<AlertSheet>` | `setAlertSheetStock(stock)` (botão "Criar alerta") | `setAlertSheetStock(null)` |
| `<PortfolioInsightsModal>` | `setInsightsOpen(true)` (AIInsightCard) | `setInsightsOpen(false)` |

## Erro global

Existe uma faixa de erro no topo do shell (linhas ~192-213 de `App.tsx`) que mostra
qualquer `error` retornado por `useStockQuotes()`. Clicar fecha. Tudo que vem de
`/api/brapi` propagando exceção termina aqui.

## Reset total

`clearAllLocal()` em `App.tsx:164` chama `window.confirm` e remove:
- `stocks-ai-portfolio` (carteira)
- `praxia-pra-chat` (chat)
- `resetProfile()` (perfil)
- `clearTransactions()` (transações)

Depois faz `window.location.reload()` para voltar ao boot flow do zero. Outros caches
(`praxia-alerts`, `praxia-ui-prefs`, etc.) NÃO são limpos — comportamento intencional.

## Pegadinhas conhecidas

1. **Chave de profile divergente** — `App.tsx` checa `stocks-ai-investor-profile`
   (legado) mas `useInvestorProfile` grava em `praxia-investor-profile`. Resultado:
   primeiro login SEMPRE entra em onboarding. Se quiser mudar, alterar nas duas pontas.

2. **`AppShell` é o ponto de referência pra overlay** — se um modal renderiza fora
   dele, vira fullscreen viewport. Cuidado com `Portal`-style.

3. **`activeStock` é derivado do array `stocks`** — se o ticker é vendido (qty=0,
   sem favorito), o `useMemo` cai para `activeFallback` (snapshot). Sem isso, a
   `ScreenStockDetail` quebraria depois de vender 100% da posição.
