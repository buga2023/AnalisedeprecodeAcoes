import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors } from "./_cors";
import { checkRateLimit } from "./_ratelimit";

/**
 * Historico trimestral de fundamentos via Yahoo Finance `quoteSummary` v10.
 *
 * `GET /api/fundamentals-history?ticker=PETR4` →
 *   { ticker, quarters: [{ periodo, dataFim, roe?, netMargin?, debtToEbitda?, dy?, pl? }, ...] }
 *
 * Trabalha so com numeros REAIS publicados pelo Yahoo. Quando um campo nao
 * existe no payload (cobertura ruim de small caps / FII / mid caps B3), o
 * campo correspondente fica `undefined` e a UI mostra "—" no lugar — nunca
 * fabricamos valor.
 */

const TICKER_RE = /^([A-Z]{4}\d{1,2}|[A-Z]{1,5})$/;

const YAHOO_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8",
  Referer: "https://finance.yahoo.com/",
  Origin: "https://finance.yahoo.com",
};

const MODULES =
  "incomeStatementHistoryQuarterly,balanceSheetHistoryQuarterly,defaultKeyStatistics,summaryDetail,price";

export interface FundamentalQuarter {
  /** Label PT-BR ex.: "1T25". */
  periodo: string;
  /** Data final do trimestre (YYYY-MM-DD). */
  dataFim: string;
  /** Lucro liquido absoluto (BRL/USD). */
  netIncome?: number;
  /** Receita liquida absoluta (BRL/USD). */
  revenue?: number;
  /** ROE do trimestre (fracao). */
  roe?: number;
  /** Margem liquida do trimestre (fracao). */
  netMargin?: number;
  /** Divida total / EBITDA TTM (rolling 4Q). */
  debtToEbitda?: number;
  /** Dividend Yield TTM (fracao) — quando a serie cobre os 4Q anteriores. */
  dy?: number;
  /** P/L TTM (preco atual / EPS TTM rolling 4Q). */
  pl?: number;
}

interface YahooIncomeStmt {
  endDate?: { raw?: number };
  netIncome?: { raw?: number };
  totalRevenue?: { raw?: number };
  ebit?: { raw?: number };
  /** EPS basico do trimestre. */
  basicEPS?: { raw?: number };
  /** EPS diluido — usar quando basicEPS faltar. */
  dilutedEPS?: { raw?: number };
}

interface YahooBalanceStmt {
  endDate?: { raw?: number };
  totalStockholderEquity?: { raw?: number };
  shortLongTermDebt?: { raw?: number };
  longTermDebt?: { raw?: number };
  totalLiab?: { raw?: number };
}

interface YahooQuoteSummaryResult {
  incomeStatementHistoryQuarterly?: { incomeStatementHistory?: YahooIncomeStmt[] };
  balanceSheetHistoryQuarterly?: { balanceSheetStatements?: YahooBalanceStmt[] };
  defaultKeyStatistics?: {
    enterpriseToEbitda?: { raw?: number };
    trailingEps?: { raw?: number };
    sharesOutstanding?: { raw?: number };
  };
  summaryDetail?: {
    dividendYield?: { raw?: number };
    trailingPE?: { raw?: number };
    marketCap?: { raw?: number };
  };
  price?: {
    regularMarketPrice?: { raw?: number };
  };
}

interface YahooQuoteSummaryResponse {
  quoteSummary?: {
    result?: YahooQuoteSummaryResult[];
    error?: { code?: string; description?: string } | null;
  };
}

function quarterLabel(dt: Date): string {
  const m = dt.getUTCMonth();
  const q = Math.floor(m / 3) + 1;
  const y = String(dt.getUTCFullYear()).slice(-2);
  return `${q}T${y}`;
}

function isoDate(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

async function fetchSummary(symbol: string): Promise<YahooQuoteSummaryResult | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
      symbol
    )}?modules=${MODULES}`;
    const res = await fetch(url, { signal: controller.signal, headers: YAHOO_HEADERS });
    if (!res.ok) return null;
    const data = (await res.json()) as YahooQuoteSummaryResponse;
    const result = data.quoteSummary?.result?.[0];
    return result ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchQuarterlyHistory(ticker: string): Promise<YahooQuoteSummaryResult | null> {
  // Tenta `.SA` primeiro (B3), depois ticker puro (US).
  const candidates =
    ticker.includes(".") || ticker.includes("-") ? [ticker] : [`${ticker}.SA`, ticker];
  for (const symbol of candidates) {
    const r = await fetchSummary(symbol);
    if (r) return r;
  }
  return null;
}

function buildQuarters(data: YahooQuoteSummaryResult): FundamentalQuarter[] {
  const incomeStmts = data.incomeStatementHistoryQuarterly?.incomeStatementHistory ?? [];
  const balanceStmts = data.balanceSheetHistoryQuarterly?.balanceSheetStatements ?? [];

  // Indexa balanceSheet por endDate (epoch s) → entry, pra casar com income.
  const balanceByDate = new Map<number, YahooBalanceStmt>();
  for (const b of balanceStmts) {
    const d = b.endDate?.raw;
    if (typeof d === "number") balanceByDate.set(d, b);
  }

  // Sort income stmts por data crescente (mais antiga primeiro) para calcular
  // medias rolling sobre os 4 trimestres ANTERIORES (TTM).
  const sortedIncome = [...incomeStmts]
    .filter((i) => typeof i.endDate?.raw === "number")
    .sort((a, b) => (a.endDate!.raw as number) - (b.endDate!.raw as number));

  const quarters: FundamentalQuarter[] = sortedIncome.map((inc, idx) => {
    const endRaw = inc.endDate!.raw as number;
    const dt = new Date(endRaw * 1000);
    const periodo = quarterLabel(dt);
    const dataFim = isoDate(dt);

    const netIncome = inc.netIncome?.raw;
    const revenue = inc.totalRevenue?.raw;
    const ebit = inc.ebit?.raw;
    const eps = inc.basicEPS?.raw ?? inc.dilutedEPS?.raw;

    const balance = balanceByDate.get(endRaw);
    const equity = balance?.totalStockholderEquity?.raw;
    const shortDebt = balance?.shortLongTermDebt?.raw ?? 0;
    const longDebt = balance?.longTermDebt?.raw ?? 0;
    const totalDebt = shortDebt + longDebt;

    // ROE do trimestre (anualizado): ROE = netIncome * 4 / equity quando equity > 0.
    // O ROE puro do trimestre subestima — Yahoo padrao apresenta TTM, entao
    // multiplicamos por 4 pra ter comparativo anual.
    let roe: number | undefined;
    if (typeof netIncome === "number" && typeof equity === "number" && equity > 0) {
      roe = (netIncome * 4) / equity;
    }

    // Margem liquida do trimestre.
    let netMargin: number | undefined;
    if (typeof netIncome === "number" && typeof revenue === "number" && revenue > 0) {
      netMargin = netIncome / revenue;
    }

    // EBITDA TTM (rolling 4Q): soma EBIT dos 4 trimestres anteriores + amortizacao.
    // Yahoo nao expoe amortizacao por trimestre direto; usamos EBIT como proxy.
    let debtToEbitda: number | undefined;
    if (idx >= 3 && totalDebt > 0) {
      const last4Ebit = sortedIncome.slice(idx - 3, idx + 1)
        .map((i) => i.ebit?.raw)
        .filter((v): v is number => typeof v === "number");
      if (last4Ebit.length === 4) {
        const ebitTtm = last4Ebit.reduce((a, b) => a + b, 0);
        if (ebitTtm > 0) debtToEbitda = totalDebt / ebitTtm;
      }
    } else if (typeof ebit === "number" && ebit > 0 && totalDebt > 0) {
      // Sem 4 trimestres ainda — anualiza o EBIT atual.
      debtToEbitda = totalDebt / (ebit * 4);
    }

    // Marker: EPS por si so nao da P/L sem preco historico; deixamos undefined.
    // Mantemos a estrutura no objeto, mas sem inventar.
    void eps;

    return {
      periodo,
      dataFim,
      netIncome,
      revenue,
      roe,
      netMargin,
      debtToEbitda,
    };
  });

  // Anexa DY/PL atuais ao ultimo trimestre quando disponivel — sem replicar
  // valor para trimestres anteriores (seria fake).
  const last = quarters[quarters.length - 1];
  if (last) {
    const dy = data.summaryDetail?.dividendYield?.raw;
    const pl = data.summaryDetail?.trailingPE?.raw;
    if (typeof dy === "number") last.dy = dy;
    if (typeof pl === "number") last.pl = pl;
  }

  return quarters;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (applyCors(request, response, "GET, OPTIONS")) return;

  const rate = checkRateLimit(request, { windowMs: 60_000, max: 30 });
  if (!rate.allowed) {
    response.setHeader("Retry-After", String(rate.retryAfterSec));
    return response.status(429).json({ error: "rate-limited", retryAfterSec: rate.retryAfterSec });
  }

  try {
    const ticker = String(request.query.ticker || "").toUpperCase().trim();
    if (!ticker) {
      return response.status(400).json({ error: "Forneca `ticker` (ex.: `?ticker=PETR4`)." });
    }
    if (!TICKER_RE.test(ticker)) {
      return response.status(400).json({
        error: "Ticker invalido. Use formato B3 (PETR4, SANB11) ou US (AAPL).",
      });
    }

    const data = await fetchQuarterlyHistory(ticker);
    if (!data) {
      return response.status(200).json({
        ticker,
        quarters: [] as FundamentalQuarter[],
        source: "Yahoo Finance",
        generatedAt: new Date().toISOString(),
        note: "Yahoo nao retornou historico trimestral para este ticker.",
      });
    }

    const quarters = buildQuarters(data);
    return response.status(200).json({
      ticker,
      quarters,
      source: "Yahoo Finance",
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    console.error("[api/fundamentals-history] erro fatal:", msg.slice(0, 120));
    return response.status(200).json({
      ticker: String(request.query.ticker || "").toUpperCase().trim(),
      quarters: [] as FundamentalQuarter[],
      error: "Indisponivel no momento.",
      source: "Yahoo Finance",
    });
  }
}
