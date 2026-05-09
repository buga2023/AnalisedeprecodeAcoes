import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * PROXY CENTRAL STOCKS-AI
 * Combina Yahoo Finance (para preços/estabilidade) e Brapi (para dados fundamentalistas).
 */

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Content-Type', 'application/json');

  if (request.method === 'OPTIONS') return response.status(200).end();

  const endpoint = String(request.query.endpoint || "");
  const serverToken = process.env.BRAPI_TOKEN || "kZxy4TEZj9r1mDht9dKr86"; // Sua chave atual

  try {
    // 1. LÓGICA DE COTAÇÕES E HISTÓRICO (VIA YAHOO FINANCE)
    if (endpoint.includes('/quote/')) {
      const tickersRaw = endpoint.split('/').pop() || "";
      const tickers = tickersRaw.split(',').filter(t => t.trim() !== "");
      
      const range = String(request.query.range || "1d");
      const interval = String(request.query.interval || "15m");
      const modules = String(request.query.modules || "");

      const results = await Promise.all(tickers.map(async (t) => {
        const yahoo = await fetchYahooData(t, range, interval);
        
        // Se o frontend pediu "modules" (relatórios), tentamos enriquecer com Brapi em background
        if (modules.includes('incomeStatementHistory') && yahoo) {
          const fundamentalData = await fetchBrapiFundamentals(t, serverToken);
          if (fundamentalData) {
            return { ...yahoo, ...fundamentalData };
          }
        }
        return yahoo;
      }));

      return response.status(200).json({
        results: results.filter(r => r !== null),
        requestedAt: new Date().toISOString(),
        source: "Hybrid (Yahoo+Brapi Proxy)"
      });
    }

    // 2. LÓGICA DE LISTAGEM
    if (endpoint.includes('/available')) {
      return response.status(200).json({
        stocks: ["PETR4", "VALE3", "ITUB4", "BBDC4", "BBAS3", "ABEV3", "MGLU3", "WEGE3", "RENT3", "SUZB3"]
      });
    }

    return response.status(404).json({ error: "Endpoint não suportado" });

  } catch (error) {
    return response.status(500).json({ error: "Erro no processamento do servidor" });
  }
}

// BUSCA NO YAHOO FINANCE (Preços e Gráficos)
async function fetchYahooData(ticker: string, range: string, interval: string) {
  try {
    const symbol = ticker.toUpperCase().includes('.') ? ticker : `${ticker.toUpperCase()}.SA`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=${interval}`;
    
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    
    const data = await res.json();
    const result = data.chart.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const timestamps = result.timestamp || [];
    const quotes = result.indicators.quote[0];

    const historicalDataPrice = timestamps.map((ts: number, i: number) => ({
      date: ts,
      open: quotes.open[i],
      high: quotes.high[i],
      low: quotes.low[i],
      close: quotes.close[i],
      volume: quotes.volume[i]
    })).filter((p: any) => p.close !== null);

    return {
      symbol: ticker.toUpperCase(),
      regularMarketPrice: meta.regularMarketPrice,
      regularMarketChangePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
      regularMarketChange: meta.regularMarketPrice - meta.previousClose,
      regularMarketTime: new Date(meta.regularMarketTime * 1000).toISOString(),
      historicalDataPrice: historicalDataPrice.length > 0 ? historicalDataPrice : undefined,
      priceEarnings: 0, 
      earningsPerShare: 0
    };
  } catch { return null; }
}

// BUSCA NA BRAPI (Somente Balanços/Relatórios)
async function fetchBrapiFundamentals(ticker: string, token: string) {
  try {
    const url = `https://brapi.dev/api/quote/${ticker}?token=${token}&modules=incomeStatementHistoryQuarterly,financialData`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.results?.[0] || null;
  } catch { return null; }
}
