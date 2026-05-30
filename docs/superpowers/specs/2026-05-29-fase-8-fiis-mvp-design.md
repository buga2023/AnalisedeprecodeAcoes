# Fase 8 (MVP) — Suporte a FIIs

> Spec aprovado em 2026-05-29. Escopo: MVP enxuto (detecção + tipo + score + stats no detalhe + toggle no Mercado). Alocação separada, calendário mensal e stats de gestora ficam para uma fase posterior.

## Contexto

O Praxia hoje trata todo ativo como ação: aplica Graham VI, ROE, Dívida/EBITDA e P/L no score 0–100. FIIs (fundos imobiliários) não se encaixam nessa lógica — são cotas, não ações: não têm LPA pra Graham, e a tese é dominada por **DY mensal**, **P/VP** (desconto/ágio ao patrimônio) e **vacância**. Sem tratamento próprio, um FII na carteira recebe um score sem sentido (Graham e P/L zerados) e o detalhe mostra métricas inaplicáveis.

Objetivo: detectar FIIs automaticamente, pontuá-los com fórmula própria, e mostrar no detalhe as métricas que importam — mantendo a adição de ticker rápida e sem quebrar dados já persistidos.

## Decisões de design (aprovadas)

1. **Segmento via mapa estático + só vacância via scraping.** Segmento é estável e mapeável por raiz de ticker (barato, síncrono); vacância é o único dado que exige scraping.
2. **Score renormaliza quando a vacância falta** (scrape off/falhou): os pesos disponíveis escalam para /100 em vez de zerar a dimensão. Honesto, nunca inventa dado.

## Arquitetura

### 1. Tipo & detecção

**`src/types/stock.ts`** — estender `Stock` (campos opcionais, retrocompatíveis com localStorage/Supabase):
- `assetType?: "stock" | "fii"` (ausente ou `"stock"` = ação; só FIIs marcam `"fii"`).
- `vacancyRate?: number` (percentual, ex.: `8.5` para 8,5%; `undefined` quando não scrapeado).
- Segmento do FII reusa o campo `sector` existente.

**`src/lib/stockMeta.ts`** — nova função pura:
```ts
export function detectAssetType(ticker: string, name?: string): "stock" | "fii"
```
Retorna `"fii"` **somente** se `/^[A-Z]{4}11$/.test(ticker)` **E** `name` casar `/F\.?I\.?I|IMOB|FDO\.?\s*INV|IMOBILI/i`. Isso evita classificar units de ação (SANB11, TAEE11, BPAC11, KLBN11) como FII, já que têm o mesmo formato de ticker. Sem `name`, retorna `"stock"` (conservador).

Novo mapa estático `FII_SEGMENTS: Record<string, string>` por raiz de 4 letras (HGLG→"Logística", XPML/VISC→"Shopping", MXRF/KNCR→"Papel/Recebíveis", KNRI/HGRE→"Lajes/Híbrido", etc.), com helper `detectFIISegment(ticker): string` (fallback `"—"`). Mesmo padrão de `detectSector`/`SECTOR_HINTS`.

### 2. Vacância via scraping (lazy)

**`api/fii-data.ts`** (novo endpoint serverless) — análogo a `api/scrape.ts` mas devolve **campos estruturados**, não texto livre:
- URLs FII: Investidor10 `/fiis/{ticker}/`, StatusInvest `/fundos-imobiliarios/{ticker}`.
- Reusa `applyCors`, `checkRateLimit` (20/min) e o perfil de headers de browser-impersonation do `api/scrape.ts`.
- Extrai por regex sobre o texto da página: `vacancyRate` (procura "Vacância"/"Taxa de vacância" + número%), e segmento de reforço quando presente.
- Validação de ticker `/^[A-Z]{4}11$/`. Falha/bloqueio → `200` com `{}` (degradação graciosa), igual aos outros proxies.

**`src/lib/fiiData.ts`** (novo cliente):
```ts
export interface FIIData { vacancyRate?: number; segment?: string; fonte?: string }
export async function fetchFIIData(ticker: string): Promise<FIIData>
```
Cache localStorage `praxia-fii-data:{TICKER}` TTL 7d. Chamado **lazy no detalhe** (não em `addStock`).

### 3. Score FII

**`src/lib/fiiScore.ts`** (novo, puro):
```ts
export interface FIIScoreInput {
  dividendYield: number;   // anual, em % (ex.: 9.2)
  pvp: number;             // preço / VPA
  vacancyRate?: number;    // %, undefined quando não scrapeado
  segment?: string;        // de detectFIISegment
}
export function calculateFIIScore(input: FIIScoreInput): { total: number; breakdown: ScoreBreakdown }
```

Pesos cheios (somam 100): **DY 40 · P/VP 30 · Vacância 15 · Segmento 15**.

Faixas (rascunho — afinar nos testes):
- **DY** (40): >8% → 40; ≥6% → 30; ≥4% → 18; senão proporcional baixo.
- **P/VP** (30): ≤0,95 → 30; ≤1,05 → 22; ≤1,15 → 12; >1,15 → 4.
- **Vacância** (15): <5% → 15; <10% → 10; <15% → 5; senão 0. **`undefined` → dimensão omitida e renormaliza.**
- **Segmento** (15): segmentos resilientes (Logística, Papel/Recebíveis) → 15; cíclicos (Shopping, Lajes) → 10; desconhecido/`"—"` → 8 (neutro, não penaliza forte).

**Renormalização:** somar só os pesos das dimensões com dado; `total = round(somaPontos / somaPesosDisponíveis * 100)`. Reaproveita `getScoreLabel` de `calculators.ts` para o rótulo.

Mapear o `ScoreBreakdown` existente para as 4 dims do FII (`dividendScore`=DY, `valuationScore`=P/VP, `healthScore`=vacância, `profitabilityScore`=segmento, `priceScore`=0) — assim reaproveitamos o tipo sem criar um novo. As labels das barras na UI deixam claro o que cada uma representa para FII.

### 4. Integração & UI

**`src/lib/stockMapper.ts`** (`mapQuoteToStock`):
- `assetType = detectAssetType(quote.symbol, quote.longName ?? quote.shortName)`.
- Quando `"fii"`: `sector = detectFIISegment(ticker)`, e `score`/`scoreBreakdown` vêm de `calculateFIIScore({ dividendYield, pvp, segment })` (sem vacância ainda — entra no detalhe). Demais campos (lpa/vpa/graham) ficam como vierem do Yahoo, mas não influenciam o score.

**`src/components/praxia/FIIDetailStats.tsx`** (novo):
- Mostra: DY anualizado, P/VP, último rendimento mensal (do histórico de dividendos quando disponível), segmento, vacância.
- 4 barras de breakdown (reaproveita o visual do `ScoreDimBar` de `ScreenStockDetail`; extrair `ScoreDimBar` para um arquivo compartilhável se necessário, ou replicar mínimo).
- `useEffect` lazy: `fetchFIIData(ticker)` → seta `vacancyRate` → recomputa `calculateFIIScore` com as 4 dims e atualiza score/barras exibidos.
- Props: `{ fii: Stock; accent: string }`.

**`src/components/praxia/screens/ScreenStockDetail.tsx`**:
- Quando `stock.assetType === "fii"`: **esconder** o bloco "Valuation — Como calculamos" (células Graham/Bazin) e as 5 `ScoreDimBar` de ação; renderizar `<FIIDetailStats>` no lugar (após o card de análise calculada, antes de `StockAIAnalysisSection`).
- O hero/score number reusa o mesmo componente (cores por faixa via `getScoreLabel`).

**`src/components/praxia/screens/ScreenMarket.tsx`**:
- Toggle segmentado **"Ações | FIIs"** no topo (estado `assetFilter: "stock" | "fii"`), filtrando o `list` computado por `s.assetType` (FII = `assetType==="fii"`; Ações = ausente ou `"stock"`). As tabs existentes continuam operando sobre o subconjunto filtrado.

## Testes

Padrão `vitest` (igual `src/lib/calculators.test.ts`, sem I/O):
- **`src/lib/fiiScore.test.ts`**: FII ideal (DY alto + P/VP<1 + vacância baixa + logística → ~100), vacância alta derruba, ágio (P/VP>1,15) derruba, **dados faltando renormalizam** (sem vacância → escala /100 sobre 85 de peso).
- **`src/lib/stockMeta.test.ts`** (novo ou estender): `detectAssetType("HGLG11","CSHG Logística FII")→"fii"`, `detectAssetType("SANB11","Banco Santander")→"stock"`, `detectAssetType("PETR4",...)→"stock"`, `detectFIISegment("HGLG11")→"Logística"`.
- **`api/fii-data` parser**: dado um HTML de exemplo com "Vacância 7,2%", extrai `vacancyRate: 7.2`; HTML sem o campo → `{}`.

## Verificação end-to-end

1. `npx tsc -b` → 0 erros novos.
2. `npm run test:run` → suíte verde (atual 655; FIIs adicionam casos).
3. `npm run lint` → sem erros novos (baseline pré-existente ok).
4. `npm run build` → verde.
5. Manual (`npm run dev`): adicionar `HGLG11` → aparece como FII, score com fórmula FII, detalhe mostra `FIIDetailStats` (vacância carrega lazy via scrape, score recomputa), sem seção Graham; adicionar `SANB11` → continua tratado como ação (Graham presente); toggle "Ações | FIIs" no Mercado separa as listas.

## Regras do projeto respeitadas

- Sem nova dependência npm (reusa fetch/regex e infra de scrape existente).
- `import type` para todos os tipos (`verbatimModuleSyntax`).
- Cache localStorage com TTL (`praxia-fii-data:{TICKER}`, 7d).
- Degradação graciosa em todo proxy (200 + payload vazio em falha).
- Campos novos opcionais → não quebra dados persistidos.
- Mudanças cirúrgicas, rastreáveis ao escopo.
