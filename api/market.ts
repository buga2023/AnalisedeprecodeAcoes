import type { VercelRequest, VercelResponse } from '@vercel/node';

// Cache em memória por instância da função
let cachedData: any = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60000;

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Content-Type', 'application/json');

  try {
    if (request.method === 'OPTIONS') {
      return response.status(204).end();
    }

    // 1. Tentar Yahoo Finance (Alta Estabilidade)
    try {
      const symbols = ["USDBRL=X", "EURBRL=X", "BTC-BRL", "ETH-BRL"];
      const results = await Promise.all(symbols.map(s => fetchYahooMarket(s)));
      
      const mappedData: any = {};
      results.forEach(r => {
        if (r) mappedData[r.key] = r.data;
      });

      if (Object.keys(mappedData).length >= 2) {
        // Mock Metais estável
        mappedData['XAUUSD'] = { bid: '2000', pctChange: '0.5' };
        mappedData['XAGUSD'] = { bid: '23', pctChange: '-0.2' };

        response.setHeader('X-Source', 'Yahoo-Market');
        return response.status(200).json(mappedData);
      }
    } catch (e) {
      console.warn("Yahoo Market falhou:", e);
    }

    // 2. Fallback AwesomeAPI com Cache
    const now = Date.now();
    if (cachedData && (now - lastFetchTime < CACHE_DURATION)) {
      response.setHeader('X-Cache', 'HIT');
      return response.status(200).json(cachedData);
    }

    const TICKERS = 'USD-BRL,EUR-BRL,BTC-BRL,ETH-BRL,XAU-USD,XAG-USD,BRL-USD';
    const apiUrl = `https://economia.awesomeapi.com.br/last/${TICKERS}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // Timeout menor para fallback

    try {
      const res = await fetch(apiUrl, { 
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        if (cachedData) return response.status(200).json(cachedData);
        throw new Error(`AwesomeAPI: ${res.status}`);
      }

      const data = await res.json();
      cachedData = data;
      lastFetchTime = Date.now();

      return response.status(200).json(data);
    } catch (err) {
      if (cachedData) return response.status(200).json(cachedData);
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error("Erro fatal no Market Proxy:", error);
    return response.status(200).json(cachedData || {}); // Nunca retornar 500, prefira vazio
  }
}

async function fetchYahooMarket(symbol: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1d`;
    const res = await fetch(url, { 
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' } 
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    
    const data = await res.json();
    const result = data.chart?.result?.[0];
    if (!result || !result.meta) return null;

    const meta = result.meta;
    const key = symbol.replace('=X', '').replace('-', '');
    
    const current = meta.regularMarketPrice || 0;
    const prev = meta.previousClose || current;
    const change = prev !== 0 ? ((current - prev) / prev) * 100 : 0;

    return {
      key,
      data: {
        bid: String(current),
        pctChange: String(change.toFixed(2))
      }
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
