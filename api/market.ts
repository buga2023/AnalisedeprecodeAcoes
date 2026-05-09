import type { VercelRequest, VercelResponse } from '@vercel/node';

// Cache simples em memória (persiste enquanto a função estiver "quente")
let cachedData: any = null;
let lastFetchTime = 0;
const CACHE_DURATION = 120000; // 2 minutos

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Content-Type', 'application/json');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  const token = (request.query.token as string) || process.env.BRAPI_TOKEN;

  // Tentar Brapi se houver token
  if (token) {
    try {
      const currencyUrl = `https://brapi.dev/api/v2/currency?currency=USD-BRL,EUR-BRL,BRL-USD&token=${token}`;
      const cryptoUrl = `https://brapi.dev/api/v2/crypto?coin=BTC,ETH&currency=BRL&token=${token}`;

      const [resCurr, resCrypto] = await Promise.all([
        fetch(currencyUrl),
        fetch(cryptoUrl)
      ]);

      if (resCurr.ok && resCrypto.ok) {
        const dataCurr = await resCurr.json();
        const dataCrypto = await resCrypto.json();

        const mappedData: any = {};
        dataCurr.currency.forEach((c: any) => {
          const key = `${c.fromCurrency}${c.toCurrency}`;
          mappedData[key] = { bid: c.bidPrice, pctChange: c.variationPercentage };
        });

        dataCrypto.coins.forEach((c: any) => {
          const key = `${c.coin}BRL`;
          mappedData[key] = {
            bid: c.regularMarketPrice.toString(),
            pctChange: c.regularMarketChangePercent.toString()
          };
        });

        mappedData['XAUUSD'] = { bid: '0', pctChange: '0' };
        mappedData['XAGUSD'] = { bid: '0', pctChange: '0' };

        response.setHeader('X-Source', 'Brapi');
        return response.status(200).json(mappedData);
      }
    } catch (e) {
      console.warn("Erro ao buscar na Brapi, tentando AwesomeAPI:", e);
    }
  }

  // Fallback AwesomeAPI com Cache
  const now = Date.now();
  if (cachedData && (now - lastFetchTime < CACHE_DURATION)) {
    response.setHeader('X-Cache', 'HIT');
    return response.status(200).json(cachedData);
  }

  try {
    const TICKERS = 'USD-BRL,EUR-BRL,BTC-BRL,ETH-BRL,XAU-USD,XAG-USD,BRL-USD';
    const apiUrl = `https://economia.awesomeapi.com.br/last/${TICKERS}`;

    const res = await fetch(apiUrl);
    if (!res.ok) {
      return response.status(res.status).json({ error: `AwesomeAPI status ${res.status}` });
    }

    const data = await res.json();
    cachedData = data;
    lastFetchTime = Date.now();

    response.setHeader('X-Cache', 'MISS');
    return response.status(200).json(data);
  } catch (error) {
    return response.status(500).json({ 
      error: "Falha ao processar cotações do mercado",
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
