# Referência de Módulos

> Mapa file-by-file do que cada arquivo faz, suas dependências principais e quem
> consome. Use pra navegar rápido quando precisar mexer em algo específico.

## Hooks (`src/hooks/`)

| Arquivo | Responsabilidade | Persiste em | Usado por |
|---|---|---|---|
| `useStockQuotes.ts` | Carteira viva: addStock, applyTransaction, polling 60s, score | `stocks-ai-portfolio` | `App.tsx`, screens Home/Market/Stock/Order |
| `useInvestorProfile.ts` | Perfil risk/horizon/interests + labels | `praxia-investor-profile` | `App.tsx`, ScreenQuiz, ScreenProfile, chat |
| `usePraChat.ts` | Chat com Pra + extração do marker `[PROFILE]` | `praxia-pra-chat` | `ChatSheet` |
| `useTransactions.ts` | Log de paper-trades | `praxia-transactions` | `App.tsx`, ScreenActivity |
| `useAlerts.ts` | CRUD de alertas + matching + Notification API | `praxia-alerts` | `App.tsx`, ScreenAlerts, AlertSheet |
| `useUIPreferences.ts` | Accent color + tom de chat | `praxia-ui-prefs` | `App.tsx`, ScreenProfile |
| `useAIProvider.ts` | Config de provider IA (dormente — server-side env é a verdade) | `stocks-ai-provider-config` | ScreenProfile |
| `useBatchValuation.ts` | Importação CSV/Excel + valuation em lote | `stocks-ai-batch-valuation` | ScreenBatchValuation |
| `useRelatorios.ts` | Relatórios trimestrais (cache 24h) | `stocks-ai-relatorios` | StockReportsSection |
| `useMarketQuotes.ts` | Strip de cotações macro (USD/EUR/BTC) | — (memória) | MacroQuotesStrip |
| `useWorldNews.ts` | Notícias globais agregadas (cache 2h server-side) | — | ScreenNews |
| `useStockSearch.ts` | **Dormente** — search debounced pronto, não cabeado | — | (nenhum) |

## Lib (`src/lib/`)

| Arquivo | Responsabilidade |
|---|---|
| `api.ts` | Cliente do `/api/brapi` proxy (Yahoo Finance) + `TickerLookupError` |
| `praxiaPrompt.ts` | **System prompt mestre** (XML tags + few-shot + chain of thought) usado por TODAS as 6 capacidades IA |
| `ai.ts` | `analisarAcaoComIA`, `fetchAIInsights`, `compararAcoesComIA` (re-exporta `PRAXIA_SYSTEM_PROMPT`) |
| `aiNews.ts` | Resumo IA por TÓPICO de notícias (modo "Tópicos" do ScreenNews) |
| `aiNewsFeed.ts` | Análise IA por NOTÍCIA individual cruzando com carteira (modo "Feed" do ScreenNews) |
| `context.ts` | Coletor paralelo de macro + news + world-news pra injetar nos prompts |
| `calculators.ts` | Graham VI/G, Bazin, score 0-100, margem, ROIC, valuation |
| `portfolio.ts` | `totalPortfolioValue`, `sectorAllocation`, `dominantSector` |
| `scraping.ts` | `coletarDadosRI(ticker)` → `/api/scrape` (cascade 3 fontes) |
| `fundamentals.ts` | `fetchFundamentalsFromAI` (fallback IA quando Yahoo zera) |
| `relatorios.ts` | Parse de relatórios trimestrais |
| `stockMeta.ts` | `detectMarket`, `detectSector`, `brandColor` por ticker |
| `sheetParser.ts` | Parse CSV/XLSX → linhas crus (papaparse + xlsx) |
| `columnMappings.ts` | Aliases de coluna pra batch import |
| `exportResults.ts` | Gera .xlsx com resultados de valuation |

## Tipos (`src/types/stock.ts`)

Hub central de tipos. Todos os hooks/components importam daqui:

- `Stock` — entidade canônica de ativo
- `ScoreBreakdown`, `ScoreLabel` — score 0-100
- `InvestorProfile` — risk/horizon/interests + completedAt
- `Transaction`, `TransactionType`, `OrderType` — paper trade
- `PriceAlert`, `AlertType` — alertas
- `ChatMessage` — mensagem do chat
- `Relatorio` — relatório trimestral
- `ValuationRow`, `CSVRow` — batch valuation
- `AIProviderConfig` — provider IA (dormente)

## Componentes Praxia (`src/components/praxia/`)

### Base / chrome

| Arquivo | Função |
|---|---|
| `AppShell.tsx` | Coluna ~440px + position relative pros modais |
| `BottomNav.tsx` | 4 tabs: home / market / activity / profile |
| `FloatingPraButton.tsx` | FAB que abre `ChatSheet` |
| `PraxiaBackground.tsx` | Onyx + halo gold + corner marks editoriais |
| `PraxiaCard.tsx` | Card base com border + radius do design system |
| `PraxiaLogo.tsx` | Wordmark "PRAXIA" Cormorant SC tracked + filete |
| `PraMark.tsx` | Selo circular gold com "P" em Cormorant |
| `Icon.tsx` | SVGs custom (substituiu lucide-react) |
| `Tag.tsx` | `Tag`, `StatusTag`, `DeltaPill` |
| `SectionHeader.tsx` | Header de seção com filete |
| `GlassButton.tsx` | Botão estilo glass |
| `DisclaimerBar.tsx` | "Sugestões com fonte" disclaimer |

### Charts + dados

| Arquivo | Função |
|---|---|
| `Charts.tsx` | `AreaChart` SVG nativo (sem libs externas) |
| `HoldingRow.tsx` | Linha de ativo (ticker, preço, delta, score) |
| `StockAvatar.tsx` | Avatar circular com cor da marca |
| `MacroQuotesStrip.tsx` | Carrossel horizontal USD/EUR/BTC |
| `WeeklyPerformanceCard.tsx` | Card de performance semanal |
| `AIBadge.tsx` | Selo "IA" em cards |

### Modais

| Arquivo | Função |
|---|---|
| `ChatSheet.tsx` | Modal do chat com a Pra |
| `QuickWatch.tsx` | Preview rápido de um ativo (overlay) |
| `AlertSheet.tsx` | Wizard de criação de alerta |
| `PortfolioInsightsModal.tsx` | Análise IA do portfólio completo |

### Seções por tela

| Arquivo | Função |
|---|---|
| `StockAIAnalysisSection.tsx` | Card de análise IA por ação (24h cache) |
| `StockReportsSection.tsx` | Card de relatórios trimestrais |
| `CompareTable.tsx` | Tabela comparativa para ScreenCompare |
| `Citations.tsx` | Renderiza `[1]` `[2]` com tooltip da fonte |
| `NewsFeedCard.tsx` | Card de notícia individual + botão "Analisar pra minha carteira" (modo Feed) |

## Screens (`src/components/praxia/screens/`)

| Screen | Função |
|---|---|
| `ScreenOnboarding.tsx` | Pitch inicial (creme + gold) |
| `ScreenOnboardingB.tsx` | Segunda página de onboarding (numeral romano II) |
| `ScreenQuiz.tsx` | Quiz de perfil (risk/horizon/interests) |
| `ScreenHome.tsx` | Patrimônio + AI insight card + posições + alocação |
| `ScreenMarket.tsx` | Tabs (Para você / Buscar / Descobrir) + busca |
| `ScreenStockDetail.tsx` | Detalhe do ativo: chart + análise IA + relatórios |
| `ScreenOrder.tsx` | Form de quantidade + tipo de ordem |
| `ScreenOrderReview.tsx` | Revisão da ordem antes de confirmar |
| `ScreenActivity.tsx` | Histórico de transações |
| `ScreenProfile.tsx` | Settings: accent, tone, batch, clear data |
| `ScreenBatchValuation.tsx` | Upload CSV/XLSX → tabela valuation em lote |
| `ScreenAlerts.tsx` | Lista de alertas ativos + disparados |
| `ScreenCompare.tsx` | Comparação de até 4 ações + análise IA comparativa |
| `ScreenNews.tsx` | Notícias mundiais agregadas |

## API serverless (`api/`)

| Arquivo | Rota |
|---|---|
| `ai.ts` | `POST /api/ai` — multi-provider LLM router |
| `brapi.ts` | `GET /api/brapi?endpoint=...` — proxy Yahoo |
| `macro.ts` | `GET /api/macro` — indicadores BCB + Ibovespa |
| `news.ts` | `GET /api/news?ticker=X` — Google News RSS |
| `world-news.ts` | `GET /api/world-news` — agregador global (cron 2h) |
| `market.ts` | `GET /api/market` — USD/EUR/BTC/ouro |
| `scrape.ts` | `GET /api/scrape?ticker=X` — RI cascade |
| `fundamentals.ts` | `GET /api/fundamentals?ticker=X` — IA estimando |

## Convenções de import

- **Path alias** `@/*` aponta para `./src/*` — configurado em `tsconfig.app.json` +
  `vite.config.ts`. Sempre preferir `@/lib/foo` a `../../lib/foo`.
- **Type imports** explícitos por causa de `verbatimModuleSyntax: true`:
  ```typescript
  import type { Stock } from "@/types/stock";    // OK
  import { Stock } from "@/types/stock";          // erro em runtime
  ```
- **API client central**: tudo que conversa com `/api/brapi` passa por `src/lib/api.ts`
  — não fazer `fetch` cru no hook ou componente.
