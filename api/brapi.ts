import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * PROXY 100% YAHOO FINANCE
 * Substituto robusto para o sistema de cotações e fundamentos.
 * Focado em estabilidade absoluta para produção.
 */

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

      if (validResults.length === 0) {
        return response.status(404).json({ error: "Ativos não encontrados" });
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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);

  try {
    const symbol = ticker.includes('.') || ticker.includes('-') ? ticker : `${ticker}.SA`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!res.ok) return null;
    const data = await res.json();
    const result = data.chart?.result?.[0];
    if (!result || !result.meta) return null;

    const meta = result.meta;
    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};

    const historicalDataPrice = timestamps
      .map((ts: number, i: number) => ({
        date: ts,
        open: quotes.open?.[i] || 0,
        high: quotes.high?.[i] || 0,
        low: quotes.low?.[i] || 0,
        close: quotes.close?.[i] || 0,
        volume: quotes.volume?.[i] || 0
      }))
      .filter((p: any) => p.close > 0);

    return {
      symbol: ticker,
      shortName: meta.shortName || ticker,
      longName: meta.longName || ticker,
      currency: meta.currency || "BRL",
      regularMarketPrice: meta.regularMarketPrice || 0,
      regularMarketChange: (meta.regularMarketPrice || 0) - (meta.previousClose || 0),
      regularMarketChangePercent: meta.previousClose ? (((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100) : 0,
      regularMarketTime: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString(),
      historicalDataPrice: historicalDataPrice
    };
  } catch { return null; }
  finally { clearTimeout(timeoutId); }
}

async function fetchYahooSummary(ticker: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);

  try {
    const symbol = ticker.includes('.') || ticker.includes('-') ? ticker : `${ticker}.SA`;
    const modules = "defaultKeyStatistics,financialData,incomeStatementHistoryQuarterly,balanceSheetHistoryQuarterly,cashflowStatementHistoryQuarterly";
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`;

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!res.ok) return {};
    const data = await res.json();
    const result = data.quoteSummary?.result?.[0];
    if (!result) return {};

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
  } catch { return {}; }
  finally { clearTimeout(timeoutId); }
}

async function fetchYahooSearch(q: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!res.ok) return [];
    const data = await res.json();
    return (data.quotes || []).map((s: any) => ({
      stock: s.symbol.replace('.SA', ''),
      name: s.shortname || s.longname || s.symbol,
      type: s.quoteType,
      region: s.region
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
