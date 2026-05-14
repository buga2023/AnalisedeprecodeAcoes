# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Vite dev server with HMR
npm run build     # Type-check (tsc -b) then bundle (vite build)
npm run lint      # Run ESLint
npm run preview   # Serve the production dist/ build locally
```

There is no test suite configured. The lint baseline has ~18 pre-existing `any` errors and 2 warnings — don't be alarmed if your changes leave them in place; just don't add new ones.

## Architecture

Single-page React 19 + TypeScript SPA branded **Praxia** — Brazilian stock portfolio tracker with a conversational AI assistant ("Pra") and AI-generated analyses. Mobile-first: the `AppShell` constrains the app to a ~440px column on desktop, full-width on phones. No router, no global state library — `App.tsx` keeps a `screen` union (`"home" | "market" | "stock" | "order" | "review" | "activity" | "profile"`) and conditionally renders each `Screen*` component.

Serverless functions live under `api/` (Vercel handlers): they proxy LLM providers, Yahoo Finance, scraping, and macro market data.

### Boot flow (`src/App.tsx`)

1. `LoginScreen` — gates entry (placeholder, no real auth)
2. If no `InvestorProfile` saved → `ScreenOnboarding` → `ScreenQuiz` (or Pra elicits it conversationally if the user opens the chat directly)
3. Main app: a `screen` state drives which `Screen*` is rendered inside `AppShell`. `BottomNav` switches between `home/market/activity/profile`. `FloatingPraButton` opens `ChatSheet` overlay on any screen.

### Portfolio data flow

1. User adds a ticker (currently via `ScreenMarket.onAddTicker`) → `useStockQuotes.addStock()`
2. `src/lib/api.ts` calls `/api/brapi?endpoint=/quote/{ticker}` (Vercel proxy → Yahoo Finance)
3. `src/lib/calculators.ts` computes Graham VI + 0–100 score
4. State persisted to `localStorage` (`stocks-ai-portfolio`); auto-refresh every 60s

## Praxia AI system

Three AI capabilities, all routed through `POST /api/ai` (server-side env vars — never send API keys from the client).

| Capability | Hook / lib | UI surface |
|---|---|---|
| Conversational chat ("Pra") with profile elicitation | `usePraChat` | `ChatSheet` (modal triggered by `FloatingPraButton`) |
| Per-stock deep analysis: COMPRAR/SEGURAR/VENDER + red flags + quarterly summary | `analisarAcaoComIA` in `src/lib/ai.ts` | `StockAIAnalysisSection` inside `ScreenStockDetail` |
| Portfolio-wide insights (4–8 cards + sentiment) | `fetchAIInsights` in `src/lib/ai.ts` | `PortfolioInsightsModal` (button inside `AIInsightCard` on home) |

**Profile elicitation in chat**: when `profile === null`, the system prompt instructs the LLM to ask risk/horizon/interests questions naturally and emit a `[PROFILE]{...}[/PROFILE]` marker when it has enough info. `usePraChat` regex-parses, validates, calls `saveProfile`, and strips the marker from the displayed text.

**Citations system**: `AIInsight`/`AnaliseIA` carry a `fontes: string[]` field. The shared `SOURCE_AND_PROFILE_RULES` block in `src/lib/ai.ts` forces every recommendation to (a) reference the user's profile and (b) cite a source per factual claim (URL, "BrAPI", "Yahoo Finance", "calculo do app", "perfil do usuario").

**Caching**:
- Per-stock AI analysis → 24h, keyed by ticker (`stocks-ai-analysis:{TICKER}`)
- Portfolio insights → 6h, invalidated on portfolio signature change (`ticker:quantity|...`) (`stocks-ai-portfolio-insights`)
- Quarterly reports → 24h per ticker (`stocks-ai-relatorios`)

### Multi-provider IA (env-driven)

`api/ai.ts` resolves the provider in this order: `request.body.provider` → `process.env.AI_PROVIDER` → `'groq'` (default). API key from the matching env var. Returns 503 when missing.

```bash
# .env.local (and Vercel env)
GROQ_API_KEY=...          # default; Groq has a free tier
# OR any of:
OPENAI_API_KEY=...        # gpt-4o
ANTHROPIC_API_KEY=...     # claude-3-5-sonnet
GEMINI_API_KEY=...        # gemini-1.5-flash
AI_PROVIDER=groq          # optional explicit selection
```

## Score breakdown (`calculateStockScore` in `src/lib/calculators.ts`)

0–100 total = sum of 5 components:

| Component | Weight | Full credit |
|---|---|---|
| Graham Price | 25 | `price < grahamValue` |
| Profitability (ROE) | 20 | ROE > 20% (15 pts at 15–20%, 10 pts at 10–15%) |
| Health (Debt/EBITDA) | 20 | < 1.5 (15 pts at < 2.0, 10 pts at ≤ 3.0) |
| Dividend Yield | 20 | > 6% (10 pts at ≥ 4%) |
| Valuation (P/L + EV/EBITDA) | 15 | P/L ≤ 10 → 8 pts; EV/EBITDA < 6 → 7 pts |

**Labels** (`getScoreLabel`): `> 80` "Compra Forte" · `≥ 50` "Observação" · `< 50` "Risco Elevado".

Graham Intrinsic Value: `sqrt(22.5 × LPA × VPA)`. Bazin ceiling: `DPA / 0.06`. Both in `src/lib/calculators.ts`.

## Key files

| Path | Role |
|---|---|
| `src/App.tsx` | Root; screen routing, lifts modals (`ChatSheet`, `QuickWatch`, `PortfolioInsightsModal`) |
| `src/hooks/useStockQuotes.ts` | Portfolio state, brapi calls, score computation, 60s polling, `applyTransaction` for paper-trading |
| `src/hooks/useInvestorProfile.ts` | Risk/horizon/interests profile; label helpers |
| `src/hooks/usePraChat.ts` | Chat state + `/api/ai` calls + `[PROFILE]` marker parser |
| `src/hooks/useRelatorios.ts` | Quarterly reports loader (24h cache) |
| `src/hooks/useUIPreferences.ts` | Accent color + chat tone (casual/formal) |
| `src/lib/calculators.ts` | Graham/Bazin/score engine — all valuation math |
| `src/lib/ai.ts` | `fetchAIInsights`, `analisarAcaoComIA`, `toPortfolioData`, citations rules |
| `src/lib/api.ts` | brapi/Yahoo proxy client (`fetchStockQuote`, `fetchStockHistory`, `searchStocks`) |
| `src/lib/portfolio.ts` | `totalPortfolioValue`, `sectorAllocation`, `dominantSector` |
| `src/lib/scraping.ts` | `coletarDadosRI` → `/api/scrape` (Investidor10/StatusInvest) |
| `src/components/praxia/tokens.ts` | Design tokens (`PraxiaTokens` palette, `fmt`, `genSeries`, `smoothPath`) |
| `src/components/praxia/ChatSheet.tsx` | The Pra chat overlay |
| `src/components/praxia/StockAIAnalysisSection.tsx` | Per-stock IA analysis card |
| `src/components/praxia/StockReportsSection.tsx` | Quarterly results card |
| `src/components/praxia/PortfolioInsightsModal.tsx` | Portfolio-level IA insights sheet |
| `src/types/stock.ts` | All TS types: `Stock`, `ScoreBreakdown`, `InvestorProfile`, `Relatorio`, `ChatMessage`, `ValuationRow`, etc |
| `api/ai.ts` | Multi-provider LLM router (env-based keys) |
| `api/brapi.ts` | Yahoo Finance proxy (quotes, search, history) |
| `api/scrape.ts` | Investor Relations scraping |
| `api/market.ts` | Macro quotes (USD, EUR, BTC, gold, etc) — used by `useMarketQuotes` |

## Persistence (localStorage keys)

| Key | Owner |
|---|---|
| `stocks-ai-portfolio` | `useStockQuotes` |
| `stocks-ai-brapi-token` | optional Bearer token for `brapi.dev` (legacy) |
| `praxia-investor-profile` | `useInvestorProfile` |
| `praxia-pra-chat` | `usePraChat` |
| `praxia-ui-prefs` | `useUIPreferences` (accent + tone) |
| `praxia-transactions` | `useTransactions` (paper-trading log) |
| `stocks-ai-relatorios` | `useRelatorios` (24h cache) |
| `stocks-ai-analysis:{TICKER}` | `StockAIAnalysisSection` (24h cache per ticker) |
| `stocks-ai-portfolio-insights` | `PortfolioInsightsModal` (6h, invalidated by portfolio signature) |
| `stocks-ai-provider-config` | `useAIProvider` (dormant — server-side env vars are the source of truth now) |

## Styling

- Tailwind CSS v4 (`@tailwindcss/vite`) for utilities; **but most Praxia components use inline styles + design tokens** (`PraxiaTokens` in `src/components/praxia/tokens.ts`) rather than Tailwind classes, because the UI is highly bespoke
- Fonts: `Sora` (display), `Manrope` (body), `JetBrains Mono` (monospace, numbers)
- Color tokens: `accent` (default `#5b7cff`, configurable in `useUIPreferences`), `up` (green), `down` (red), `warn` (amber), `ink`/`ink70`/`ink50`/`ink30` for text steps
- Keyframes in `src/index.css`: `praFadeIn`, `praSlideUp`, `praDot` — reuse these for overlays/loading states
- Formatters: `fmt.brl`, `fmt.pct`, `fmt.num`, `fmt.compact` (all in `tokens.ts`)
- The legacy shadcn/ui stack (`src/components/ui/`, `src/components/stocks/`) was removed; don't reintroduce it

## Conventions

- Modal overlays use `position: absolute; inset: 0` relative to `AppShell` (which is `position: relative`). To overlay the whole app, render the modal as a sibling of the screen in `App.tsx`, not inside the scroll container
- Server-side AI keys only — never send `apiKey` from the client. The `useAIProvider` hook still exists for backwards compatibility but is no longer wired into requests
- When adding a new AI-driven feature, route through `/api/ai` with `{ messages, temperature, max_tokens, response_format }` — provider is resolved server-side
- New tickers/positions: prefer `useStockQuotes.addStock` + `applyTransaction` over direct localStorage edits
