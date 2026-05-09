import type { VercelRequest, VercelResponse } from '@vercel/node';

// Cache em memória por instância da função
let cachedData: any = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60000; // Reduzi para 1 minuto para maior precisão em prod

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

    const token = (request.query.token as string) || process.env.BRAPI_TOKEN;

    // 1. Tentar Brapi (Alta Prioridade/Estabilidade)
    if (token) {
      try {
        const currencyUrl = `https://brapi.dev/api/v2/currency?currency=USD-BRL,EUR-BRL,BRL-USD&token=${token}`;
        const cryptoUrl = `https://brapi.dev/api/v2/crypto?coin=BTC,ETH&currency=BRL&token=${token}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        try {
          const [resCurr, resCrypto] = await Promise.all([
            fetch(currencyUrl, { signal: controller.signal }),
            fetch(cryptoUrl, { signal: controller.signal })
          ]);
          clearTimeout(timeoutId);

          if (resCurr.ok && resCrypto.ok) {
            const dataCurr = await resCurr.json();
            const dataCrypto = await resCrypto.json();

            const mappedData: any = {};
            
            if (dataCurr.currency && Array.isArray(dataCurr.currency)) {
              dataCurr.currency.forEach((c: any) => {
                const key = `${c.fromCurrency}${c.toCurrency}`;
                mappedData[key] = { 
                  bid: String(c.bidPrice || '0'), 
                  pctChange: String(c.variationPercentage || '0') 
                };
              });
            }

            if (dataCrypto.coins && Array.isArray(dataCrypto.coins)) {
              dataCrypto.coins.forEach((c: any) => {
                const key = `${c.coin}BRL`;
                mappedData[key] = {
                  bid: String(c.regularMarketPrice || '0'),
                  pctChange: String(c.regularMarketChangePercent || '0')
                };
              });
            }

            mappedData['XAUUSD'] = mappedData['XAUUSD'] || { bid: '0', pctChange: '0' };
            mappedData['XAGUSD'] = mappedData['XAGUSD'] || { bid: '0', pctChange: '0' };

            response.setHeader('X-Source', 'Brapi');
            return response.status(200).json(mappedData);
          }
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (e) {
        console.warn("Brapi falhou, tentando AwesomeAPI:", e);
      }
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

    return response.status(500).json({ 
      error: "Serviço de cotações temporariamente indisponível",
      details: error instanceof Error ? error.message : "Erro desconhecido",
      hint: "Verifique se as variáveis de ambiente BRAPI_TOKEN estão configuradas no Vercel."
    });
  }
}
