# Praxia — Situação Atual

> Documento vivo. Última atualização: 2026-05-28. Reflete o estado após a sessão de planejamento do roadmap completo + início da implementação da Fase 0.

---

## 0. Norte do projeto

**Princípio fundamental adotado nesta sessão:** cada feature deve ser aparente e descoberta pelo usuário sem esforço. O diferencial do Praxia são os cálculos fundamentalistas (Graham VI, Bazin, Graham com Crescimento, Margem de Segurança, ROIC, Score 0–100) — esses valores precisam aparecer em destaque, não escondidos dentro de números sem contexto.

Implicação prática: antes de adicionar features novas, garantir que o que já está implementado está **visível e compreensível** para o usuário.

---

## 1. Versão e identidade visual

**v0 "Engraved"** — rebrand fundacional (2026-05-14).

| Token | Valor |
|---|---|
| Fundo | `#0a0a10` onyx warm |
| Acento único | `#c8a25c` champagne gold |
| Texto | `#f4ecdf` parchment |
| Display | Cormorant Garamond + SC |
| Body | Manrope |
| Mono | JetBrains Mono |

Referência viva do design: `.praxia-design/` (não vai para o bundle).

---

## 2. Stack

| Camada | Escolha |
|---|---|
| UI | React 19 SPA + TypeScript 5.9 strict |
| Bundler | Vite 7 + `@vitejs/plugin-react` |
| Styling | Tailwind v4 (utilities) + inline com `PraxiaTokens` |
| Serverless | Vercel Functions (`api/*.ts`) + `vite-api-plugin.ts` em dev |
| Persistência | `localStorage` (15 chaves) — sem backend |
| IA | `/api/ai` multi-provider: Groq (default) / OpenAI / Anthropic / Gemini |
| Fontes | Cormorant, Playfair, EB Garamond, Manrope, JetBrains Mono |

**Build atual** (2026-05-28): `npm run build` OK, ~295 KB + ~459 KB (xlsx chunk), sem erros TS.

---

## 3. Features já implementadas (status v0)

| Feature | Status | Observação |
|---|---|---|
| Boot flow (Onboarding A/B → Login → Quiz → App) | ✅ | |
| Login placeholder (admin/1234) | ✅ | sem auth real |
| ScreenHome (patrimônio, AI insight, posições, alocação) | ✅ | |
| ScreenMarket (tabs Em Alta / Para Você / Watchlist / B3 / NASDAQ) | ✅ | sem tab Descobrir |
| ScreenStockDetail (chart + stats + análise IA + relatórios) | ✅ | |
| ScreenOrder / ScreenOrderReview (paper trading) | ✅ | |
| ScreenActivity (histórico transações) | ✅ | |
| ScreenProfile (accent, tom Pra, clear data) | ✅ | |
| ScreenBatchValuation (CSV/XLSX → Graham/Bazin em lote) | ✅ | acessível só via Profile |
| ScreenAlerts (4 tipos + Notification API) | ✅ | |
| ScreenCompare (2–4 ações lado a lado + IA) | ✅ | |
| ScreenNews (Feed + Tópicos, GDELT + Google News RSS) | ✅ | totalmente implementado |
| ChatSheet — Pra conversacional + elicitação de perfil | ✅ | |
| QuickWatch overlay | ✅ | |
| AlertSheet wizard | ✅ | |
| PortfolioInsightsModal (análise IA 4–8 cards + sentimento) | ✅ | |
| MacroQuotesStrip (USD/EUR/BTC/ETH) | ✅ | no ScreenHome |
| Score 0–100 com 5 dimensões | ✅ | |
| Polling 60s + alert engine | ✅ | |
| Multi-provider IA (env-driven) | ✅ | |
| System prompt mestre (`praxiaPrompt.ts`) | ✅ | XML + few-shot + chain of thought |
| Caching localStorage por TTL + signature | ✅ | |

---

## 4. O que mudou nesta sessão (2026-05-28)

### Bug corrigido — Alerta de margem Graham
**Arquivo**: `src/hooks/useAlerts.ts` linhas 42 e 60.

`calculateMarginOfSafety` retorna percentual (ex: 24 para 24%), mas o código multiplicava por 100 de novo → comparava 2400 ≥ 20, alerta disparava sempre.

**Fix**: removido o `× 100` nas duas ocorrências. Agora a comparação é `margin(%) >= alert.value(%)`, que é o comportamento correto.

### Seção "Valuation — Como calculamos" em ScreenStockDetail
Adicionada antes da `StockAIAnalysisSection`. Contém:
- **6 células de valuation**: Graham VI (√22,5×LPA×VPA), Teto Bazin (DPA÷0,06), Graham c/ Crescimento (LPA×(8,5+2×7)), Margem de Segurança, ROIC, Preço vs. Graham — cada uma com a fórmula em mono e tooltip explicativo.
- **Score breakdown visual**: 5 barras de progresso (Graham/Rentabilidade/Saúde/DY/Valuation) com pts/max e valor real do ativo vs. limiar.
- **CTA Batch Valuation**: botão "Calcule em lote — importe sua planilha" (visível se prop `onOpenBatch` fornecido).

**Ícones adicionados a Icon.tsx**: `upload`, `tableRows`.

**Prop adicionada**: `onOpenBatch?: () => void` em `ScreenStockDetailProps` — ainda não cabeada em `App.tsx` (próximo passo).

---

## 5. Roadmap — 10 fases de implementação

Aprovado na sessão de 2026-05-28. Documento completo no plano salvo em `~/.claude/plans/abstract-wishing-platypus.md`.

| Fase | O que é | Estimativa | Status |
|---|---|---|---|
| **Fase 0** | UX de Descoberta: seção Valuation + score breakdown + CTA Batch | 1–2 dias | ✅ **Concluída** |
| **Fase 0.5** | Bug: alerta margem Graham ×100 | < 30 min | ✅ **Concluída** |
| **Fase 1** | ScreenAnalysis: tela central de análise do portfólio | 2–3 dias | Pendente |
| **Fase 2** | Feature #6: Notícias + sentimento por ação | 2–3 dias | Pendente |
| **Fase 3** | Feature #1: Calendário de dividendos | 3 dias | Pendente |
| **Fase 4** | Feature #4: Screener com IA (tab Descobrir) | 3 dias | Pendente |
| **Fase 5** | Feature #3: Rebalanceador IA acionável | 3 dias | Pendente |
| **Fase 6** | Feature #9: Digest semanal (depende de #2+#3) | 2–3 dias | Pendente |
| **Fase 7** | Feature #10: Histórico de fundamentos | 3 dias | Pendente |
| **Fase 8** | Feature #8: Suporte a FIIs | 5–7 dias | Pendente |
| **Fase 9** | Feature #7: Calculadora de IR (depende de #8) | 4–5 dias | Pendente |

---

## 6. Próximos passos imediatos

1. **Cabear `onOpenBatch` em `App.tsx`** — passar a prop para `ScreenStockDetail` e `ScreenMarket`; faz o botão CTA aparecer.
2. **Iniciar Fase 1 — ScreenAnalysis**:
   - Criar `src/lib/portfolioScore.ts`
   - Criar `src/components/praxia/PortfolioScoreHero.tsx`
   - Criar `src/components/praxia/PortfolioInsightsContent.tsx` (extrair de PortfolioInsightsModal)
   - Criar `src/components/praxia/screens/ScreenAnalysis.tsx`
   - Adicionar `"analysis"` ao Screen union em `App.tsx`
   - Decidir aba BottomNav (substituir "Atividade" por "Análise")

---

## 7. Pendências conhecidas

| Item | Tipo | Impacto |
|---|---|---|
| `onOpenBatch` não cabeado em App.tsx | Faltante | Botão CTA não aparece na tela |
| `useStockSearch` implementado mas órfão | Faltante | Busca global não funciona |
| ScreenBatchValuation acessível só via Profile | UX | Feature escondida — ROADMAP pede link em ScreenStockDetail + ScreenMarket |
| Login placeholder (admin/1234) | Limitação | Sem auth real — roadmap v0.4 |
| Bundle ScreenBatchValuation 459 KB (xlsx) | Performance | Candidato a lazy load dinâmico |
| Sem testes formais de UI | Qualidade | Vitest + Playwright foram adicionados mas cobertura baixa |
| Modo claro (paper) disponível nos tokens | Feature | Sem toggle UI — planejado para v0.1 |

---

## 8. Arquivos críticos de referência rápida

| O que procurar | Onde |
|---|---|
| Screen routing | `src/App.tsx:59` (type Screen) |
| Tokens / paleta / fontes | `src/components/praxia/tokens.ts` |
| Score 0–100 | `src/lib/calculators.ts:calculateStockScore` |
| Fórmulas Graham/Bazin/Margem | `src/lib/calculators.ts` |
| System prompt mestre da Pra | `src/lib/praxiaPrompt.ts` |
| Multi-provider IA | `api/ai.ts` |
| Proxy Yahoo Finance | `api/brapi.ts` |
| Macro BCB SGS | `api/macro.ts` |
| Notícias RSS | `api/news.ts` |
| Notícias globais (GDELT + Reddit + BBC) | `api/world-news.ts` |
| Tipos canônicos | `src/types/stock.ts` |
| Todos os hooks | `src/hooks/` |
| Debug e troubleshooting | `DEBUG.md` → `docs/` |
| Roadmap completo | `ROADMAP.md` |
| Plano de execução | `~/.claude/plans/abstract-wishing-platypus.md` |

---

## 9. Regras inegociáveis de implementação

1. **IA sempre via `/api/ai`** — nunca expor API key no cliente
2. **Cache em localStorage** com TTL + invalidação por signature
3. **Modais sempre como siblings de `AppShell`** em `App.tsx` — nunca dentro de scroll containers
4. **Sem novas deps npm** salvo necessidade absoluta
5. **`import type`** para todos os tipos (`verbatimModuleSyntax: true`)
6. **`npm run build` deve passar** após cada fase — baseline: 0 erros novos
7. **Features com IA**: texto começa "Pelo seu perfil…" + citações `[N]`
8. **Qualquer feature com `Transaction`**: log alimenta ScreenActivity
