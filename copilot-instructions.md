Purpose

Concise instructions for Copilot / assistant sessions working on this repo. Use this file to speed onboarding and ensure automation agents run the correct commands and understand repository conventions.

Build, test, and lint commands

- Dev (HMR): npm run dev
- Build (type-check + bundle): npm run build  # runs: tsc -b && vite build
- Lint: npm run lint  # runs ESLint across the repo
- Preview production build: npm run preview
- Tests: No test suite is configured. There is no single-test command.

High-level architecture

- Single-page React (v19) + TypeScript SPA. No backend; no router; no global state library.
- Central state & data flow:
  - UI: src/App.tsx orchestrates sections and components
  - Hook: src/hooks/useStockQuotes.ts manages portfolio, token, refresh, and persistence
  - API: src/lib/api.ts (fetchStockQuote hitting https://brapi.dev/api/quote/{ticker})
  - Business logic: src/lib/calculators.ts (Graham value, ROI, margin of safety, score calculation)
  - Types: src/types/stock.ts
- Persistence: localStorage (keys documented below). Auto-refresh polls every 60 seconds.
- Build notes: tsc -b is used for type checking during build; vite for bundling. Vite dev server proxies /api to a Netlify functions host in development (see vite.config.ts).

Key conventions and repository-specific patterns

- LocalStorage keys:
  - stocks-ai-portfolio — saved portfolio state
  - stocks-ai-brapi-token — optional Bearer token for brapi.dev (when set, sent as Authorization: Bearer <token>)
- Scoring system (brief): calculateStockScore yields 0–100 points: 40 pts for price < Graham value, 30 pts for ROE (thresholds: >15% full, 10–15% half), 30 pts for Debt/EBITDA (thresholds: <2.0 full, 2.0–3.0 half). Labels are Portuguese: 'Compra Forte' (≥70), 'Observacao' (40–69), 'Risco Elevado' (<40).
- File locations to check when debugging business logic: src/lib/calculators.ts (score logic), src/hooks/useStockQuotes.ts (state, storage, refresh), src/lib/api.ts (external fetch behavior and Authorization header handling).
- Styling & UI pattern: Tailwind CSS v4 + shadcn/ui patterns. Helpers used: clsx, tailwind-merge, class-variance-authority (CVA). UI primitives are under src/components/ui/ and stock-specific components under src/components/stocks/.
- Path alias: @ -> ./src (configured in vite and tsconfig). Prefer using @/ for imports.
- Type-checking and linting: Build runs tsc -b; lint runs eslint . — prefer running lint before commits.
- Dev proxy: vite.config.ts contains a /api proxy to http://localhost:8888 (Netlify functions) for development. Netlify dev is expected when working on local functions.

AI assistant and agent files discovered

- CLAUDE.md exists and contains concise architecture and command info; include its notes when delegating to Claude-based tools.
- No other agent config files were detected (.cursorrules, AGENTS.md, .windsurfrules, CONVENTIONS.md, AIDER_CONVENTIONS.md, .clinerules).

If this file should actually live at .github/copilot-instructions.md

- Move this file into .github/ if the repository adds that directory later. Assistants expect the canonical path .github/copilot-instructions.md; this copy is provided at repository root because the environment creating files could not create the .github directory.

Maintenance and updates

- Keep the Build/Script lines in sync with package.json if you change scripts.
- If tests are added, update the "Tests" section with how to run a single test (example: npm run test -- <testname> or npm run test -- -t "test name").

Sources

- README.md and CLAUDE.md were consulted to assemble these instructions, plus vite.config.ts and tsconfig.app.json for proxy and alias details.

