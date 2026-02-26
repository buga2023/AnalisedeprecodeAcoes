# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server with HMR
npm run build     # Type-check (tsc -b) then bundle (vite build)
npm run lint      # Run ESLint
npm run preview   # Serve the production dist/ build locally
```

There is no test suite configured.

## Architecture

Single-page React 19 + TypeScript SPA for Brazilian stock portfolio tracking. No router, no backend, no global state library.

**Data flow:**
1. User adds a ticker via `StockForm` → `useStockQuotes.addStock()`
2. Hook fetches from `brapi.dev` API (`src/lib/api.ts`)
3. Graham fundamentalist score is computed via `src/lib/calculators.ts`
4. Stock is saved to state + `localStorage` (`stocks-ai-portfolio`)
5. Auto-refresh polls every 60 seconds

**Key files:**
- `src/App.tsx` — root component, orchestrates all UI sections
- `src/hooks/useStockQuotes.ts` — central state: portfolio, token, refresh logic
- `src/lib/calculators.ts` — all business logic (Graham value, ROI, margin of safety, 0–100 score)
- `src/lib/api.ts` — `fetchStockQuote()` hitting `https://brapi.dev/api/quote/{ticker}`
- `src/types/stock.ts` — `Stock` and `ScoreBreakdown` interfaces

**Scoring system (`calculateStockScore`):**
- 0–100 points: 40 pts for price < Graham value, 30 pts for ROE (>15% full / 10–15% half), 30 pts for Debt/EBITDA (<2.0 full / 2.0–3.0 half)
- Labels: `'Compra Forte'` (≥70), `'Observacao'` (40–69), `'Risco Elevado'` (<40)

**Persistence:** `localStorage` keys — `stocks-ai-portfolio`, `stocks-ai-brapi-token`

**API access:** Without a Bearer token, only PETR4, VALE3, MGLU3, ITUB4 are available. Token stored in localStorage and sent as `Authorization: Bearer <token>`.

**Styling:** Tailwind CSS v4 + shadcn/ui pattern (`clsx` + `tailwind-merge` + CVA). UI primitives in `src/components/ui/`, stock-specific components in `src/components/stocks/`.
