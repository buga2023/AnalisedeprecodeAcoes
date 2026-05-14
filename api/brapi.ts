import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * PROXY 100% YAHOO FINANCE
 * Substituto robusto para o sistema de cotações e fundamentos.
 * Focado em estabilidade absoluta para produção.
 *
 * Headers e fallbacks endurecidos para reduzir falsos 404 quando o Yahoo
 * bloqueia a requisição (UA básica é frequentemente filtrada).
 */

const YAHOO_HEADERS: Record<string, string> = {
  // UA realista — alguns ambientes filtram "Mozilla/5.0" puro.
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8",
  "Cache-Control": "no-cache",
  Referer: "https://finance.yahoo.com/",
  Origin: "https://finance.yahoo.com",
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Content-Type', 'application/json');

  if (request.method === 'OPTIONS') return response.status(204).end();

  const endpoint = String(request.query.endpoint || "");

  try {
    // 1. COTAÇÕES E FUNDAMENTOS
    if (endpoint.includes('/quote/')) {
      const tickersRaw = endpoint.split('/').pop() || "";
      const tickers = tickersRaw.split(',').map(t => t.trim()).filter(t => t !== "");

      if (tickers.length === 0) {
        return response.status(400).json({ error: "Nenhum ticker fornecido" });
      }

      const modules = String(request.query.modules || "");
      const range = String(request.query.range || "1d");
      const interval = String(request.query.interval || "15m");

      const results = await Promise.all(
        tickers.map(async (t) => {
          const ticker = t.toUpperCase();
          try {
            const chartData = await fetchYahooChart(ticker, range, interval);
            if (!chartData) return null;

            if (modules.includes('financialData') || modules.includes('defaultKeyStatistics')) {
              const summaryData = await fetchYahooSummary(ticker);
              return mergeYahooData(chartData, summaryData);
            }

            return chartData;
          } catch (err) {
            console.error(`[api] Falha silenciosa para ${ticker}:`, err);
            return null;
          }
        })
      );

      const validResults = results.filter((r) => r !== null);

      // Quando todos os tickers falharam: tenta sugerir pela busca do Yahoo
      // antes de devolver 404, pra dar feedback acionável ao usuário. Se a
      // busca literal nao trouxer nada de util (ex.: Yahoo so retorna opcoes
      // de ITUB2), faz uma segunda busca relaxada pelo "stem" do ticker
      // (removendo digitos finais) para pescar ITUB3/ITUB4.
      if (validResults.length === 0) {
        const firstTicker = tickers[0];
        let suggestions = await fetchYahooSearch(firstTicker).catch(() => []);
        if (suggestions.length === 0) {
          const stem = firstTicker.replace(/\d+$/, "");
          if (stem && stem !== firstTicker) {
            suggestions = await fetchYahooSearch(stem).catch(() => []);
          }
        }
        return response.status(404).json({
          error: `Ativo "${firstTicker}" não encontrado no Yahoo Finance. Verifique o código (B3 termina em dígito: PETR4, ITUB4, VALE3; EUA é só letras: AAPL, MSFT).`,
          suggestions: suggestions.slice(0, 6),
          source: "Yahoo Finance",
        });
      }

      return response.status(200).json({
        results: validResults,
        requestedAt: new Date().toISOString(),
        source: "Yahoo Finance Engine"
      });
    }

    // 2. BUSCA / AUTOCOMPLETE
    if (endpoint.includes('/search')) {
      const q = String(request.query.q || "");
      if (!q) return response.status(200).json({ stocks: [] });

      const stocks = await fetchYahooSearch(q);
      return response.status(200).json({ stocks });
    }

    // 3. ATIVOS DISPONÍVEIS (LISTA INICIAL)
    if (endpoint.includes('/available')) {
      return response.status(200).json({
        stocks: [
          "PETR4", "VALE3", "ITUB4", "BBDC4", "BBAS3", "ABEV3", "MGLU3", "WEGE3", "RENT3", "SUZB3", 
          "GGBR4", "SANB11", "B3SA3", "TAEE11", "CYRE3", "LREN3", "RADL3", "JBSS3", "EMBR3", "RAIL3",
          "ELET3", "EQTL3", "VIVT3", "CPLE6", "CSNA3", "COGN3", "HYPE3", "UGPA3", "PRIO3", "TOTS3"
        ]
      });
    }

    return response.status(404).json({ error: "Rota não mapeada" });

  } catch (error) {
    console.error("[api] Erro fatal:", error);
    return response.status(500).json({ error: "Erro interno no servidor" });
  }
}

async function fetchYahooChart(ticker: string, range: string, interval: string) {
  // Tenta primeiro com sufixo .SA (B3), depois sem sufixo (EUA). Permite que
  // entradas como "ITUB4" e "AAPL" funcionem sem o usuário pensar no sufixo.
  const candidates = ticker.includes(".") || ticker.includes("-")
    ? [ticker]
    : [`${ticker}.SA`, ticker];

  let lastStatus = 0;
  for (const symbol of candidates) {
    const data = await fetchYahooChartOnce(symbol, range, interval);
    if (data === "blocked") {
      lastStatus = 429;
      continue;
    }
    if (!data) continue;
    const result = data.chart?.result?.[0];
    if (!result || !result.meta) continue;
    return processYahooResult(ticker, result);
  }
  if (lastStatus === 429) {
    console.warn(`[api] Yahoo bloqueou ${ticker} — possível rate limit`);
  }
  return null;
}

type YahooChartResultMeta = {
  meta?: Record<string, unknown>;
  timestamp?: number[];
  indicators?: { quote?: Array<Record<string, number[]>> };
};
type YahooChartResponse = { chart?: { result?: YahooChartResultMeta[] } };

async function fetchYahooChartOnce(
  symbol: string,
  range: string,
  interval: string
): Promise<YahooChartResponse | "blocked" | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
    const res = await fetch(url, { signal: controller.signal, headers: YAHOO_HEADERS });
    if (res.status === 429 || res.status === 401 || res.status === 403) return "blocked";
    if (!res.ok) return null;
    return (await res.json()) as YahooChartResponse;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function processYahooResult(
  ticker: string,
  result: { meta?: Record<string, unknown>; timestamp?: number[]; indicators?: { quote?: Array<Record<string, number[]>> } }
) {
  if (!result.meta) return null;
  const tryRun = () => {
    const meta = result.meta as Record<string, unknown>;
    const timestamps = result.timestamp ?? [];
    const quotes = result.indicators?.quote?.[0] ?? ({} as Record<string, number[]>);

    const historicalDataPrice = timestamps
      .map((ts, i) => ({
        date: ts,
        open: quotes.open?.[i] || 0,
        high: quotes.high?.[i] || 0,
        low: quotes.low?.[i] || 0,
        close: quotes.close?.[i] || 0,
        volume: quotes.volume?.[i] || 0,
      }))
      .filter((p) => p.close > 0);

    const regularMarketPrice = (meta.regularMarketPrice as number) || 0;
    const previousClose = (meta.previousClose as number) || regularMarketPrice;

    return {
      symbol: ticker,
      shortName: (meta.shortName as string) || ticker,
      longName: (meta.longName as string) || ticker,
      currency: (meta.currency as string) || "BRL",
      regularMarketPrice,
      regularMarketChange: regularMarketPrice - previousClose,
      regularMarketChangePercent:
        previousClose ? ((regularMarketPrice - previousClose) / previousClose) * 100 : 0,
      regularMarketTime: meta.regularMarketTime
        ? new Date((meta.regularMarketTime as number) * 1000).toISOString()
        : new Date().toISOString(),
      historicalDataPrice,
    };
  };
  return tryRun();
}

async function fetchYahooSummary(ticker: string) {
  const candidates = ticker.includes(".") || ticker.includes("-")
    ? [ticker]
    : [`${ticker}.SA`, ticker];

  for (const symbol of candidates) {
    const out = await fetchYahooSummaryOnce(symbol);
    if (out && Object.keys(out).length > 0) return out;
  }
  return {};
}

async function fetchYahooSummaryOnce(symbol: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);

  try {
    const modules = "defaultKeyStatistics,financialData,incomeStatementHistoryQuarterly,balanceSheetHistoryQuarterly,cashflowStatementHistoryQuarterly";
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`;

    const res = await fetch(url, {
      signal: controller.signal,
      headers: YAHOO_HEADERS,
    });

    if (!res.ok) return null;
    const data = await res.json();
    const result = data.quoteSummary?.result?.[0];
    if (!result) return null;

    const stats = result.defaultKeyStatistics || {};
    const fin = result.financialData || {};
    const balance = result.balanceSheetHistoryQuarterly?.balanceSheetStatements?.[0] || {};
    const cash = result.cashflowStatementHistoryQuarterly?.cashflowStatements?.[0] || {};

    return {
      earningsPerShare: stats.trailingEps?.raw || 0,
      bookValue: stats.bookValue?.raw || 0,
      priceEarnings: stats.trailingPE?.raw || 0,
      dividendYield: (stats.dividendYield?.raw || 0) * 100,
      enterpriseValue: stats.enterpriseValue?.raw || 0,
      financialData: {
        returnOnEquity: (fin.returnOnEquity?.raw || 0) * 100,
        totalDebt: fin.totalDebt?.raw || 0,
        ebitda: fin.ebitda?.raw || 0,
        profitMargins: (fin.profitMargins?.raw || 0) * 100,
        totalRevenue: fin.totalRevenue?.raw || 0,
        currentRatio: fin.currentRatio?.raw || (balance.totalCurrentAssets?.raw / balance.totalCurrentLiabilities?.raw) || 0,
        debtToEquity: fin.debtToEquity?.raw || (fin.totalDebt?.raw / stats.bookValue?.raw) || 0,
        freeCashflow: fin.freeCashflow?.raw || (cash.totalCashFromOperatingActivities?.raw + cash.capitalExpenditures?.raw) || 0
      }
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchYahooSearch(q: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: YAHOO_HEADERS,
    });

    if (!res.ok) return [];
    const data = await res.json();
    type SearchQuote = { symbol: string; shortname?: string; longname?: string; quoteType?: string; region?: string };
    return (data.quotes || [])
      // Apenas ações/ETFs/índices/cripto — descarta opções, futuros e ruido.
      .filter((s: SearchQuote) => {
        const t = s.quoteType;
        return t === "EQUITY" || t === "ETF" || t === "MUTUALFUND" || t === "INDEX" || t === "CRYPTOCURRENCY";
      })
      .map((s: SearchQuote) => ({
        stock: (s.symbol || "").replace(".SA", ""),
        name: s.shortname || s.longname || s.symbol,
        type: s.quoteType,
        region: s.region,
      }));
  } catch { return []; }
  finally { clearTimeout(timeoutId); }
}

function mergeYahooData(chartData: any, summaryData: any) {
  return {
    ...chartData,
    ...summaryData,
    financialData: {
      ...chartData.financialData,
      ...summaryData.financialData
    }
  };
}
