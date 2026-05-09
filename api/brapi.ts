import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * PROXY 100% YAHOO FINANCE
 * Converte dados do Yahoo Finance para formato compatível com Brapi
 * Ideal para produção (sem limites de requisições)
 */

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Content-Type', 'application/json');

  if (request.method === 'OPTIONS') return response.status(204).end();

  const endpoint = String(request.query.endpoint || "");
  
  try {
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
            // 1. Buscar dados básicos (preço, change)
            const chartData = await fetchYahooChart(ticker, range, interval);
            if (!chartData) return null;

            // 2. Se pedir fundamentos, buscar dados adicionais
            if (modules.includes('financialData') || modules.includes('defaultKeyStatistics')) {
              const summaryData = await fetchYahooSummary(ticker);
              return mergeYahooData(chartData, summaryData);
            }

            return chartData;
          } catch (err) {
            console.error(`[brapi] Erro ao processar ${ticker}:`, err);
            return null;
          }
        })
      );

      const validResults = results.filter((r) => r !== null);

      if (validResults.length === 0) {
        return response.status(404).json({
          error: `Nenhum ticker encontrado: ${tickersRaw}`
        });
      }

      return response.status(200).json({
        results: validResults,
        requestedAt: new Date().toISOString(),
        took: "0ms",
        source: "Yahoo Finance"
      });
    }

    // 3. ROTA DE PESQUISA (Autocomplete similar ao dev da Brapi)
    if (endpoint.includes('/search')) {
      const q = String(request.query.q || "");
      if (!q) return response.status(200).json({ stocks: [] });

      const searchUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`;
      const sRes = await fetch(searchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      
      if (!sRes.ok) return response.status(200).json({ stocks: [] });
      
      const sData = await sRes.json();
      const stocks = (sData.quotes || []).map((s: any) => ({
        stock: s.symbol.replace('.SA', ''),
        name: s.shortname || s.longname || s.symbol,
        type: s.quoteType,
        region: s.region
      }));

      return response.status(200).json({ stocks });
    }

    // 4. ROTA DE LISTAGEM (Disponíveis)
    if (endpoint.includes('/available')) {
      // Lista expandida das principais da B3 para o dropdown inicial
      return response.status(200).json({
        stocks: [
          "PETR4", "VALE3", "ITUB4", "BBDC4", "BBAS3", "ABEV3", "MGLU3", "WEGE3", "RENT3", "SUZB3", 
          "GGBR4", "SANB11", "B3SA3", "TAEE11", "CYRE3", "LREN3", "RADL3", "JBSS3", "EMBR3", "RAIL3",
          "ELET3", "EQTL3", "VIVT3", "CPLE6", "CSNA3", "COGN3", "HYPE3", "UGPA3", "PRIO3", "TOTS3"
        ]
      });
    }

    return response.status(404).json({ error: "Endpoint não suportado" });

  } catch (error) {
    console.error("[brapi] Erro:", error);
    return response.status(500).json({
      error: "Erro ao processar requisição",
      details: error instanceof Error ? error.message : "Erro desconhecido"
    });
  }
}

// ============================================================================
// YAHOO FINANCE: PREÇOS E GRÁFICOS
// ============================================================================
async function fetchYahooChart(
  ticker: string,
  range: string,
  interval: string
): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    // Adiciona .SA para ações brasileiras
    const symbol = ticker.includes('.') || ticker.includes('-') ? ticker : `${ticker}.SA`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0' }
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[yahoo-chart] Status ${res.status} para ${symbol}`);
      return null;
    }

    const data = await res.json();
    const result = data.chart?.result?.[0];

    if (!result) {
      console.warn(`[yahoo-chart] Sem dados para ${symbol}`);
      return null;
    }

    const meta = result.meta;
    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0];

    if (!quotes) {
      console.warn(`[yahoo-chart] Sem cotações para ${symbol}`);
      return null;
    }

    // Mapear histórico de preços
    const historicalDataPrice = timestamps
      .map((ts: number, i: number) => ({
        date: ts,
        open: quotes.open?.[i] || 0,
        high: quotes.high?.[i] || 0,
        low: quotes.low?.[i] || 0,
        close: quotes.close?.[i] || 0,
        volume: quotes.volume?.[i] || 0
      }))
      .filter((p: any) => p.close && p.close > 0);

    return {
      symbol: ticker,
      shortName: meta.shortName || ticker,
      longName: meta.longName || ticker,
      currency: meta.currency || "BRL",
      regularMarketPrice: meta.regularMarketPrice || 0,
      regularMarketChange: (meta.regularMarketPrice || 0) - (meta.previousClose || 0),
      regularMarketChangePercent:
        meta.previousClose && meta.previousClose > 0
          ? (((meta.regularMarketPrice || 0) - meta.previousClose) / meta.previousClose) * 100
          : 0,
      regularMarketTime: meta.regularMarketTime
        ? new Date(meta.regularMarketTime * 1000).toISOString()
        : new Date().toISOString(),
      historicalDataPrice: historicalDataPrice
    };
  } catch (err) {
    clearTimeout(timeoutId);
    console.error(`[yahoo-chart] Erro ao buscar ${ticker}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// YAHOO: INDICADORES FUNDAMENTALISTAS (ROE, DÍVIDA, LUCRO, BALANÇO, FLUXO)
async function fetchYahooSummary(ticker: string): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const symbol = ticker.includes('.') || ticker.includes('-') ? ticker : `${ticker}.SA`;
    // Adicionamos módulos de Balanço (Balance Sheet) e Fluxo de Caixa (Cash Flow)
    const modules = "defaultKeyStatistics,financialData,incomeStatementHistoryQuarterly,balanceSheetHistoryQuarterly,cashflowStatementHistoryQuarterly";
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`;

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    clearTimeout(timeoutId);

    if (!res.ok) return {};

    const data = await res.json();
    const result = data.quoteSummary?.result?.[0];

    if (!result) return {};

    const stats = result.defaultKeyStatistics || {};
    const fin = result.financialData || {};
    
    // Pegamos os dados mais recentes do Balanço e Fluxo de Caixa
    const balanceSheet = result.balanceSheetHistoryQuarterly?.balanceSheetStatements?.[0] || {};
    const cashFlow = result.cashflowStatementHistoryQuarterly?.cashflowStatements?.[0] || {};

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
        // Novos dados extraídos do Balanço e Fluxo de Caixa
        currentRatio: fin.currentRatio?.raw || (balanceSheet.totalCurrentAssets?.raw / balanceSheet.totalCurrentLiabilities?.raw) || 0,
        debtToEquity: fin.debtToEquity?.raw || (fin.totalDebt?.raw / stats.bookValue?.raw) || 0,
        freeCashflow: fin.freeCashflow?.raw || cashFlow.totalCashFromOperatingActivities?.raw + cashFlow.capitalExpenditures?.raw || 0
      }
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return {};
  }
}

// ============================================================================
// MESCLAR DADOS DO YAHOO COM FORMATO BRAPI
// ============================================================================
function mergeYahooData(chartData: any, summaryData: any): any {
  return {
    ...chartData,
    earningsPerShare: summaryData.earningsPerShare ?? 0,
    bookValue: summaryData.bookValue ?? 0,
    priceEarnings: summaryData.priceEarnings ?? 0,
    dividendYield: summaryData.dividendYield ?? 0,
    enterpriseValue: summaryData.enterpriseValue ?? 0,
    financialData: {
      returnOnEquity: summaryData.financialData?.returnOnEquity ?? 0,
      totalDebt: summaryData.financialData?.totalDebt ?? 0,
      ebitda: summaryData.financialData?.ebitda ?? 0,
      profitMargins: summaryData.financialData?.profitMargins ?? 0,
      totalRevenue: summaryData.financialData?.totalRevenue ?? 0,
      debtToEquity: summaryData.financialData?.debtToEquity ?? 0,
      currentRatio: summaryData.financialData?.currentRatio ?? 0
    }
  };
}
