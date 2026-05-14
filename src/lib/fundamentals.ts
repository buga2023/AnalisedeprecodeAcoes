/**
 * Cliente de fallback de fundamentos via IA.
 *
 * Quando o proxy Yahoo retorna 0/null para os fundamentos principais, este
 * módulo pesquisa via `/api/fundamentals` e devolve os valores marcados como
 * "estimados por IA" para a UI poder rotular.
 */

import type { Relatorio, Stock } from "@/types/stock";

interface FundValue {
  value: number | null;
  unit: "ratio" | "pct" | "brl" | "usd" | "shares";
  confianca: "alta" | "media" | "baixa";
  referencia: string;
}

interface QuarterlyEstimate {
  periodo: string;
  receita: number | null;
  lucroLiquido: number | null;
  ebitda: number | null;
  margem: number | null;
  comentario: string;
  tipo: "real" | "projecao";
  referencia: string;
}

export interface FundamentalsResponse {
  ticker: string;
  empresa: string;
  geradoEm: string;
  estimadoPorIA: true;
  fontes: string[];
  aviso: string;
  fundamentais: Partial<Record<
    | "precoAtual"
    | "pl"
    | "pvp"
    | "dividendYield"
    | "roe"
    | "roic"
    | "debtToEbitda"
    | "netMargin"
    | "lpa"
    | "vpa"
    | "precoTetoGraham"
    | "margemSeguranca",
    FundValue
  >>;
  trimestres: QuarterlyEstimate[];
}

const CACHE_KEY_PREFIX = "praxia-fundamentals:";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h — fundamentos não mudam diariamente

interface CacheEntry {
  at: number;
  data: FundamentalsResponse;
}

function readCache(ticker: string): FundamentalsResponse | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + ticker.toUpperCase());
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.at > CACHE_TTL_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache(ticker: string, data: FundamentalsResponse) {
  try {
    const entry: CacheEntry = { at: Date.now(), data };
    localStorage.setItem(CACHE_KEY_PREFIX + ticker.toUpperCase(), JSON.stringify(entry));
  } catch {
    /* swallow quota errors */
  }
}

/**
 * Pesquisa via IA fundamentos atuais + último trimestre + projeção do próximo.
 * Usa cache de 12h por ticker. `currentPrice` ajuda a IA a calcular P/L correto.
 */
export async function fetchFundamentalsFromAI(
  ticker: string,
  currentPrice?: number
): Promise<FundamentalsResponse | null> {
  const cached = readCache(ticker);
  if (cached) return cached;
  try {
    const url = new URL("/api/fundamentals", window.location.origin);
    url.searchParams.set("ticker", ticker.toUpperCase());
    if (currentPrice && currentPrice > 0) {
      url.searchParams.set("price", String(currentPrice));
    }
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = (await res.json()) as FundamentalsResponse;
    if (!data || !data.fundamentais) return null;
    writeCache(ticker, data);
    return data;
  } catch {
    return null;
  }
}

/**
 * Merge não-destrutivo dos fundamentos da IA num Stock. Só preenche o que
 * estiver zerado/ausente. Marca o stock com `aiEstimated` listando os campos
 * substituídos.
 */
export function mergeAIFundamentalsIntoStock(
  stock: Stock,
  ai: FundamentalsResponse
): Stock {
  const f = ai.fundamentais;
  const referencias: Record<string, string> = {};
  const confianca: Record<string, "alta" | "media" | "baixa"> = {};
  const fields: string[] = [];

  function take(
    fieldName: keyof Stock,
    aiValue: FundValue | undefined,
    currentZero: boolean
  ): number | undefined {
    if (!aiValue || aiValue.value == null) return undefined;
    if (!currentZero) return undefined;
    fields.push(fieldName as string);
    referencias[fieldName as string] = aiValue.referencia;
    confianca[fieldName as string] = aiValue.confianca;
    return aiValue.value;
  }

  const next: Stock = { ...stock };
  const pl = take("pl", f.pl, !(stock.pl > 0));
  if (pl !== undefined) next.pl = pl;
  const pvp = take("pvp", f.pvp, !(stock.pvp > 0));
  if (pvp !== undefined) next.pvp = pvp;
  const dy = take("dividendYield", f.dividendYield, !(stock.dividendYield > 0));
  if (dy !== undefined) next.dividendYield = dy;
  const roe = take("roe", f.roe, !(stock.roe > 0));
  if (roe !== undefined) next.roe = roe;
  const roic = take("roic", f.roic, !((stock.roic ?? 0) > 0));
  if (roic !== undefined) next.roic = roic;
  const dte = take("debtToEbitda", f.debtToEbitda, !(stock.debtToEbitda > 0));
  if (dte !== undefined) next.debtToEbitda = dte;
  const nm = take("netMargin", f.netMargin, !(stock.netMargin > 0));
  if (nm !== undefined) next.netMargin = nm;
  const lpa = take("lpa", f.lpa, !(stock.lpa > 0));
  if (lpa !== undefined) next.lpa = lpa;
  const vpa = take("vpa", f.vpa, !(stock.vpa > 0));
  if (vpa !== undefined) next.vpa = vpa;
  const tg = take("grahamValue", f.precoTetoGraham, !((stock.grahamValue ?? 0) > 0));
  if (tg !== undefined) next.grahamValue = tg;
  const ms = take("marginOfSafety", f.margemSeguranca, !((stock.marginOfSafety ?? 0) !== 0));
  if (ms !== undefined) {
    // IA retorna fração; nosso UI espera %
    next.marginOfSafety = ms * 100;
  }

  if (fields.length > 0) {
    next.aiEstimated = {
      fields,
      geradoEm: ai.geradoEm,
      referencias,
      confianca,
      fontes: ai.fontes,
      aviso: ai.aviso,
    };
  }
  return next;
}

/** Converte os trimestres da resposta IA para o formato Relatorio do app. */
export function quartersFromAI(ai: FundamentalsResponse): Relatorio[] {
  return (ai.trimestres ?? []).map((q) => {
    const lucroLiquido = q.lucroLiquido ?? 0;
    return {
      ticker: ai.ticker,
      periodo: q.periodo,
      // Sem data exata — usamos referencia como label de quando.
      dataFim: q.referencia || ai.geradoEm,
      lucroLiquido,
      receita: q.receita ?? 0,
      resultado: lucroLiquido >= 0 ? "positivo" : "negativo",
      aiEstimated: true,
      tipo: q.tipo,
      referencia: q.referencia,
      comentario: q.comentario,
      ebitda: q.ebitda ?? undefined,
      margem: q.margem ?? undefined,
    };
  });
}
