# Praxia · PONTO.md (v0 — Engraved)

> Estado do projeto em **2026-05-14**. Marca v0 "Engraved" implementada — paleta onyx/vellum/champagne gold + tipografia serif (Cormorant). Build limpo, todos os endpoints respondendo, todas as features anteriores intactas.

---

## 0. O que mudou da v1.0 → v0 (Engraved)

A linha visual anterior (navy + indigo elétrico, sans-serif Sora) foi substituída pela direção **01 Engraved** da exploração de marca (`Praxia Brand.html`), recomendada nos termos do briefing **BTG/XP — alma de private banking + clareza de fintech moderna, sem ícones genéricos, sem tech-cold**.

### Diff visual

| Dimensão | v1.0 (Navy) | **v0 (Engraved)** |
|---|---|---|
| Fundo | `#05071a` deep navy | **`#0a0a10` onyx warm** |
| Acento | `#5b7cff` indigo elétrico | **`#c8a25c` champagne gold** |
| Texto | `#ffffff` puro | **`#f4ecdf` parchment warm** |
| Display | Sora 600 (sans-serif geometric) | **Cormorant Garamond / SC 500 (serif clássico)** |
| Wordmark | "Praxia" sans-serif + ponto azul | **"PRAXIA" small-caps tracked + filete dourado abaixo** |
| Mark | Disco com "P" + spark dot indigo | **Selo circular dourado + "P" em Cormorant** |
| Semântica | Verde neon, vermelho rosa, âmbar | Verde-sálvia, vermelho-tijolo, dourado |
| Detalhes | Glow azul radial + film grain | **Halo dourado discreto + textura pergaminho + corner marks editoriais** |
| Modo claro | Não existia | **Vellum `#f1eadb` disponível como paper inverso** |

### Por que "v0" (e não v2)

A direção Engraved é o **rebrand fundacional** — a base sobre a qual todo o resto será iterado daqui pra frente. Tudo que vier depois (v0.1, v0.2…) refina dentro dessa direção. A v1.0 anterior foi um draft visual que ficou genérico ("muito tech genérico", nas palavras do próprio briefing); essa versão é a marca **escolhida**, com personalidade.

---

## 1. Identidade Engraved — referência rápida

### Paleta canônica

```css
/* Onyx — superfícies escuras */
--bg:         #0a0a10   /* near-black, leve calor */
--bg-deep:    #06060a   /* gradiente externo */
--surface:    #13110d   /* marrom-escuro para depth */
--surface-2:  #1a1610

/* Vellum / Paper — modo claro / inversão */
--paper:      #f1eadb
--paper-ink:  #1a1610   /* espresso brown-black */

/* Ink — texto sobre escuro */
--ink:        #f4ecdf   /* parchment warm white */
--ink-70:     rgba(244,236,223,0.72)
--ink-50:     rgba(244,236,223,0.52)
--ink-30:     rgba(244,236,223,0.30)

/* Gold — único acento */
--gold:       #c8a25c   /* champagne discreet */
--gold-dim:   rgba(200,162,92,0.55)
--gold-faint: rgba(200,162,92,0.20)

/* Semantic — sóbrio */
--up:         #7fb796   /* verde-sálvia */
--down:       #c87371   /* vermelho-tijolo */
--warn:       #c8a25c   /* dourado = warn */
```

### Tipografia

| Token | Fonte | Uso |
|---|---|---|
| `T.display` | Cormorant Garamond | Headlines, números grandes (patrimônio, preço) |
| `T.displaySC` | Cormorant SC | Wordmark "PRAXIA" tracked |
| `T.displayAlt` | Playfair Display | Variações com personalidade (Onboarding II) |
| `T.body` | Manrope | Corpo, copy, UI |
| `T.mono` | JetBrains Mono | Metadata, números pequenos, tickers |

Pesos: 400/500/600. **500 é o padrão para Cormorant** — render mais consistente que 600.

### Marca

- **Wordmark (`<PraxiaLogo>`):** `PRAXIA` em Cormorant SC tracked + filete dourado (linha-diamante-linha) abaixo. Em escalas < 12px, esconde o filete via `hideRule`. Modo `iconOnly` vira um "P" serifado com ponto dourado.
- **Mark (`<PraMark>`):** Selo circular `1px gold` + filete interno `0.5px gold` + "P" em Cormorant ao centro. Substitui o monograma indigo anterior. Reaproveita o `SealMark` da brand exploration.

### Detalhes editoriais

- **Filete dourado curto** (`width: 36px, height: 1px, gold + diamond + gold`) abaixo de cada headline grande
- **Corner marks** (1px gold-faint, 10px length) nos 4 cantos do background — referência de página de catálogo
- **Numerais romanos faded** (II grande em italic, opacity 0.045) atrás do Onboarding II
- **Texturas:** grade tipográfica 48×48 + turbulência cor pergaminho (mix-blend overlay)

---

## 2. Stack (sem mudança)

| Camada | Escolha |
|---|---|
| UI | React 19 SPA, screen state em `App.tsx` |
| Bundler | Vite 7 + `@vitejs/plugin-react` |
| Styling | Tailwind v4 (utilities) + inline com `PraxiaTokens` (bespoke) |
| Tipos | TypeScript 5.9, strict |
| Linting | ESLint 9 flat + typescript-eslint + react-hooks |
| Serverless | Vercel Functions (`api/*.ts`) + `vite-api-plugin.ts` em dev |
| Persistência | `localStorage` (13 chaves, sem backend) |
| Fontes | Cormorant Garamond + SC + Playfair Display + EB Garamond + Manrope + JetBrains Mono |

### Build atual

- `npm run build` → **OK**, 831 KB / 265 KB gzip, 94 modules
- `npm run lint` → 18 erros (todos `any` legados em libs de I/O) + 1 warning fast-refresh em `Citations.tsx` — sem regressão da v1.0

---

## 3. Boot flow (sem mudança funcional)

```
App
  ├─ bootStep tem profile no localStorage?
  │    ├─ sim → "login"
  │    └─ não → "onboardingA"
  ├─ "onboardingA"   → ScreenOnboarding  (Cormorant + halo gold)
  ├─ "onboardingB"   → ScreenOnboardingB (Numeral romano II, dourado discreto)
  ├─ "login"         → LoginScreen        (admin/1234)
  └─ "app"           → PraxiaApp
                       └─ profile == null → ScreenQuiz
                          Depois → screen state navegável
```

---

## 4. Screens (todas roteadas em `App.tsx`)

Sem mudança de estrutura — apenas inheritance da nova paleta via tokens.

| Screen | Função | Toques específicos do rebrand |
|---|---|---|
| `ScreenOnboarding` | Pitch — pílula creme + headline italic gold | **Refeito do zero** |
| `ScreenOnboardingB` | Numeral romano II atrás + pílula gold | **Refeito do zero** |
| `LoginScreen` | Login com headline "Bem-vindo *de volta*" italic gold + filete | Headline trocado |
| `ScreenQuiz` | Quiz 3 etapas | Texto preto sobre fundo claro → onyx |
| `ScreenHome` | Patrimônio, hero, AI insight, posições, alocação | Inherits palette via tokens |
| `ScreenMarket` | Tabs + discovery + busca com sugestões | Inherits |
| `ScreenStockDetail` | Gráfico, análise, IA, relatórios trimestrais | Inherits |
| `ScreenOrder` / `ScreenOrderReview` | Quantidade + tipo + revisão | Inherits |
| `ScreenActivity` | Histórico de transações | Inherits |
| `ScreenProfile` | Cor accent + tom Pra + batch + clear | Accent options trocadas para 5 tons gold/brass |
| `ScreenBatchValuation` | CSV/Excel → Bazin/Graham/GrahamG em lote | Inherits |
| `ScreenAlerts` | Lista de alertas | Inherits |
| `ScreenCompare` | Comparação lado-a-lado IA | Inherits |

Modais (sem mudança funcional, palette atualizada):
- `ChatSheet` — sheet IA (gradiente surface→bg onyx)
- `QuickWatch` — preview ativo (gradiente onyx)
- `AlertSheet` — wizard alerta (gradiente onyx)
- `PortfolioInsightsModal` — Análise IA com macro strip (gradiente onyx)

---

## 5. Hooks (sem mudança)

| Hook | Estado | Persistência |
|---|---|---|
| `useStockQuotes` | Carteira, polling 60s, transações | `stocks-ai-portfolio` |
| `useInvestorProfile` | risk/horizon/interests | `praxia-investor-profile` |
| `useTransactions` | Histórico de paper trades | `praxia-transactions` |
| `useAlerts` | Alertas + Notification API + engine de match | `praxia-alerts` |
| `useUIPreferences` | accent + tone | `praxia-ui-prefs` |
| `useAIProvider` | Provider IA (dormente) | `stocks-ai-provider-config` |
| `usePraChat` | Mensagens + marker `[PROFILE]` | `praxia-pra-chat` |
| `useRelatorios` | Relatórios trimestrais | `stocks-ai-relatorios` |
| `useMarketQuotes` | Cotações macro strip | — |
| `useStockSearch` | Search debounced (dormente) | — |
| `useBatchValuation` | Importação em lote | `stocks-ai-batch-valuation` |

---

## 6. Endpoints serverless (`api/*.ts`)

Todos validados via curl no dev server pós-rebrand (2026-05-14):

| Endpoint | Status | Resposta |
|---|---|---|
| `GET /api/brapi?endpoint=/quote/PETR4` | ✅ 200 | PETROBRAS PN R$ 45 + histórico |
| `GET /api/brapi?endpoint=/quote/ITUB2` | ✅ 404 com `suggestions` corretas | `[ITUB, ITUB3, ITUB4, ...]` |
| `GET /api/brapi?endpoint=/search&q=...` | ✅ 200 | filtrado por EQUITY/ETF/INDEX/MUTUALFUND |
| `GET /api/macro` | ✅ 200 | SELIC 14.5% / IPCA12m 4.39% / IBOV 178k |
| `GET /api/news?topic=politica` | ✅ 200 | manchetes BBC + Folha |
| `GET /api/news?ticker=PETR4` | ✅ 200 | manchetes Petrobras |
| `GET /api/scrape?ticker=PETR4` | ✅ 200 | Investidor10 conteúdo |
| `POST /api/ai` | ✅ 200 | Groq Llama 3.3 70B responde |
| `GET /api/market` | ✅ 200 | USD/EUR + metais mock |

### Headers de browser realistas

`api/brapi.ts` e `api/scrape.ts` usam UA Chrome 120 + Referer/Origin + Sec-Fetch-* para reduzir bloqueio dos upstreams.

### Sugestões inteligentes

Quando `/quote/X` retorna vazio do Yahoo, o endpoint tenta `fetchYahooSearch(X)` filtrado a EQUITY/ETF; se ainda vazio, faz busca relaxada pelo **stem** (remove dígitos finais) → `ITUB2` → sugere `ITUB3, ITUB4`.

---

## 7. Sistema de IA (Pra) — sem mudança de comportamento

3 capacidades, todas em `/api/ai`:

| Capacidade | UI | Cache |
|---|---|---|
| Chat conversacional + elicitação de perfil | `ChatSheet` (modal via FAB) | `praxia-pra-chat` |
| Análise per-stock (COMPRAR/SEGURAR/VENDER + redflags) | `StockAIAnalysisSection` | 24h por ticker |
| Insights de portfólio (4–8 cards + sentimento) | `PortfolioInsightsModal` | 6h por signature |
| Comparação 2–4 ações | `CompareTable` no `ScreenCompare` | 6h |

### Contexto injetado em cada prompt

Cada chamada coleta em paralelo:
1. **Macroindicadores** (`fetchMacroContext` → `/api/macro`) — SELIC, IPCA, CDI, IBC-Br, IGP-M, Ibovespa via **Banco Central SGS**
2. **Notícias do ticker** (`fetchTickerNews` → `/api/news?ticker=X`) — Google News RSS
3. **Notícias políticas** (`fetchTopicNews("politica")`) — para análises de portfólio
4. **Notícias econômicas** (`fetchTopicNews("economia")`)
5. **Notícias de crise/fiscal** (opcional)
6. **Dados de RI** (`/api/scrape`) — Investidor10/StatusInvest/Fundamentus em cascata

### Regras obrigatórias do prompt

```
0. ENQUADRAMENTO: sugestões com fonte, NÃO recomendação personalizada.
1. PERFIL: TODA sugestão começa com "Pelo seu perfil [risco]..."
2. FONTES por afirmação fatual:
   - URL completa de notícia
   - "Yahoo Finance" → preço/histórico/fundamentos
   - "Banco Central do Brasil (SGS)" → SELIC/IPCA/CDI/IBC-Br
   - "calculo do app" → Graham/score/margem
   - "perfil do usuário" → quiz
3. Sem fonte → "(sem fonte verificável)" e NÃO afirme o fato.
4. Numerar com [1], [2]... mapeando ao array "fontes".
5. Sempre encerrar lembrando que a decisão é do usuário.
```

Categorias do schema agora incluem `Macro` e `Politica` para o portfólio prompt.

---

## 8. Score & valuation engine (`src/lib/calculators.ts`)

`calculateStockScore` — 0–100 = soma de 5 componentes:

| Componente | Peso | Crédito total |
|---|---|---|
| Graham Price | 25 | `price < grahamValue` |
| Rentabilidade (ROE) | 20 | ROE > 20% |
| Saúde (Dívida/EBITDA) | 20 | < 1.5 |
| Dividend Yield | 20 | > 6% |
| Valuation (P/L + EV/EBITDA) | 15 | P/L ≤ 10 → 8 pts; EV/EBITDA < 6 → 7 pts |

Labels:
- `> 80` → "Compra Forte"
- `≥ 50` → "Observação"
- `< 50` → "Risco Elevado"

Fórmulas auxiliares: **Graham VI** = `sqrt(22.5 × LPA × VPA)` · **Bazin Ceiling** = `DPA / 0.06` · **MoS** = `(graham - price) / graham` · **Graham com Crescimento**.

---

## 9. Alertas (`useAlerts` + `AlertSheet` + `ScreenAlerts`)

4 tipos de gatilho:
1. **price-below** — preço abaixo de X
2. **price-above** — preço acima de X
3. **graham-margin** — margem Graham ≥ X%
4. **change-drop** — queda no dia ≥ X%

Engine: `checkAlerts(stocks)` rodando a cada poll de 60s no `useEffect`. Match → grava `triggeredAt` + `triggerPrice` + dispara `Notification` nativa se permissão concedida. Retenção 30 dias.

---

## 10. Design system (v0 Engraved)

### Tokens (`src/components/praxia/tokens.ts`)

```typescript
PraxiaTokens.bg          = "#0a0a10"   // onyx
PraxiaTokens.bgDeep      = "#06060a"   // outer
PraxiaTokens.surface     = "#13110d"   // marrom escuro
PraxiaTokens.surface2    = "#1a1610"

PraxiaTokens.paper       = "#f1eadb"   // vellum
PraxiaTokens.paperInk    = "#1a1610"   // espresso

PraxiaTokens.ink         = "#f4ecdf"   // parchment
PraxiaTokens.ink70/50/30 = parchment com alfa

PraxiaTokens.gold        = "#c8a25c"   // champagne (único acento)
PraxiaTokens.goldDim     = rgba(...,0.55)
PraxiaTokens.goldFaint   = rgba(...,0.20)

PraxiaTokens.up          = "#7fb796"   // verde-sálvia
PraxiaTokens.down        = "#c87371"   // tijolo
PraxiaTokens.warn        = "#c8a25c"   // gold

PraxiaTokens.display     = Cormorant Garamond
PraxiaTokens.displaySC   = Cormorant SC
PraxiaTokens.displayAlt  = Playfair Display
PraxiaTokens.body        = Manrope
PraxiaTokens.mono        = JetBrains Mono
```

### Animações (`src/index.css`) — mantidas

```
praFadeIn       — overlays
praSlideUp      — sheets de baixo
praDot          — dots de loading da Pra
praScreenIn     — entrada de tela
praPulseRing    — FAB respira (agora em gold)
praShimmer      — skeleton de loading
```

Global tactile feedback (`button:active { transform: scale(0.97) }`) + `prefers-reduced-motion` respeitado.

### Componentes-chave

- **`<PraxiaLogo>`** — wordmark Engraved (PRAXIA tracked + filete dourado). Props: `size`, `color`, `gold`, `hideRule`, `iconOnly`
- **`<PraMark>`** — selo circular gold com "P" em Cormorant. Props: `size`, `color`, `gold`
- **`<PraxiaBackground>`** — onyx warm + halo gold + textura pergaminho + corner marks editoriais. Props: `accent` (modula gold glow), `hideCornerMarks`
- **`<DisclaimerBar>`** — banner "sugestões com fonte" (gold accent), variants `compact` e `inline`
- **`<MacroStrip>`** dentro do `PortfolioInsightsModal` — chips de SELIC/IPCA/CDI/IBC-Br/IBOV antes da análise

---

## 11. Persistência (sem mudança)

13 chaves localStorage:

| Chave | Owner | TTL |
|---|---|---|
| `stocks-ai-portfolio` | `useStockQuotes` | persistente |
| `praxia-investor-profile` | `useInvestorProfile` | persistente |
| `praxia-pra-chat` | `usePraChat` | persistente |
| `praxia-ui-prefs` | `useUIPreferences` | persistente |
| `praxia-transactions` | `useTransactions` | persistente |
| `praxia-alerts` | `useAlerts` | rolling 30d |
| `stocks-ai-relatorios` | `useRelatorios` | 24h |
| `stocks-ai-analysis:{TICKER}` | `StockAIAnalysisSection` | 24h |
| `stocks-ai-portfolio-insights` | `PortfolioInsightsModal` | 6h |
| `stocks-ai-comparison:{TICKERS}` | `ScreenCompare` | 6h |
| `stocks-ai-batch-valuation` | `useBatchValuation` | persistente |
| `stocks-ai-brapi-token` | legado | opcional |
| `stocks-ai-provider-config` | `useAIProvider` (dormente) | persistente |

---

## 12. Disclaimer de "sugestão com fonte"

Presente em:
- Home (acima do AI insight) — `compact`
- ChatSheet (header da Pra) — `inline`
- StockAIAnalysisSection (rodapé) — `inline`
- PortfolioInsightsModal (antes + depois da análise) — `compact` + `inline`

Texto: **"Sugestões com fonte — não é recomendação. Todos os dados vêm com origem (Yahoo Finance, cálculo do app, perfil seu, ou link de RI). A decisão final é sempre sua."**

---

## 13. Checklist de features (v0)

### Identidade visual ✓
- [x] Paleta onyx/vellum/gold em `tokens.ts`
- [x] Fontes Cormorant/Playfair/EB Garamond importadas
- [x] `<PraxiaLogo>` reescrito com Engraved wordmark
- [x] `<PraMark>` reescrito com seal mark
- [x] `<PraxiaBackground>` com halo gold + corner marks
- [x] `AppShell` com sombra editorial e filete dourado externo
- [x] `LoginScreen` headline com Cormorant italic gold
- [x] `ScreenOnboarding` refeito com CTA pílula creme + gold arrow
- [x] `ScreenOnboardingB` com numeral romano II faded ao fundo
- [x] Sheets (Chat/QuickWatch/Alert/PortfolioInsights) com gradiente onyx
- [x] Accent options sóbrios (Champagne/Brass/Vellum/Brushed/Amber)

### Funcionalidades (preservadas v1.0) ✓
- [x] Login, Onboarding, Quiz, Home, Market, Detail, Order, Review, Activity, Profile
- [x] Batch Valuation (CSV/Excel)
- [x] Alertas (4 tipos + Notification API)
- [x] Comparação (até 4 ações)
- [x] Chat com a Pra
- [x] Análise IA per-stock + portfolio + comparação
- [x] Watchlist, QuickWatch, Discovery no Market
- [x] Macro context (SELIC/IPCA/CDI/IBC-Br/IBOV) injetado em prompts
- [x] News context (política/economia/ticker) com URLs como fontes
- [x] Multi-provider (Groq/OpenAI/Anthropic/Gemini)
- [x] Disclaimer "sugestão com fonte" em todas as superfícies de IA
- [x] Polling 60s + alert engine
- [x] Caching por TTL apropriado
- [x] `prefers-reduced-motion` respeitado

### Endpoints validados ✓
- [x] `/api/brapi` (Yahoo proxy + sugestões inteligentes)
- [x] `/api/macro` (Banco Central SGS + Ibovespa)
- [x] `/api/news` (Google News RSS, 6 tópicos)
- [x] `/api/market` (USD/EUR + metais mock)
- [x] `/api/scrape` (3 fontes RI cascateadas)
- [x] `/api/ai` (multi-provider, fail-503 sem env)

---

## 14. Limitações conhecidas

- **Sem testes** — verificação via `npm run build` + lint + smoke manual dos endpoints
- **Sem auth real** — login placeholder (admin/1234)
- **`useStockSearch` não está cabeado** em nenhuma tela — pronto para uso
- **AwesomeAPI fallback** no `/api/market` pode falhar em ambientes restritos
- **Google News RSS** não tem SLA — cache 30min ajuda
- **Bundle ~831 KB** sem code-splitting — versões futuras podem fazer dynamic import dos screens secundários
- **Pré-existentes 18 lint errors `any`** em libs de I/O — não bloqueiam build
- **Modo claro (paper)** disponível como tokens mas não há toggle UI — pode virar feature em v0.1

---

## 15. Estrutura do projeto

```
AnalisedeprecodeAcoes/
├── api/
│   ├── ai.ts            # multi-provider LLM router
│   ├── brapi.ts         # Yahoo Finance proxy + sugestões
│   ├── macro.ts         # Banco Central SGS + Ibovespa
│   ├── news.ts          # Google News RSS (6 tópicos)
│   ├── market.ts        # cotações strip
│   ├── scrape.ts        # RI em 3 fontes cascateadas
│   └── groq.ts          # (legado)
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css        # tokens + keyframes (v0 onyx)
│   ├── components/
│   │   ├── LoginScreen.tsx
│   │   └── praxia/
│   │       ├── AppShell.tsx
│   │       ├── BottomNav.tsx
│   │       ├── FloatingPraButton.tsx
│   │       ├── PraxiaCard.tsx
│   │       ├── PraxiaBackground.tsx       # ★ refeito v0
│   │       ├── PraxiaLogo.tsx             # ★ refeito v0
│   │       ├── PraMark.tsx                # ★ refeito v0
│   │       ├── Icon.tsx
│   │       ├── Tag.tsx (Tag, StatusTag, DeltaPill)
│   │       ├── StockAvatar.tsx
│   │       ├── SectionHeader.tsx
│   │       ├── GlassButton.tsx
│   │       ├── Charts.tsx
│   │       ├── HoldingRow.tsx
│   │       ├── Citations.tsx
│   │       ├── DisclaimerBar.tsx
│   │       ├── MacroQuotesStrip.tsx
│   │       ├── ChatSheet.tsx              # gradiente onyx
│   │       ├── QuickWatch.tsx             # gradiente onyx
│   │       ├── AlertSheet.tsx             # gradiente onyx
│   │       ├── PortfolioInsightsModal.tsx # gradiente onyx
│   │       ├── StockAIAnalysisSection.tsx
│   │       ├── StockReportsSection.tsx
│   │       ├── CompareTable.tsx
│   │       ├── tokens.ts                  # ★ v0 onyx/vellum/gold
│   │       └── screens/
│   │           ├── ScreenOnboarding.tsx   # ★ refeito v0
│   │           ├── ScreenOnboardingB.tsx  # ★ refeito v0
│   │           ├── ScreenQuiz.tsx
│   │           ├── ScreenHome.tsx
│   │           ├── ScreenMarket.tsx
│   │           ├── ScreenStockDetail.tsx
│   │           ├── ScreenOrder.tsx
│   │           ├── ScreenOrderReview.tsx
│   │           ├── ScreenActivity.tsx
│   │           ├── ScreenProfile.tsx
│   │           ├── ScreenBatchValuation.tsx
│   │           ├── ScreenAlerts.tsx
│   │           └── ScreenCompare.tsx
│   ├── hooks/
│   │   ├── useStockQuotes.ts
│   │   ├── useInvestorProfile.ts
│   │   ├── useTransactions.ts
│   │   ├── useAlerts.ts
│   │   ├── useUIPreferences.ts
│   │   ├── useAIProvider.ts
│   │   ├── usePraChat.ts
│   │   ├── useRelatorios.ts
│   │   ├── useMarketQuotes.ts
│   │   ├── useStockSearch.ts
│   │   └── useBatchValuation.ts
│   ├── lib/
│   │   ├── api.ts             # TickerLookupError
│   │   ├── ai.ts              # prompts + macro + news
│   │   ├── context.ts         # cliente macro + news
│   │   ├── scraping.ts
│   │   ├── calculators.ts
│   │   ├── portfolio.ts
│   │   ├── relatorios.ts
│   │   ├── stockMeta.ts
│   │   ├── sheetParser.ts
│   │   ├── columnMappings.ts
│   │   ├── exportTemplate.ts
│   │   ├── exportResults.ts
│   │   └── utils.ts
│   └── types/
│       └── stock.ts
├── .praxia-design/             # ★ bundle do Claude Design
│   ├── README.md
│   ├── chat1.md / chat2.md
│   ├── Praxia-Brand.html
│   ├── brand-app.jsx
│   ├── brand-logos.jsx          # referência das marcas WMEngraved/SealMark/etc
│   └── ... (sistemas + variações originais)
├── index.html                  # ★ fontes Cormorant/Playfair carregadas
├── vite.config.ts
├── vite-api-plugin.ts
├── vercel.json
├── tsconfig.json
├── eslint.config.js
├── package.json
├── CLAUDE.md
├── ROADMAP.md
└── PONTO.md                    # este documento (v0)
```

---

## 16. Variáveis de ambiente

```bash
# .env.local (raiz do projeto) — também configurar no Vercel Dashboard
GROQ_API_KEY=...           # default; free tier disponível
# OU qualquer um dos abaixo:
OPENAI_API_KEY=...         # gpt-4o
ANTHROPIC_API_KEY=...      # claude-3-5-sonnet
GEMINI_API_KEY=...         # gemini-1.5-flash
AI_PROVIDER=groq           # opcional, sobrescreve o default
```

Sem nenhuma key, `/api/ai` retorna **503** com mensagem clara.

---

## 17. Smoke test reproduzível (em dev)

```bash
npm run dev &
sleep 6

# Yahoo proxy — válido
curl -s "http://localhost:5173/api/brapi?endpoint=/quote/PETR4&modules=financialData" | head -c 200

# Yahoo proxy — inválido com sugestões
curl -s "http://localhost:5173/api/brapi?endpoint=/quote/ITUB2" | head -c 300

# Macro
curl -s "http://localhost:5173/api/macro" | head -c 200

# Notícias políticas
curl -s "http://localhost:5173/api/news?topic=politica&limit=2" | head -c 200

# IA (precisa de GROQ_API_KEY no env)
curl -s -X POST "http://localhost:5173/api/ai" -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"oi"}],"max_tokens":50}'
```

Resultado esperado em 2026-05-14:
- PETR4 → `{"results":[{"symbol":"PETR4","regularMarketPrice":45,...}]}`
- ITUB2 → `{"error":"...","suggestions":[{"stock":"ITUB"},{"stock":"ITUB3"},{"stock":"ITUB4"},...]}`
- Macro → `{"selicMeta":{"valor":14.5,...},"ipca12m":{"valor":4.39,...},...}`
- News → 2 manchetes da BBC, Folha, etc.
- AI → `{"content":"Oi! Como posso ajudar...","provider":"groq"}`

---

## 18. Próximos passos sugeridos (não fazem parte da v0)

- **v0.1** — toggle de modo claro (paper) com Cormorant em paperInk
- **v0.2** — variação de wordmark "Inscription" (interpuncts) para o splash
- **v0.3** — code-splitting (screens secundários como dynamic imports)
- **v0.4** — backend de auth real + sync entre devices
- **v0.5** — WebSocket de cotações em vez de polling 60s
- **v0.6** — análise gráfica (Fibonacci, RSI, MACD)
- **v0.7** — comparação contra benchmark IBOV/S&P
- **v0.8** — alertas via push/email (precisa backend)
- **v0.9** — i18n (português/inglês)
- **v1.0** — testes (vitest + react-testing-library) cobrindo o boot flow + hooks + endpoints

---

## 19. Onde está o bundle de design

Arquivos da exploração Engraved (referência viva, **não código de produção**):

```
.praxia-design/
├── README.md              # instruções do handoff
├── chat1.md               # primeira sessão (paleta navy original)
├── chat2.md               # segunda sessão (BTG/XP serif + gold)
├── Praxia-Brand.html      # entrypoint da exploração de marca
├── Praxia-App-Design.html # design completo do app (referência)
├── brand-logos.jsx        # WMEngraved + SealMark + ... (fonte das marcas)
├── brand-app.jsx          # showcase das 6 direções
└── ...                    # demais componentes do design canvas
```

O que foi portado para `src/`:
- **WMEngraved** → `PraxiaLogo`
- **SealMark** → `PraMark`
- **PALETTE** (onyx/vellum/gold) → `tokens.ts` e `index.css`
- **CornerMarks** → `PraxiaBackground` interno
- **Direção tipográfica** (Cormorant SC tracked, italic gold, filetes) → telas de entrada e disclaimer

Direções **não portadas** (disponíveis no bundle para futuras iterações):
- 02 Establishment, 03 Signature, 04 Inscription, 05 Duet, 06 Initial (monogram)
- TesseraMark, PlateMark (companion seals alternativos)
