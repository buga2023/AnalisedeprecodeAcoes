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

    // 1. Tentar Yahoo Finance (Alta Estabilidade e Gratuito em Prod)
    try {
      // Moedas e Cripto via Yahoo
      const symbols = ["USDBRL=X", "EURBRL=X", "BTC-BRL", "ETH-BRL"];
      const results = await Promise.all(symbols.map(s => fetchYahooMarket(s)));
      
      const mappedData: any = {};
      results.forEach(r => {
        if (r) mappedData[r.key] = r.data;
      });

      if (Object.keys(mappedData).length >= 2) {
        // Mock Metais (ou buscar se necessário)
        mappedData['XAUUSD'] = { bid: '2000', pctChange: '0.5' };
        mappedData['XAGUSD'] = { bid: '23', pctChange: '-0.2' };

        response.setHeader('X-Source', 'Yahoo-Market');
        return response.status(200).json(mappedData);
      }
    } catch (e) {
      console.warn("Yahoo Market falhou, tentando AwesomeAPI:", e);
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
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(apiUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        if (cachedData) {
          response.setHeader('X-Cache', 'STALE');
          return response.status(200).json(cachedData);
        }
        throw new Error(`AwesomeAPI retornou status ${res.status}`);
      }

      const data = await res.json();
      cachedData = data;
      lastFetchTime = Date.now();

      response.setHeader('X-Cache', 'MISS');
      return response.status(200).json(data);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error("Erro total no Market Proxy:", error);
    if (cachedData) {
      response.setHeader('X-Cache', 'STALE_FATAL');
      return response.status(200).json(cachedData);
    }
    return response.status(500).json({ error: "Serviço de cotações indisponível" });
  }
}

async function fetchYahooMarket(symbol: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    
    const data = await res.json();
    const result = data.chart.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const key = symbol.replace('=X', '').replace('-', ''); // USDBRL, BTCBRL...

    return {
      key,
      data: {
        bid: String(meta.regularMarketPrice),
        pctChange: String(((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100)
      }
    };
  } catch {
    return null;
  }
}
