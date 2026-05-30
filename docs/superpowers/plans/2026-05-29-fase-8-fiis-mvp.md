# Fase 8 (MVP) — Suporte a FIIs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detectar FIIs automaticamente, pontuá-los com fórmula própria (DY/P-VP/vacância/segmento) e mostrar no detalhe as métricas que importam, sem quebrar o tratamento de ações.

**Architecture:** Campos opcionais novos em `Stock` (`assetType`, `vacancyRate`) mantêm retrocompatibilidade. Detecção por ticker+nome em `stockMeta.ts`. Score puro em novo `fiiScore.ts`. Segmento via mapa estático (sync); vacância via novo endpoint de scraping. **DY do FII resolvido por cascata: histórico de dividendos → Yahoo `summaryDetail` → scraping.** UI condicional em `ScreenStockDetail` + toggle Ações/FIIs em `ScreenMarket`.

**Tech Stack:** React 19 + TS strict (`verbatimModuleSyntax`), Vitest, Vercel serverless (`api/*.ts`), inline styles + `PraxiaTokens`, cache localStorage.

Spec: `docs/superpowers/specs/2026-05-29-fase-8-fiis-mvp-design.md`.

**Unidade canônica:** `Stock.dividendYield` = **fração** (0.09 = 9%) — é o que `calculateStockScore` (`>0.06`) e a UI (`*100` ao exibir) já esperam. `calculateFIIScore` espera **%**, então o código FII converte na borda (`dividendYield * 100`).

---

## File Structure

**Criar:**
- `src/lib/fiiScore.ts` + `src/lib/fiiScore.test.ts` — score FII (puro).
- `src/lib/fiiData.ts` — cliente do endpoint de vacância/DY + cache.
- `api/fii-data.ts` + `api/fii-data.test.ts` — endpoint de scraping + parser puro.
- `src/components/praxia/ScoreDimBar.tsx` — extração do `ScoreDimBar`.
- `src/components/praxia/FIIDetailStats.tsx` — seção de stats do FII.
- `src/lib/stockMeta.test.ts` — testes de detecção.
- `src/lib/stockMapper.test.ts` — teste de wiring FII.

**Modificar:**
- `src/types/stock.ts:13-59` — `assetType`, `vacancyRate`.
- `src/lib/stockMeta.ts` — `detectAssetType`, `FII_SEGMENTS`, `detectFIISegment`.
- `api/brapi.ts:267,285-301` — módulo `summaryDetail` + DY como fração.
- `src/lib/dividends.ts` + `src/lib/dividends.test.ts` — `dividendYieldFromHistory`.
- `src/lib/stockMapper.ts:22-87` — `assetType`/`sector`/score FII.
- `src/components/praxia/screens/ScreenStockDetail.tsx` — import `ScoreDimBar`, esconder Valuation p/ FII, render `FIIDetailStats`.
- `src/components/praxia/screens/ScreenMarket.tsx` — toggle Ações/FIIs.

---

## Task 1: Tipos — `assetType` e `vacancyRate` em `Stock`

**Files:** Modify `src/types/stock.ts:13-59`

- [ ] **Step 1: Adicionar campos opcionais**

Em `interface Stock`, após `brandColor?: string;` (linha 44), inserir:
```ts
  /** Tipo do ativo. Ausente ou "stock" = ação; "fii" = fundo imobiliário. */
  assetType?: "stock" | "fii";
  /** Vacância do FII em % (ex.: 8.5). Só após scraping; undefined = sem dado. */
  vacancyRate?: number;
```

- [ ] **Step 2: Verificar tipos** — Run: `npx tsc -b` — Expected: 0 erros.

- [ ] **Step 3: Commit**
```bash
git add src/types/stock.ts
git commit -m "feat(types): assetType + vacancyRate em Stock (Fase 8)"
```

---

## Task 2: Detecção de FII e segmento em `stockMeta.ts`

**Files:** Modify `src/lib/stockMeta.ts`; Create `src/lib/stockMeta.test.ts`

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `src/lib/stockMeta.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { detectAssetType, detectFIISegment } from "./stockMeta";

describe("detectAssetType", () => {
  it("classifica FII por ticker 11 + nome imobiliário", () => {
    expect(detectAssetType("HGLG11", "CSHG LOGISTICA FDO INV IMOB")).toBe("fii");
    expect(detectAssetType("MXRF11", "MAXI RENDA FII")).toBe("fii");
    expect(detectAssetType("KNRI11", "KINEA RENDA IMOBILIARIA")).toBe("fii");
  });
  it("NÃO classifica units de ação como FII (mesmo formato 11)", () => {
    expect(detectAssetType("SANB11", "BANCO SANTANDER BRASIL")).toBe("stock");
    expect(detectAssetType("TAEE11", "TRANSMISSORA ALIANCA")).toBe("stock");
    expect(detectAssetType("BPAC11", "BANCO BTG PACTUAL")).toBe("stock");
    expect(detectAssetType("KLBN11", "KLABIN SA")).toBe("stock");
  });
  it("ações comuns são stock", () => {
    expect(detectAssetType("PETR4", "PETROLEO BRASILEIRO")).toBe("stock");
    expect(detectAssetType("AAPL", "Apple Inc")).toBe("stock");
  });
  it("sem nome, assume stock (conservador)", () => {
    expect(detectAssetType("HGLG11")).toBe("stock");
  });
});

describe("detectFIISegment", () => {
  it("mapeia raízes conhecidas", () => {
    expect(detectFIISegment("HGLG11")).toBe("Logística");
    expect(detectFIISegment("XPML11")).toBe("Shopping");
    expect(detectFIISegment("MXRF11")).toBe("Papel/Recebíveis");
  });
  it("desconhecido retorna —", () => {
    expect(detectFIISegment("ZZZZ11")).toBe("—");
  });
});
```

- [ ] **Step 2: Confirmar falha** — Run: `npm run test:run -- src/lib/stockMeta.test.ts` — Expected: FAIL (funções não existem).

- [ ] **Step 3: Implementar**

Ao final de `src/lib/stockMeta.ts`:
```ts
/** Raízes (4 letras) de FIIs conhecidos → segmento. Igual ao padrão de SECTOR_HINTS. */
const FII_SEGMENTS: Record<string, string> = {
  HGLG: 'Logística', BTLG: 'Logística', XPLG: 'Logística', VILG: 'Logística',
  XPML: 'Shopping', VISC: 'Shopping', HSML: 'Shopping', MALL: 'Shopping',
  MXRF: 'Papel/Recebíveis', KNCR: 'Papel/Recebíveis', KNIP: 'Papel/Recebíveis',
  IRDM: 'Papel/Recebíveis', RECR: 'Papel/Recebíveis', CPTS: 'Papel/Recebíveis',
  KNRI: 'Lajes/Híbrido', HGRE: 'Lajes Corporativas', PVBI: 'Lajes Corporativas',
  HGRU: 'Renda Urbana', TRXF: 'Renda Urbana', VGHF: 'Híbrido',
  RBRF: 'Fundo de Fundos', KFOF: 'Fundo de Fundos',
};

const FII_NAME_RE = /F\.?I\.?I|IMOB|FDO\.?\s*INV|IMOBILI/i;

/**
 * Detecta se o ticker é um FII. FIIs e units de ação compartilham o formato
 * XXXX11, então o nome (do Yahoo) é o desempate: só é FII se o nome casar
 * termos imobiliários. Sem nome, assume ação (conservador).
 */
export function detectAssetType(ticker: string, name?: string): "stock" | "fii" {
  const t = ticker.toUpperCase();
  if (!/^[A-Z]{4}11$/.test(t)) return "stock";
  if (name && FII_NAME_RE.test(name)) return "fii";
  return "stock";
}

/** Segmento do FII por raiz do ticker (heurístico; fallback "—"). */
export function detectFIISegment(ticker: string): string {
  const stem = ticker.toUpperCase().replace(/\d+$/, '').slice(0, 4);
  return FII_SEGMENTS[stem] ?? '—';
}
```

- [ ] **Step 4: Confirmar passagem** — Run: `npm run test:run -- src/lib/stockMeta.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/stockMeta.ts src/lib/stockMeta.test.ts
git commit -m "feat(fii): detectAssetType + detectFIISegment (Fase 8)"
```

---

## Task 3: Score FII puro — `fiiScore.ts`

**Files:** Create `src/lib/fiiScore.ts` + `src/lib/fiiScore.test.ts`

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `src/lib/fiiScore.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { calculateFIIScore } from "./fiiScore";

describe("calculateFIIScore", () => {
  it("FII ideal pontua ~100", () => {
    const { total, breakdown } = calculateFIIScore({ dividendYield: 10, pvp: 0.9, vacancyRate: 3, segment: "Logística" });
    expect(total).toBe(100);
    expect(breakdown.dividendScore).toBe(40);
    expect(breakdown.valuationScore).toBe(30);
    expect(breakdown.healthScore).toBe(15);
    expect(breakdown.profitabilityScore).toBe(15);
    expect(breakdown.priceScore).toBe(0);
  });
  it("vacância alta derruba o score", () => {
    const { total } = calculateFIIScore({ dividendYield: 10, pvp: 0.9, vacancyRate: 20, segment: "Logística" });
    expect(total).toBe(85);
  });
  it("ágio ao VP (P/VP>1,15) derruba valuation", () => {
    const { breakdown } = calculateFIIScore({ dividendYield: 10, pvp: 1.3, vacancyRate: 3, segment: "Logística" });
    expect(breakdown.valuationScore).toBe(4);
  });
  it("sem vacância renormaliza sobre as dims disponíveis", () => {
    const { total } = calculateFIIScore({ dividendYield: 10, pvp: 0.9, segment: "Logística" });
    expect(total).toBe(100);
  });
  it("segmento desconhecido é neutro, não zera", () => {
    const { breakdown } = calculateFIIScore({ dividendYield: 5, pvp: 1.0, segment: "—" });
    expect(breakdown.profitabilityScore).toBe(8);
  });
  it("DY e P/VP ausentes (<=0) são omitidos da renormalização", () => {
    const { total } = calculateFIIScore({ dividendYield: 0, pvp: 0, segment: "Logística" });
    expect(total).toBe(100);
  });
});
```

- [ ] **Step 2: Confirmar falha** — Run: `npm run test:run -- src/lib/fiiScore.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implementar**

Criar `src/lib/fiiScore.ts`:
```ts
/**
 * Scoring de FIIs (Fase 8) — fórmula própria, sem Graham/ROE.
 * Pesos: DY 40 · P/VP 30 · Vacância 15 · Segmento 15.
 * Dimensão sem dado (vacância não scrapeada, DY/P-VP ausentes) é OMITIDA e o
 * score renormaliza sobre os pesos disponíveis → escala /100.
 * Mapeia ScoreBreakdown: dividendScore=DY, valuationScore=P/VP, healthScore=vacância,
 * profitabilityScore=segmento, priceScore=0.
 */
import type { ScoreBreakdown } from "@/types/stock";

export interface FIIScoreInput {
  /** DY anual em % (ex.: 9.2). <=0 = sem dado. */
  dividendYield: number;
  /** Preço / VPA. <=0 = sem dado. */
  pvp: number;
  /** Vacância em %. undefined = sem dado. */
  vacancyRate?: number;
  /** Segmento de detectFIISegment. */
  segment?: string;
}

const RESILIENT = new Set(["Logística", "Papel/Recebíveis", "Renda Urbana"]);
const CYCLICAL = new Set(["Shopping", "Lajes Corporativas", "Lajes/Híbrido", "Híbrido"]);

export function calculateFIIScore(input: FIIScoreInput): { total: number; breakdown: ScoreBreakdown } {
  const { dividendYield, pvp, vacancyRate, segment } = input;

  const dyPresent = dividendYield > 0;
  let dyPts = 0;
  if (dividendYield > 8) dyPts = 40;
  else if (dividendYield >= 6) dyPts = 30;
  else if (dividendYield >= 4) dyPts = 18;
  else if (dividendYield > 0) dyPts = Math.round((dividendYield / 4) * 18);

  const pvpPresent = pvp > 0;
  let pvpPts = 0;
  if (pvp > 0 && pvp <= 0.95) pvpPts = 30;
  else if (pvp > 0 && pvp <= 1.05) pvpPts = 22;
  else if (pvp > 0 && pvp <= 1.15) pvpPts = 12;
  else if (pvp > 0) pvpPts = 4;

  const vacPresent = typeof vacancyRate === "number";
  let vacPts = 0;
  if (vacPresent) {
    const v = vacancyRate as number;
    if (v < 5) vacPts = 15;
    else if (v < 10) vacPts = 10;
    else if (v < 15) vacPts = 5;
    else vacPts = 0;
  }

  let segPts = 8;
  if (segment && RESILIENT.has(segment)) segPts = 15;
  else if (segment && CYCLICAL.has(segment)) segPts = 10;

  const dims = [
    { pts: dyPts, weight: 40, present: dyPresent },
    { pts: pvpPts, weight: 30, present: pvpPresent },
    { pts: vacPts, weight: 15, present: vacPresent },
    { pts: segPts, weight: 15, present: true },
  ];
  const availWeight = dims.reduce((s, d) => s + (d.present ? d.weight : 0), 0);
  const sumPts = dims.reduce((s, d) => s + (d.present ? d.pts : 0), 0);
  const total = availWeight > 0 ? Math.round((sumPts / availWeight) * 100) : 0;

  return {
    total,
    breakdown: { priceScore: 0, profitabilityScore: segPts, healthScore: vacPts, dividendScore: dyPts, valuationScore: pvpPts },
  };
}
```

- [ ] **Step 4: Confirmar passagem** — Run: `npm run test:run -- src/lib/fiiScore.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/fiiScore.ts src/lib/fiiScore.test.ts
git commit -m "feat(fii): calculateFIIScore com renormalização (Fase 8)"
```

---

## Task 4: Yahoo `summaryDetail` + DY como fração em `api/brapi.ts`

> Popula o DY (hoje ~0 porque é lido de `defaultKeyStatistics`, que não tem o campo). Efeito colateral benéfico: ativa a dimensão DY do score de **ações** também. Unidade passa a ser **fração** (o que UI e score já esperam).

**Files:** Modify `api/brapi.ts:267,285-301`

- [ ] **Step 1: Adicionar `summaryDetail` aos módulos**

Linha 267, trocar:
```ts
    const modules = "defaultKeyStatistics,financialData,incomeStatementHistoryQuarterly,balanceSheetHistoryQuarterly,cashflowStatementHistoryQuarterly";
```
por:
```ts
    const modules = "defaultKeyStatistics,summaryDetail,financialData,incomeStatementHistoryQuarterly,balanceSheetHistoryQuarterly,cashflowStatementHistoryQuarterly";
```

- [ ] **Step 2: Ler `summaryDetail` e corrigir a unidade do DY**

Após a linha 281 (`const fin = result.financialData || {};`), adicionar:
```ts
    const summary = result.summaryDetail || {};
```
Na linha 289, trocar:
```ts
      dividendYield: (stats.dividendYield?.raw || 0) * 100,
```
por:
```ts
      // Fração (0.09 = 9%) — o que a UI (*100 ao exibir) e calculateStockScore (>0.06) esperam.
      dividendYield: summary.dividendYield?.raw ?? summary.trailingAnnualDividendYield?.raw ?? stats.dividendYield?.raw ?? 0,
```

- [ ] **Step 3: Verificar tipos** — Run: `npx tsc -b` — Expected: 0 erros.

- [ ] **Step 4: Regressão da suíte** — Run: `npm run test:run` — Expected: verde. Se algum teste de `api/brapi`/quote afirmava o DY `*100`, ajustar a expectativa para fração (era um bug latente: o campo vinha ~0).

- [ ] **Step 5: Commit**
```bash
git add api/brapi.ts
git commit -m "fix(brapi): DY via summaryDetail como fração (ativa dimensão DY)"
```

---

## Task 5: `dividendYieldFromHistory` em `dividends.ts`

**Files:** Modify `src/lib/dividends.ts`; Modify `src/lib/dividends.test.ts`

- [ ] **Step 1: Escrever o teste (falhando)**

Anexar a `src/lib/dividends.test.ts`:
```ts
import { dividendYieldFromHistory } from "./dividends";

describe("dividendYieldFromHistory", () => {
  it("soma últimos 12 meses ÷ preço × 100", () => {
    const hist = [
      { date: "2025-09-10", amount: 1 },
      { date: "2025-12-10", amount: 1 },
      { date: "2026-03-10", amount: 1 },
      { date: "2026-05-10", amount: 1 },
    ];
    // último = 2026-05-10; janela 12m pega os 4 → soma 4; preço 100 → 4%
    expect(dividendYieldFromHistory(hist, 100)).toBeCloseTo(4);
  });
  it("retorna 0 sem histórico ou preço inválido", () => {
    expect(dividendYieldFromHistory([], 100)).toBe(0);
    expect(dividendYieldFromHistory([{ date: "2026-05-10", amount: 1 }], 0)).toBe(0);
  });
});
```
(Se o `import { describe, it, expect }` já existir no topo do arquivo, não duplicar — apenas adicionar o import nomeado de `dividendYieldFromHistory` e o novo `describe`.)

- [ ] **Step 2: Confirmar falha** — Run: `npm run test:run -- src/lib/dividends.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implementar**

Em `src/lib/dividends.ts`, adicionar export que reaproveita o helper privado `estimateAnnualTotal` (já definido no arquivo). Inserir logo após `projectDividends` (antes da seção `/* helpers puros */`):
```ts
/**
 * DY anual em % a partir do histórico: soma dos pagamentos nos últimos 12 meses
 * (a partir do mais recente) ÷ preço × 100. Retorna 0 se faltar dado.
 */
export function dividendYieldFromHistory(history: DividendEvent[], price: number): number {
  if (!history || history.length === 0 || !(price > 0)) return 0;
  const annual = estimateAnnualTotal(history);
  if (annual <= 0) return 0;
  return (annual / price) * 100;
}
```

- [ ] **Step 4: Confirmar passagem** — Run: `npm run test:run -- src/lib/dividends.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/dividends.ts src/lib/dividends.test.ts
git commit -m "feat(dividends): dividendYieldFromHistory para DY de FII (Fase 8)"
```

---

## Task 6: Wiring no `mapQuoteToStock`

**Files:** Modify `src/lib/stockMapper.ts`; Create `src/lib/stockMapper.test.ts`

- [ ] **Step 1: Escrever o teste (falhando)**

Criar `src/lib/stockMapper.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { mapQuoteToStock } from "./stockMapper";
import type { BrapiQuoteResult } from "@/lib/api";

function baseQuote(overrides: Partial<BrapiQuoteResult>): BrapiQuoteResult {
  return {
    symbol: "PETR4", shortName: "PETROLEO BRASILEIRO", longName: "PETROLEO BRASILEIRO S.A.",
    currency: "BRL", regularMarketPrice: 30, regularMarketChange: 0, regularMarketChangePercent: 0,
    regularMarketTime: "2026-05-29T12:00:00Z", earningsPerShare: 3, priceEarnings: 10,
    bookValue: 20, dividendYield: 0.08, ...overrides,
  } as BrapiQuoteResult;
}

describe("mapQuoteToStock — FIIs", () => {
  it("marca FII, segmento e score FII > 0", () => {
    const fii = mapQuoteToStock(baseQuote({
      symbol: "HGLG11", shortName: "CSHG LOGISTICA FDO INV IMOB", longName: "CSHG LOGISTICA FDO INV IMOB",
      bookValue: 160, regularMarketPrice: 150, dividendYield: 0.09,
    }));
    expect(fii.assetType).toBe("fii");
    expect(fii.sector).toBe("Logística");
    expect(fii.score).toBeGreaterThan(0);
  });
  it("unit de ação (SANB11) continua sendo stock", () => {
    expect(mapQuoteToStock(baseQuote({ symbol: "SANB11", shortName: "BANCO SANTANDER BRASIL", longName: "BANCO SANTANDER BRASIL SA" })).assetType).toBe("stock");
  });
  it("ação comum é stock", () => {
    expect(mapQuoteToStock(baseQuote({})).assetType).toBe("stock");
  });
});
```

- [ ] **Step 2: Confirmar falha** — Run: `npm run test:run -- src/lib/stockMapper.test.ts` — Expected: FAIL (`assetType` undefined).

- [ ] **Step 3: Implementar**

3a. Linha 4, atualizar import:
```ts
import { detectMarket, detectSector, brandColor, detectAssetType, detectFIISegment } from "@/lib/stockMeta";
```
3b. Após a linha 3, adicionar:
```ts
import { calculateFIIScore } from "@/lib/fiiScore";
```
3c. Substituir o bloco do score (linhas 48-56):
```ts
  const { total, breakdown } = calculateStockScore({
    price,
    grahamValue,
    roe,
    debtToEbitda,
    dividendYield,
    pl,
    evEbitda,
  });
```
por:
```ts
  const name = quote.shortName ?? quote.longName ?? quote.symbol;
  const assetType = detectAssetType(quote.symbol, name);
  const isFii = assetType === "fii";
  const segment = isFii ? detectFIISegment(quote.symbol) : detectSector(quote.symbol);

  const { total, breakdown } = isFii
    ? calculateFIIScore({
        dividendYield: dividendYield * 100, // Stock.dividendYield é fração; fiiScore espera %
        pvp,
        segment,
        // vacância entra depois (FIIDetailStats, scraping lazy)
      })
    : calculateStockScore({ price, grahamValue, roe, debtToEbitda, dividendYield, pl, evEbitda });
```
3d. Substituir as linhas 82-84 do objeto retornado:
```ts
    name: quote.shortName ?? quote.longName ?? quote.symbol,
    market: detectMarket(quote.symbol),
    sector: detectSector(quote.symbol),
```
por:
```ts
    name,
    assetType,
    market: detectMarket(quote.symbol),
    sector: segment,
```

- [ ] **Step 4: Confirmar passagem** — Run: `npm run test:run -- src/lib/stockMapper.test.ts` — Expected: PASS.

- [ ] **Step 5: Regressão** — Run: `npm run test:run` — Expected: verde.

- [ ] **Step 6: Commit**
```bash
git add src/lib/stockMapper.ts src/lib/stockMapper.test.ts
git commit -m "feat(fii): mapQuoteToStock marca FII e usa score FII (Fase 8)"
```

---

## Task 7: Endpoint `/api/fii-data` (vacância + DY de scraping)

**Files:** Create `api/fii-data.ts` + `api/fii-data.test.ts`

- [ ] **Step 1: Escrever os testes do parser (falhando)**

Criar `api/fii-data.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseFIIFields } from "./fii-data";

describe("parseFIIFields", () => {
  it("extrai vacância com vírgula decimal", () => {
    expect(parseFIIFields("Taxa de Vacância 7,20 % outras infos").vacancyRate).toBeCloseTo(7.2);
  });
  it("extrai vacância inteira", () => {
    expect(parseFIIFields("Vacância Física 0% no período").vacancyRate).toBe(0);
  });
  it("extrai dividend yield", () => {
    expect(parseFIIFields("Dividend Yield 9,80 % ao ano").dividendYield).toBeCloseTo(9.8);
  });
  it("retorna vazio quando não há campos", () => {
    expect(parseFIIFields("Conteúdo irrelevante")).toEqual({});
  });
  it("ignora percentuais absurdos (>100)", () => {
    expect(parseFIIFields("Vacância 250%").vacancyRate).toBeUndefined();
  });
});
```

- [ ] **Step 2: Confirmar falha** — Run: `npm run test:run -- api/fii-data.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implementar**

Criar `api/fii-data.ts`:
```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors } from './_cors';
import { checkRateLimit } from './_ratelimit';

const FONTES = {
  investidor10: (t: string) => `https://investidor10.com.br/fiis/${t.toLowerCase()}/`,
  statusinvest: (t: string) => `https://statusinvest.com.br/fundos-imobiliarios/${t.toLowerCase()}`,
};

function headersFor(target: string): Record<string, string> {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
    Referer: target.includes("investidor10") ? "https://investidor10.com.br/" : "https://statusinvest.com.br/",
    "Sec-Fetch-Dest": "document", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Site": "same-origin",
    "Upgrade-Insecure-Requests": "1",
  };
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 8000);
}

export interface FIIFields {
  vacancyRate?: number;
  dividendYield?: number; // em %
  segment?: string;
}

/** Extrai campos estruturados do texto da página de um FII. Puro e testável. */
export function parseFIIFields(text: string): FIIFields {
  const out: FIIFields = {};
  const vac = text.match(/vac[âa]ncia[^%]{0,40}?(\d{1,3}(?:,\d{1,2})?)\s*%/i);
  if (vac) {
    const n = parseFloat(vac[1].replace(",", "."));
    if (!Number.isNaN(n) && n >= 0 && n <= 100) out.vacancyRate = n;
  }
  const dy = text.match(/dividend\s*yield[^%]{0,40}?(\d{1,3}(?:,\d{1,2})?)\s*%/i);
  if (dy) {
    const n = parseFloat(dy[1].replace(",", "."));
    if (!Number.isNaN(n) && n > 0 && n <= 100) out.dividendYield = n;
  }
  const seg = text.match(/segmento[:\s]{0,5}([A-Za-zÀ-ÿ\/ ]{3,30}?)(?:\s{2,}|$|\d)/i);
  if (seg) out.segment = seg[1].trim();
  return out;
}

async function scrape(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, { headers: headersFor(url), signal: controller.signal });
    if (!res.ok) return "";
    return htmlToText(await res.text());
  } catch {
    return "";
  } finally {
    clearTimeout(timeoutId);
  }
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (applyCors(request, response, 'GET, OPTIONS')) return;
  const rate = checkRateLimit(request, { windowMs: 60_000, max: 20, burstMax: 3, burstWindowMs: 5_000 });
  if (!rate.allowed) {
    response.setHeader('Retry-After', String(rate.retryAfterSec));
    return response.status(429).json({ error: 'rate-limited', retryAfterSec: rate.retryAfterSec });
  }

  const raw = Array.isArray(request.query.ticker) ? request.query.ticker[0] : (request.query.ticker as string);
  const ticker = raw?.toUpperCase();
  if (!ticker || !/^[A-Z]{4}11$/.test(ticker)) {
    return response.status(400).json({ error: "Ticker de FII inválido. Use formato XXXX11 (ex: HGLG11)" });
  }

  try {
    for (const url of [FONTES.investidor10(ticker), FONTES.statusinvest(ticker)]) {
      const text = await scrape(url);
      if (text && text.length >= 200) {
        const fields = parseFIIFields(text);
        if (fields.vacancyRate !== undefined || fields.dividendYield !== undefined || fields.segment) {
          return response.status(200).json({ ticker, ...fields, fonte: url });
        }
      }
    }
    return response.status(200).json({ ticker });
  } catch (error) {
    console.error("Erro no proxy fii-data:", error);
    return response.status(200).json({ ticker });
  }
}
```

- [ ] **Step 4: Confirmar passagem** — Run: `npm run test:run -- api/fii-data.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add api/fii-data.ts api/fii-data.test.ts
git commit -m "feat(fii): endpoint /api/fii-data (vacância + DY + segmento) (Fase 8)"
```

---

## Task 8: Cliente + cache — `fiiData.ts`

**Files:** Create `src/lib/fiiData.ts`

- [ ] **Step 1: Implementar**

Criar `src/lib/fiiData.ts`:
```ts
/**
 * Cliente do endpoint /api/fii-data — vacância, DY (%) e segmento de reforço de FIIs.
 * Cache localStorage 7d por ticker. Falha → objeto vazio (degradação graciosa).
 */
export interface FIIData {
  vacancyRate?: number;
  /** DY em % (ex.: 9.8) extraído por scraping. */
  dividendYield?: number;
  segment?: string;
  fonte?: string;
}

const CACHE_PREFIX = "praxia-fii-data:";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry { data: FIIData; cachedAt: number }

function readCache(ticker: string): FIIData | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + ticker.toUpperCase());
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.cachedAt > TTL_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache(ticker: string, data: FIIData): void {
  try {
    localStorage.setItem(CACHE_PREFIX + ticker.toUpperCase(), JSON.stringify({ data, cachedAt: Date.now() }));
  } catch {
    /* quota cheia — ignorar */
  }
}

export async function fetchFIIData(ticker: string): Promise<FIIData> {
  const cached = readCache(ticker);
  if (cached) return cached;
  try {
    const res = await fetch(`/api/fii-data?ticker=${encodeURIComponent(ticker.toUpperCase())}`);
    if (!res.ok) return {};
    const data = (await res.json()) as FIIData;
    const clean: FIIData = {
      vacancyRate: typeof data.vacancyRate === "number" ? data.vacancyRate : undefined,
      dividendYield: typeof data.dividendYield === "number" ? data.dividendYield : undefined,
      segment: data.segment,
      fonte: data.fonte,
    };
    writeCache(ticker, clean);
    return clean;
  } catch {
    return {};
  }
}
```

- [ ] **Step 2: Verificar tipos** — Run: `npx tsc -b` — Expected: 0 erros.

- [ ] **Step 3: Commit**
```bash
git add src/lib/fiiData.ts
git commit -m "feat(fii): cliente fetchFIIData + cache 7d (Fase 8)"
```

---

## Task 9: Extrair `ScoreDimBar` para componente compartilhado

**Files:** Create `src/components/praxia/ScoreDimBar.tsx`; Modify `ScreenStockDetail.tsx`

- [ ] **Step 1: Criar o componente extraído**

Criar `src/components/praxia/ScoreDimBar.tsx` com o corpo idêntico ao `ScoreDimBar` hoje em `ScreenStockDetail.tsx:897-969`, exportado:
```tsx
import { PraxiaTokens } from "./tokens";

/** Barra de uma dimensão do score (pts/max + barra + detalhe). Reusada em ações e FIIs. */
export function ScoreDimBar({ label, pts, max, detail, accent }: {
  label: string; pts: number; max: number; detail: string; accent: string;
}) {
  const T = PraxiaTokens;
  const pct = max > 0 ? Math.round((pts / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
        <div style={{ fontFamily: T.body, fontSize: 11, color: T.ink70, fontWeight: 500 }}>{label}</div>
        <div style={{ fontFamily: T.mono, fontSize: 10, color: pts === max ? T.up : pts > 0 ? T.warn : T.ink30, fontWeight: 600 }}>
          {pts}/{max} pts
        </div>
      </div>
      <div style={{ height: 4, borderRadius: 3, background: T.hairline, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 3, background: pts === max ? T.up : pts > 0 ? accent : T.down, transition: "width 0.4s ease" }} />
      </div>
      <div style={{ marginTop: 2, fontFamily: T.mono, fontSize: 9, color: T.ink30, letterSpacing: 0.2 }}>{detail}</div>
    </div>
  );
}
```

- [ ] **Step 2: Remover a definição local e importar**

Em `ScreenStockDetail.tsx`: deletar a função local `ScoreDimBar` (linhas 897-969) e adicionar após a linha 9:
```ts
import { ScoreDimBar } from "../ScoreDimBar";
```

- [ ] **Step 3: Verificar tipos** — Run: `npx tsc -b` — Expected: 0 erros (as 5 chamadas existentes seguem válidas).

- [ ] **Step 4: Commit**
```bash
git add src/components/praxia/ScoreDimBar.tsx src/components/praxia/screens/ScreenStockDetail.tsx
git commit -m "refactor(ui): extrai ScoreDimBar para componente reusável (Fase 8)"
```

---

## Task 10: Componente `FIIDetailStats` (DY em cascata + vacância lazy)

**Files:** Create `src/components/praxia/FIIDetailStats.tsx`

- [ ] **Step 1: Implementar**

Criar `src/components/praxia/FIIDetailStats.tsx`. Resolve DY por cascata (histórico → quote → scrape) e busca vacância; recomputa o score quando os dados chegam.
```tsx
import { useEffect, useState } from "react";
import { PraxiaTokens } from "./tokens";
import { PraxiaCard } from "./PraxiaCard";
import { ScoreDimBar } from "./ScoreDimBar";
import { calculateFIIScore } from "@/lib/fiiScore";
import { fetchFIIData } from "@/lib/fiiData";
import { fetchDividendHistory, dividendYieldFromHistory } from "@/lib/dividends";
import type { Stock } from "@/types/stock";

export function FIIDetailStats({ fii, accent }: { fii: Stock; accent: string }) {
  const T = PraxiaTokens;
  const [vacancyRate, setVacancyRate] = useState<number | undefined>(fii.vacancyRate);
  // DY do quote (fração → %); fallbacks de histórico/scrape sobrescrevem se vierem > 0.
  const [dyPct, setDyPct] = useState<number>(fii.dividendYield > 0 ? fii.dividendYield * 100 : 0);

  useEffect(() => {
    let active = true;
    // (a) histórico de dividendos — fonte preferida pra FII
    fetchDividendHistory(fii.ticker).then((hist) => {
      if (!active) return;
      const fromHist = dividendYieldFromHistory(hist, fii.price);
      if (fromHist > 0) setDyPct(fromHist);
    });
    // (c) scraping — vacância (e DY de reforço quando o resto falhar)
    fetchFIIData(fii.ticker).then((d) => {
      if (!active) return;
      if (typeof d.vacancyRate === "number") setVacancyRate(d.vacancyRate);
      if (typeof d.dividendYield === "number") {
        setDyPct((prev) => (prev > 0 ? prev : d.dividendYield as number));
      }
    });
    return () => { active = false; };
  }, [fii.ticker, fii.price]);

  const { total, breakdown } = calculateFIIScore({ dividendYield: dyPct, pvp: fii.pvp, vacancyRate, segment: fii.sector });

  return (
    <PraxiaCard padding={16} style={{ marginTop: 16, border: `0.5px solid ${T.hairlineStrong}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontFamily: T.displaySC, fontSize: 11, color: T.ink50, letterSpacing: 1.2, textTransform: "uppercase" }}>
          Fundo Imobiliário — Indicadores
        </div>
        <div style={{ fontFamily: T.mono, fontSize: 9, color: T.ink30, letterSpacing: 0.6 }}>FII</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <FIIStat label="Dividend Yield" value={dyPct > 0 ? `${dyPct.toFixed(1)}%` : "—"} color={dyPct >= 6 ? T.up : T.ink} />
        <FIIStat label="P/VP" value={fii.pvp > 0 ? fii.pvp.toFixed(2) : "—"} color={fii.pvp > 0 && fii.pvp <= 1.05 ? T.up : T.warn} />
        <FIIStat label="Segmento" value={fii.sector && fii.sector !== "—" ? fii.sector : "—"} />
        <FIIStat label="Vacância" value={typeof vacancyRate === "number" ? `${vacancyRate.toFixed(1)}%` : "—"} color={typeof vacancyRate === "number" ? (vacancyRate < 10 ? T.up : T.down) : T.ink50} />
      </div>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `0.5px dashed ${T.hairline}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontFamily: T.displaySC, fontSize: 11, color: T.ink50, letterSpacing: 1.2 }}>Score FII</div>
          <div style={{ fontFamily: T.mono, fontWeight: 700, fontSize: 15, color: total >= 70 ? T.up : total >= 40 ? T.warn : T.down, letterSpacing: -0.3 }}>
            {total}<span style={{ fontSize: 10, color: T.ink50, fontWeight: 400, marginLeft: 1 }}>/100</span>
          </div>
        </div>
        <ScoreDimBar label="Dividend Yield" pts={breakdown.dividendScore} max={40} detail={`DY ${dyPct > 0 ? dyPct.toFixed(1) + "%" : "N/D"} — máx. em >8%`} accent={accent} />
        <ScoreDimBar label="P/VP (desconto ao patrimônio)" pts={breakdown.valuationScore} max={30} detail={`P/VP ${fii.pvp > 0 ? fii.pvp.toFixed(2) : "N/D"} — máx. em ≤0,95`} accent={accent} />
        {typeof vacancyRate === "number" && (
          <ScoreDimBar label="Vacância" pts={breakdown.healthScore} max={15} detail={`${vacancyRate.toFixed(1)}% — máx. em <5%`} accent={accent} />
        )}
        <ScoreDimBar label="Segmento" pts={breakdown.profitabilityScore} max={15} detail={fii.sector && fii.sector !== "—" ? fii.sector : "segmento não mapeado"} accent={accent} />
        {typeof vacancyRate !== "number" && (
          <div style={{ marginTop: 4, fontFamily: T.mono, fontSize: 9, color: T.ink30 }}>
            Vacância indisponível — score normalizado sobre os indicadores com dado.
          </div>
        )}
      </div>
    </PraxiaCard>
  );
}

function FIIStat({ label, value, color }: { label: string; value: string; color?: string }) {
  const T = PraxiaTokens;
  return (
    <div style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: `0.5px solid ${T.hairline}` }}>
      <div style={{ fontFamily: T.body, fontSize: 10, color: T.ink50, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: T.mono, fontSize: 14, fontWeight: 600, color: color ?? T.ink, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}
```

> Confirmar que `T.hairlineStrong` existe em `tokens.ts` (já usado em `ScreenStockDetail`). Se não existir, usar `T.hairline`.

- [ ] **Step 2: Verificar tipos** — Run: `npx tsc -b` — Expected: 0 erros.

- [ ] **Step 3: Commit**
```bash
git add src/components/praxia/FIIDetailStats.tsx
git commit -m "feat(fii): FIIDetailStats com DY em cascata + vacância lazy (Fase 8)"
```

---

## Task 11: Render condicional em `ScreenStockDetail`

**Files:** Modify `src/components/praxia/screens/ScreenStockDetail.tsx`

- [ ] **Step 1: Importar `FIIDetailStats`** — após a linha 9:
```ts
import { FIIDetailStats } from "../FIIDetailStats";
```

- [ ] **Step 2: Condicionar o bloco Valuation/Graham**

O `<PraxiaCard>` da seção "Valuation — Como calculamos" vai da linha 565 ao `</PraxiaCard>` da linha 762. Envolver:

Imediatamente antes do `<PraxiaCard` (linha 565):
```tsx
{stock.assetType === "fii" ? (
  <FIIDetailStats fii={stock} accent={accent} />
) : (
```
Imediatamente após o `</PraxiaCard>` (linha 762):
```tsx
)}
```

- [ ] **Step 3: Verificar tipos** — Run: `npx tsc -b` — Expected: 0 erros (conferir balanço de `(`/`)` e JSX).

- [ ] **Step 4: Commit**
```bash
git add src/components/praxia/screens/ScreenStockDetail.tsx
git commit -m "feat(fii): detalhe mostra FIIDetailStats e esconde Graham p/ FII (Fase 8)"
```

---

## Task 12: Toggle Ações | FIIs em `ScreenMarket`

**Files:** Modify `src/components/praxia/screens/ScreenMarket.tsx`

- [ ] **Step 1: Lista de discovery FII + estado do filtro**

Após `DISCOVERY_NASDAQ` (linha 47):
```ts
const DISCOVERY_FII = ["HGLG11", "MXRF11", "KNRI11", "XPML11", "VISC11", "KNCR11", "BTLG11", "HGRU11"];
```
Após `const [tab, setTab] = useState<Tab>("trending");` (linha 65):
```ts
const [assetFilter, setAssetFilter] = useState<"stock" | "fii">("stock");
```

- [ ] **Step 2: Escopar o universo por tipo**

Antes de `const list = useMemo(...)` (linha 78):
```ts
const scopedStocks = useMemo(
  () => stocks.filter((s) => (assetFilter === "fii" ? s.assetType === "fii" : s.assetType !== "fii")),
  [stocks, assetFilter]
);
```
No `list` (linhas 78-90): trocar todas as referências de `stocks` por `scopedStocks` e adicionar `assetFilter` às deps. Idem em `movers` (linhas 104-107).

Substituir `discoveryTickers` (linhas 93-102) por:
```ts
const discoveryTickers = useMemo(() => {
  const owned = new Set(stocks.map((s) => s.ticker.toUpperCase()));
  const base =
    assetFilter === "fii"
      ? DISCOVERY_FII
      : tab === "NASDAQ"
      ? DISCOVERY_NASDAQ
      : tab === "B3" || tab === "trending" || tab === "para-voce"
      ? DISCOVERY_B3
      : [];
  return base.filter((t) => !owned.has(t)).slice(0, 8);
}, [stocks, tab, assetFilter]);
```

- [ ] **Step 3: Renderizar o toggle**

Logo antes do `<div>` de tabs (linha 389):
```tsx
{/* toggle Ações | FIIs */}
<div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
  {(["stock", "fii"] as const).map((f) => (
    <button
      key={f}
      onClick={() => setAssetFilter(f)}
      style={{
        flex: 1, height: 32, borderRadius: 999,
        background: assetFilter === f ? accent : "rgba(255,255,255,0.05)",
        color: assetFilter === f ? "#fff" : T.ink70,
        border: assetFilter === f ? "none" : `0.5px solid ${T.hairline}`,
        fontFamily: T.body, fontWeight: 600, fontSize: 12.5, cursor: "pointer",
      }}
    >
      {f === "stock" ? "Ações" : "FIIs"}
    </button>
  ))}
</div>
```

- [ ] **Step 4: Empty-state da lista FII**

Substituir o texto fixo (linhas 517-519):
```tsx
{tab === "watchlist"
  ? "Sua watchlist está vazia. Toque na estrela em uma ação."
  : "Nenhum ativo aqui ainda."}
```
por:
```tsx
{tab === "watchlist"
  ? "Sua watchlist está vazia. Toque na estrela em uma ação."
  : assetFilter === "fii"
  ? "Nenhum FII na carteira. Adicione um FII (ex: HGLG11) ou toque numa sugestão abaixo."
  : "Nenhum ativo aqui ainda."}
```

- [ ] **Step 5: Verificar tipos** — Run: `npx tsc -b` — Expected: 0 erros.

- [ ] **Step 6: Commit**
```bash
git add src/components/praxia/screens/ScreenMarket.tsx
git commit -m "feat(fii): toggle Ações|FIIs no Mercado + discovery de FIIs (Fase 8)"
```

---

## Task 13: Verificação final end-to-end

- [ ] **Step 1: Suíte completa** — Run: `npm run test:run` — Expected: verde (655 anteriores + novos: stockMeta, fiiScore, dividends, stockMapper, fii-data).

- [ ] **Step 2: Lint** — Run: `npm run lint` — Expected: sem erros novos.

- [ ] **Step 3: Build** — Run: `npm run build` — Expected: verde.

- [ ] **Step 4: Manual (`npm run dev`)**
1. Adicionar `HGLG11` → marcado como FII; detalhe mostra `FIIDetailStats` (DY via histórico/scrape, P/VP, segmento "Logística", vacância lazy; Score recomputa), **sem** "Valuation — Como calculamos".
2. Adicionar `SANB11` → tratado como ação (Graham presente, sem FIIDetailStats).
3. Mercado: toggle "Ações | FIIs" separa as listas; com "FIIs" e sem FII na carteira, aparece empty-state + sugestões `DISCOVERY_FII`.
4. Adicionar `PETR4` → ação normal; conferir que agora o DY aparece preenchido (efeito do summaryDetail) e o score reflete isso.

- [ ] **Step 5: Atualizar `SITUAÇÃO_ATUAL.md`**

Marcar Fase 8 (MVP) concluída (tabela seção 5) + nova seção curta: arquivos novos, novo endpoint `/api/fii-data`, nova chave de cache `praxia-fii-data:{TICKER}`, mudança transversal (DY via `summaryDetail` ativou a dimensão DY do score de ações), pendências da próxima fase (alocação separada, calendário mensal, stats de gestora/nº cotistas).

- [ ] **Step 6: Commit final**
```bash
git add SITUAÇÃO_ATUAL.md
git commit -m "docs(situacao): Fase 8 MVP (FIIs) concluída"
```

---

## Verification (resumo)

- `npx tsc -b` → 0 erros.
- `npm run test:run` → verde, com novos testes (`stockMeta`, `fiiScore`, `dividends`, `stockMapper`, `fii-data`).
- `npm run lint` → baseline (sem regressão nova).
- `npm run build` → verde.
- Manual: HGLG11 (FII completo, DY em cascata), SANB11 (ação), toggle no Mercado, PETR4 (DY agora populado).
