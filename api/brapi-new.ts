import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * PROXY YAHOO FINANCE V8/V10 API
 * 
 * Endpoints utilizados:
 * - v8: /finance/chart (preços, histórico)
 * - v10: /finance/quoteSummary (dados fundamentalistas)
 * 
 * Conversão para formato Brapi para compatibilidade com frontend
 * Sem limites de requisição (ao contrário da Brapi)
 */

// Cache para evitar requisições duplicadas dentro de 1 minuto
const chartCache = new Map<string, { data: any; time: number }>();
const summaryCache = new Map<string, { data: any; time: number }>();
const CACHE_TTL = 60 * 1000; // 1 minuto

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Cache-Control', 'public, max-age=60'); // Cache no browser 1 min

  if (request.method === 'OPTIONS') return response.status(204).end();

  const endpoint = String(request.query.endpoint || "");
  
  try {
    if (endpoint.includes('/quote/')) {
      const tickersRaw = endpoint.split('/').pop() || "";
      const tickers = tickersRaw
        .split(',')
        .map(t => t.trim())
        .filter(t => t !== "" && t.length > 0);
      
      if (tickers.length === 0) {
        return response.status(400).json({ error: "Nenhum ticker fornecido" });
      }

      if (tickers.length > 50) {
        return response.status(400).json({ error: "Máximo 50 tickers por requisição" });
      }

      const modules = String(request.query.modules || "");
      const range = String(request.query.range || "1d");
      const interval = String(request.query.interval || "15m");

      // Validar parâmetros
      if (!['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max'].includes(range)) {
        return response.status(400).json({ error: "Range inválido" });
      }

      if (!['1m', '5m', '15m', '30m', '1h', '1d', '1wk', '1mo'].includes(interval)) {
        return response.status(400).json({ error: "Interval inválido" });
      }

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

    if (endpoint.includes('/available')) {
      return response.status(200).json({
        stocks: [
          // Blue Chips
          "PETR4", "VALE3", "ITUB4", "BBDC4", "BBAS3", "ABEV3",
          // Tech/Varejo
          "MGLU3", "WEGE3", "RENT3",
          // Industriais
          "SUZB3", "GGBR4", "CSNA3", "USIM5",
          // Bancos
          "SANB11", "CXSE3", "BPAC11", "PAGR3",
          // Outros
          "B3SA3", "LREN3", "TAEE11", "CYRE3", "RADL3", "JBSS3", "EMBR3", "RAIL3"
        ],
        indexes: ["^BVSP", "^RV99", "^IXIC"]
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
// YAHOO FINANCE V8: PREÇOS E GRÁFICOS
// https://query1.finance.yahoo.com/v8/finance/chart/{symbol}
// ============================================================================
async function fetchYahooChart(
  ticker: string,
  range: string,
  interval: string
): Promise<any> {
  const cacheKey = `${ticker}-${range}-${interval}`;
  const cached = chartCache.get(cacheKey);
  
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    console.log(`[yahoo-chart] Cache HIT for ${ticker}`);
    return cached.data;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const symbol = normalizeSymbol(ticker);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&events=history`;

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[yahoo-chart] Status ${res.status} para ${symbol}`);
      return null;
    }

    const data = await res.json();
    const result = data.chart?.result?.[0];

    if (!result || data.chart?.error) {
      console.warn(`[yahoo-chart] Erro na resposta para ${symbol}:`, data.chart?.error);
      return null;
    }

    const meta = result.meta;
    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0];

    if (!quotes) {
      console.warn(`[yahoo-chart] Sem cotações para ${symbol}`);
      return null;
    }

    // Validar dados essenciais
    if (!meta.regularMarketPrice || meta.regularMarketPrice <= 0) {
      console.warn(`[yahoo-chart] Preço inválido para ${symbol}: ${meta.regularMarketPrice}`);
      return null;
    }

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

    const chartData = {
      symbol: ticker,
      shortName: meta.shortName || ticker,
      longName: meta.longName || ticker,
      currency: meta.currency || "BRL",
      regularMarketPrice: Math.max(0, meta.regularMarketPrice),
      regularMarketChange: (meta.regularMarketPrice || 0) - (meta.previousClose || 0),
      regularMarketChangePercent:
        meta.previousClose && meta.previousClose > 0
          ? (((meta.regularMarketPrice || 0) - meta.previousClose) / meta.previousClose) * 100
          : 0,
      regularMarketTime: meta.regularMarketTime
        ? new Date(meta.regularMarketTime * 1000).toISOString()
        : new Date().toISOString(),
      historicalDataPrice: historicalDataPrice.slice(-250) // Últimas 250 observações
    };

    // Cachear resultado
    chartCache.set(cacheKey, { data: chartData, time: Date.now() });
    console.log(`[yahoo-chart] Success for ${ticker}, cache SET`);

    return chartData;
  } catch (err) {
    clearTimeout(timeoutId);
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[yahoo-chart] Erro ao buscar ${ticker}: ${msg}`);
    return null;
  }
}

// ============================================================================
// YAHOO FINANCE V10: DADOS FUNDAMENTALISTAS
// https://query1.finance.yahoo.com/v10/finance/quoteSummary/{symbol}
// ============================================================================
async function fetchYahooSummary(ticker: string): Promise<any> {
  const cached = summaryCache.get(ticker);
  
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    console.log(`[yahoo-summary] Cache HIT for ${ticker}`);
    return cached.data;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const symbol = normalizeSymbol(ticker);
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=defaultKeyStatistics,financialData,quoteType`;

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[yahoo-summary] Status ${res.status} para ${symbol}`);
      return {};
    }

    const data = await res.json();
    const result = data.quoteSummary?.result?.[0];

    if (!result || data.quoteSummary?.error) {
      console.warn(`[yahoo-summary] Erro na resposta para ${symbol}:`, data.quoteSummary?.error);
      return {};
    }

    const stats = result.defaultKeyStatistics || {};
    const fin = result.financialData || {};

    const summaryData = {
      earningsPerShare: Math.max(0, stats.trailingEps?.raw || 0),
      bookValue: Math.max(0, stats.bookValue?.raw || 0),
      priceEarnings: Math.max(0, stats.trailingPE?.raw || 0),
      dividendYield: Math.max(0, (stats.dividendYield?.raw || 0) * 100),
      enterpriseValue: Math.max(0, stats.enterpriseValue?.raw || 0),
      financialData: {
        returnOnEquity: Math.max(0, (fin.returnOnEquity?.raw || 0) * 100),
        totalDebt: Math.max(0, fin.totalDebt?.raw || 0),
        ebitda: Math.max(0, fin.ebitda?.raw || 0),
        profitMargins: Math.max(0, (fin.profitMargins?.raw || 0) * 100),
        totalRevenue: Math.max(0, fin.totalRevenue?.raw || 0),
        debtToEquity: Math.max(0, fin.debtToEquity?.raw || 0),
        currentRatio: Math.max(0, fin.currentRatio?.raw || 0),
        freeCashflow: Math.max(0, fin.freeCashflow?.raw || 0)
      }
    };

    // Cachear resultado
    summaryCache.set(ticker, { data: summaryData, time: Date.now() });
    console.log(`[yahoo-summary] Success for ${ticker}, cache SET`);

    return summaryData;
  } catch (err) {
    clearTimeout(timeoutId);
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[yahoo-summary] Erro ao buscar ${ticker}: ${msg}`);
    return {};
  }
}

// ============================================================================
// UTILITÁRIOS
// ============================================================================

/**
 * Normaliza símbolo: adiciona .SA para ações brasileiras
 */
function normalizeSymbol(ticker: string): string {
  if (ticker.includes('.') || ticker.includes('-') || ticker.length > 5) {
    return ticker; // Já está formatado (ex: PETR4.SA, ^BVSP)
  }
  return `${ticker}.SA`; // Adiciona .SA para ações BR
}

/**
 * Mescla dados do Yahoo com formato Brapi
 */
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
      currentRatio: summaryData.financialData?.currentRatio ?? 0,
      freeCashflow: summaryData.financialData?.freeCashflow ?? 0
    }
  };
}
