import type { Stock } from "@/types/stock";
import { fetchMultipleQuotes } from "@/lib/api";
import { mapQuoteToStock } from "@/lib/stockMapper";

/**
 * Screener fundamentalista (Fase 4 — "Descobrir").
 *
 * A IA traduz o texto do usuário em `ScreenerFilter`; aqui filtramos e
 * ranqueamos um universo curado de ações líquidas da B3 usando o MESMO motor
 * de score/valuation da carteira (`stockMapper` → `calculators`). Sem endpoint
 * novo: reaproveita `/api/brapi` (proxy Yahoo já endurecido, cap 30/call).
 *
 * Trabalha só com dados REAIS do Yahoo. Tickers que o Yahoo não retornar são
 * simplesmente omitidos — nunca fabricamos métrica.
 */

/** Universo curado de ações líquidas da B3 (não é o IBOV inteiro — subset). */
export const SCREENER_UNIVERSE: string[] = [
  "PETR4", "VALE3", "ITUB4", "BBDC4", "BBAS3", "ABEV3", "WEGE3", "RENT3",
  "SUZB3", "GGBR4", "SANB11", "B3SA3", "TAEE11", "CYRE3", "LREN3", "RADL3",
  "JBSS3", "EMBR3", "RAIL3", "ELET3", "EQTL3", "VIVT3", "CPLE6", "CSNA3",
  "HYPE3", "UGPA3", "PRIO3", "TOTS3", "BBSE3", "ITSA4", "KLBN11", "CMIG4",
  "VBBR3", "CPFE3", "FLRY3", "RDOR3",
];

/** Rótulos de setor que o `detectSector` produz para o universo acima. */
export const SCREENER_SECTORS: string[] = [
  "Bancos", "Energia", "Mineração", "Varejo", "Industrial", "Seguros",
  "Papel & Celulose", "Locação", "Saúde",
];

export type ScreenerSortBy = "score" | "dy" | "roe" | "marginOfSafety";

/**
 * Critérios de filtro. ROE/DY/Margem de Segurança são em PERCENTUAL (15 = 15%)
 * — escala amigável pra IA e pra exibição. Os demais são razões absolutas.
 */
export interface ScreenerFilter {
  minScore?: number;            // 0–100
  minRoePct?: number;           // ex.: 15
  minDyPct?: number;            // ex.: 6
  maxPl?: number;               // ex.: 12
  maxPvp?: number;              // ex.: 2
  maxDebtToEbitda?: number;     // ex.: 2
  minMarginOfSafetyPct?: number; // ex.: 20 (preço abaixo do Graham)
  sectors?: string[];          // rótulos exatos de SCREENER_SECTORS
  sortBy?: ScreenerSortBy;
}

export interface ScreenerResult {
  /** Top ações que passaram nos filtros (full Stock — abre QuickWatch/Adicionar). */
  results: Stock[];
  /** Quantas ações do universo o Yahoo retornou com dado utilizável. */
  scanned: number;
  /** Quantas passaram nos filtros antes do corte top-N. */
  matched: number;
}

const MAX_PER_CALL = 25; // `/api/brapi` aceita até 30; folga pra evitar 400.
const TOP_N = 10;

/**
 * Yahoo (via proxy) devolve ROE/DY/margem em percentual (×100) enquanto o
 * resto do app usa fração. Normaliza pra fração de forma tolerante: valores
 * acima de 1,5 são tratados como percentual. Cobre ambas as origens sem
 * depender de corrigir a inconsistência pré-existente no proxy.
 */
function toFraction(v: number | undefined): number {
  if (!v || !Number.isFinite(v)) return 0;
  return v > 1.5 ? v / 100 : v;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function passesFilter(stock: Stock, f: ScreenerFilter): boolean {
  const roePct = toFraction(stock.roe) * 100;
  const dyPct = toFraction(stock.dividendYield) * 100;
  const mos = stock.marginOfSafety ?? 0;

  if (f.minScore != null && stock.score < f.minScore) return false;
  if (f.minRoePct != null && roePct < f.minRoePct) return false;
  if (f.minDyPct != null && dyPct < f.minDyPct) return false;
  // P/L e P/VP só fazem sentido quando > 0; ativo sem o dado não passa no teto.
  if (f.maxPl != null && !(stock.pl > 0 && stock.pl <= f.maxPl)) return false;
  if (f.maxPvp != null && !(stock.pvp > 0 && stock.pvp <= f.maxPvp)) return false;
  if (f.maxDebtToEbitda != null && stock.debtToEbitda > f.maxDebtToEbitda) return false;
  if (f.minMarginOfSafetyPct != null && mos < f.minMarginOfSafetyPct) return false;
  if (f.sectors && f.sectors.length > 0) {
    if (!stock.sector || !f.sectors.includes(stock.sector)) return false;
  }
  return true;
}

function sortValue(stock: Stock, by: ScreenerSortBy): number {
  switch (by) {
    case "dy":
      return toFraction(stock.dividendYield);
    case "roe":
      return toFraction(stock.roe);
    case "marginOfSafety":
      return stock.marginOfSafety ?? 0;
    case "score":
    default:
      return stock.score;
  }
}

/**
 * Roda o screener: busca o universo (menos tickers já na carteira), aplica os
 * filtros e ranqueia. Retorna top-10 + contadores pra UI ser honesta sobre o
 * tamanho do universo varrido (sem cap silencioso).
 */
export async function runScreener(
  filter: ScreenerFilter,
  ownedTickers: string[] = []
): Promise<ScreenerResult> {
  const owned = new Set(ownedTickers.map((t) => t.toUpperCase()));
  const universe = SCREENER_UNIVERSE.filter((t) => !owned.has(t.toUpperCase()));

  // Busca em lotes paralelos pra respeitar o cap de 30/call do proxy.
  const batches = await Promise.all(
    chunk(universe, MAX_PER_CALL).map((batch) =>
      fetchMultipleQuotes(batch).catch(() => [])
    )
  );
  const quotes = batches.flat();

  const stocks = quotes
    .filter((q) => q.regularMarketPrice > 0)
    .map((q) => mapQuoteToStock(q));

  const matched = stocks.filter((s) => passesFilter(s, filter));
  const sortBy = filter.sortBy ?? "score";
  matched.sort((a, b) => sortValue(b, sortBy) - sortValue(a, sortBy));

  return {
    results: matched.slice(0, TOP_N),
    scanned: stocks.length,
    matched: matched.length,
  };
}

/** Descreve um filtro em rótulos curtos pra UI ("ROE ≥ 15%", "Setor: Bancos"). */
export function describeFilter(f: ScreenerFilter): string[] {
  const parts: string[] = [];
  if (f.minScore != null) parts.push(`Score ≥ ${f.minScore}`);
  if (f.minRoePct != null) parts.push(`ROE ≥ ${f.minRoePct}%`);
  if (f.minDyPct != null) parts.push(`DY ≥ ${f.minDyPct}%`);
  if (f.maxPl != null) parts.push(`P/L ≤ ${f.maxPl}`);
  if (f.maxPvp != null) parts.push(`P/VP ≤ ${f.maxPvp}`);
  if (f.maxDebtToEbitda != null) parts.push(`Dív/EBITDA ≤ ${f.maxDebtToEbitda}x`);
  if (f.minMarginOfSafetyPct != null) parts.push(`Margem Seg. ≥ ${f.minMarginOfSafetyPct}%`);
  if (f.sectors && f.sectors.length > 0) parts.push(`Setor: ${f.sectors.join(", ")}`);
  return parts;
}
