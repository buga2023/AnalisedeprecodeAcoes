# Tela de Análise — Plano de implementação

> Documento vivo. Quando o design final (mockup HTML/JSX) for colado no repositório, este plano vira a referência de "como conectar cada bloco visual com o que já existe no app". Quando uma dependência ainda não existir, este doc aponta o item correspondente do `ROADMAP.md`.

---

## Objetivo

Tela única que centraliza **toda a análise da carteira e dos ativos** num só lugar — o usuário entende em ≤5 segundos: "como minha carteira está, o que a Pra recomenda mudar, e onde devo olhar primeiro". Substitui o `PortfolioInsightsModal` como destino padrão do botão "Análise" do `ScreenHome` (modal vira atalho).

**Não é** uma tela de cotações nem de execução — quem opera é `ScreenOrder` / `applyTransaction`.

---

## Princípios herdados do ROADMAP

Valem 1:1 (mesmas regras que as outras features):

1. **IA via `/api/ai`** — toda IA passa pelo serverless, prompts seguem `SOURCE_AND_PROFILE_RULES` (`src/lib/ai.ts:66`). Sem key no cliente.
2. **Cache localStorage com TTL + signature** — padrão do `PortfolioInsightsModal` (6h, key `stocks-ai-portfolio-insights`) e do `StockAIAnalysisSection` (24h por ticker).
3. **Reuso de componentes** — `PraxiaCard`, `PraMark`, `DeltaPill`, `Tag`, `SectionHeader`, `AreaChart`, `HoldingRow`, tokens de `tokens.ts` (`fmt`, `genSeries`, `smoothPath`, `PraxiaTokens`).
4. **Modais sempre sibling de `AppShell`** em `App.tsx` (regra já documentada em `CLAUDE.md`).
5. **Sem novas deps npm** salvo necessidade absoluta.

---

## Boot flow proposto

Adicionar `"analysis"` ao `Screen` union em `App.tsx`. Acesso por:

- **Aba "Análise"** no `BottomNav` (substituindo ou somando a `activity` — ver "Decisão pendente #1")
- **Botão "Análise"** no hero do `ScreenHome` (já existe e hoje abre `PortfolioInsightsModal` — passa a setar `screen="analysis"`)
- **Deep-link da Pra** no chat: quando o usuário pergunta "como está minha carteira?", `ChatSheet` fecha e abre `analysis`
- **Card "Análise IA completa"** dentro do `AIInsightCard` na home

---

## Layout proposto (sem o design final, baseado nas seções existentes do app)

```
┌──────────────────────────────────────────┐
│  ← Voltar           Análise        🔔 4  │  ← topbar (badge de alertas reusa ScreenHome)
│                                          │
│  ┌─ Hero "Saúde da carteira" ─────────┐  │  ← novo: Score 0–100 do portfólio
│  │  85 / 100   "Carteira diversificada"│  │     calculado em src/lib/portfolio.ts
│  │  Score por dimensão: 5 mini-bars    │  │     (criar portfolioScore — ver Pendência A)
│  └──────────────────────────────────────┘  │
│                                          │
│  ┌─ Insights IA (4–8 cards) ─────────┐  │  ← REUSO direto: fetchAIInsights()
│  │  [Risco] Concentração 47% em FIIs  │  │     hoje vive em PortfolioInsightsModal
│  │  [Valuation] PETR4 com margem 24%  │  │     mover render p/ esta tela e manter
│  │  ... fontes: [1] BrAPI [2] cálculo │  │     modal só como atalho secundário
│  └──────────────────────────────────────┘  │
│                                          │
│  ┌─ Sua carteira hoje ──────────────┐  │  ← REUSO: totalPortfolioValue,
│  │  Patrimônio · Variação YTD · Hoje  │  │     todayChangeValue, totalCostBasis
│  │  [AreaChart sintético]             │  │     (já em src/lib/portfolio.ts)
│  └──────────────────────────────────────┘  │
│                                          │
│  ┌─ Top movers · Underweight ───────┐  │  ← REUSO: HoldingRow + dominantSector
│  │  +5.2% VALE3 · -3.1% B3SA3 · …     │  │
│  └──────────────────────────────────────┘  │
│                                          │
│  ┌─ Alocação setorial ──────────────┐  │  ← REUSO: sectorAllocation()
│  │  [barra empilhada + legenda]       │  │     mesmo componente do ScreenHome
│  └──────────────────────────────────────┘  │
│                                          │
│  ┌─ Próximas ações sugeridas ───────┐  │  ← novo: liga em #3 Rebalanceador
│  │  • Rebalancear (3 ordens)          │  │     do ROADMAP (ainda pendente)
│  │  • Comparar PETR4 vs PRIO3         │  │     → abre #2 Comparador (existe)
│  │  • Criar alerta em VALE3 < R$60    │  │     → abre AlertSheet (existe)
│  └──────────────────────────────────────┘  │
│                                          │
│  [Bottom Nav]                            │
└──────────────────────────────────────────┘
```

> Quando o design real for colado, cada bloco acima vira referência direta: o componente a usar, o hook a chamar, o cache a consultar.

---

## Conexão com features existentes

| Bloco da tela | Origem dos dados | Estado atual |
|---|---|---|
| **Score do portfólio** | `portfolioScore(stocks)` (a criar) | ❌ Falta `src/lib/portfolio.ts:portfolioScore`. Detalhe na **Pendência A** |
| **Insights IA** | `fetchAIInsights(stocks, profile)` em `src/lib/ai.ts:202` | ✅ Existe — hoje renderiza em `PortfolioInsightsModal.tsx`. Mover render p/ esta tela |
| **Patrimônio + variação** | `totalPortfolioValue`, `todayChangeValue`, `totalCostBasis` em `src/lib/portfolio.ts` | ✅ Existe |
| **Alocação setorial** | `sectorAllocation`, `dominantSector` em `src/lib/portfolio.ts` | ✅ Existe — reusa `AllocationBars` interno do `ScreenHome.tsx:323` |
| **Top movers** | `stocks.sort((a,b) => b.changePercent - a.changePercent).slice(0,3)` | ✅ Cálculo trivial, sem novo hook |
| **Badge de alertas** | `useAlerts().activeAlerts.length` | ✅ Existe (`src/hooks/useAlerts.ts:113`) |
| **Atalho "Rebalancear"** | `generateOrders(stocks, target, profile)` (#3 do ROADMAP) | ❌ Pendente — fallback: link p/ chat com pergunta pré-preenchida |
| **Atalho "Comparar"** | `addToCompareAndOpen` em `App.tsx:88` | ✅ Existe |
| **Atalho "Criar alerta"** | `setAlertSheetStock` em `App.tsx:77` | ✅ Existe |
| **Atalho "Dividendos mês"** | `useDividendCalendar` (#1 do ROADMAP) | ❌ Pendente — esconder card até feature #1 sair |
| **Atalho "Notícias material"** | `useNews` (#6 do ROADMAP) | ❌ Pendente — esconder card até feature #6 sair |

---

## Arquivos a criar / modificar

**Novos**
- `src/components/praxia/screens/ScreenAnalysis.tsx` — a tela em si
- `src/lib/portfolioScore.ts` — `portfolioScore(stocks)` derivada de `calculateStockScore` por ativo, ponderada por valor. Inclui `breakdown` com dimensões: diversification, valuation, profitability, health, dividends
- `src/components/praxia/PortfolioScoreHero.tsx` — hero card do score 0–100 com 5 mini-bars (estilo `ScoreBreakdown`)

**Modificados**
- `src/App.tsx` — novo `screen = "analysis"`, prop `onOpenAnalysis` em `ScreenHome` e `AIInsightCard`
- `src/components/praxia/BottomNav.tsx` — decidir aba (ver **Decisão pendente #1**)
- `src/components/praxia/screens/ScreenHome.tsx` — botão "Análise" do hero passa a chamar `onOpenAnalysis` em vez de abrir o modal
- `src/components/praxia/PortfolioInsightsModal.tsx` — refatorar para que o conteúdo (insights + sentimento + fontes) seja extraído num componente reutilizável `PortfolioInsightsContent`, consumido tanto pelo modal quanto pelo `ScreenAnalysis`

---

## Cache & invalidação

- Mesma key e TTL que o modal hoje: `stocks-ai-portfolio-insights` (6h, invalidado por signature `ticker:quantity|...`)
- Score local (`portfolioScore`) é puro/determinístico — recalcula no render via `useMemo`, sem cache
- Top movers / alocação / patrimônio: derivados em `useMemo` no próprio componente

---

## Integração com a Pra (chat)

Já existe um sinal natural: quando `usePraChat` detecta que o usuário pediu visão da carteira, devolver `{ ...mensagem, openScreen: "analysis" }` (extensão futura do hook). Hoje a Pra responde em texto; o gatilho exato pode ficar no prompt do `SOURCE_AND_PROFILE_RULES`. **Marcado como follow-up, não bloqueante**.

---

## Critérios de aceite (mesmo padrão do ROADMAP)

1. `npm run build` passa — baseline atual: 0 erros novos
2. `npm run lint` não introduz novos erros
3. Manual test:
   - Sem carteira → mostra empty state + CTA "Adicionar primeiro ativo"
   - Com carteira → score calcula, insights carregam, cache funciona (1ª visita gera, 2ª devolve do cache, 3ª após TTL gera de novo)
   - Atalhos abrem as telas certas: comparador, alertSheet, rebalanceador-quando-existir
4. Modal `PortfolioInsightsModal` continua funcionando (não removido — convive como atalho rápido)
5. Render como sibling do `AppShell` se houver modal sobre a tela (não dentro de scroll)

---

## Pendências para resolver junto com o design

### Pendência A — `portfolioScore` (sem isso, hero card não funciona)
Definir a fórmula. Sugestão inicial (a debater):

```
score_portfolio = sum(stock.score × peso) / sum(peso)
  + bônus por diversificação (Herfindahl invertido)
  + bônus por compatibilidade com perfil
  − penalidade por overweight setorial > 40%
```

Detalhe: 70% peso de fundamentos individuais + 30% peso de diversificação/perfil.

### Pendência B — Estrutura final do `PortfolioInsightsContent`
Hoje o modal renderiza tudo inline. Pra dividir entre modal e tela:
- `<PortfolioInsightsContent stocks={...} profile={...} />` retorna `{ resumo, sentimento, insights[], onRefresh }`
- Modal mantém botão de close
- Tela embute como uma `<section>`

### Pendência C — Aba no `BottomNav`
**Decisão pendente #1**: O `BottomNav` tem 4 slots (`home`, `market`, `activity`, `profile`). Opções:

1. Substituir `activity` por `analysis`, mover transações pra dentro do `profile`
2. Substituir `market` por `analysis`, mover busca de ações pra um botão FAB ou ScreenHome
3. Manter 4 e abrir `analysis` só via botão do `ScreenHome` (sem aba)

Aguardando o design pra decidir — provável que o mockup já indique.

---

## Como esse plano evolui

Quando você colar o design da tela:
1. Mapeio cada bloco visual ao **mapa de origem** desta tabela
2. Os blocos que dependem de features pendentes (#1 Dividendos, #3 Rebalanceador, #6 Notícias) entram com:
   - **placeholder funcional** apontando para o chat ou modal existente
   - **TODO inline** com a feature do ROADMAP que destrava o bloco
3. Atualizo o `ROADMAP.md` se algum bloco surgir uma necessidade nova não listada
