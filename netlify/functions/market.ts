import type { Handler, HandlerEvent } from "@netlify/functions";

// Cache simples em memória (persiste enquanto a função estiver quente)
let cachedData: any = null;
let lastFetchTime = 0;
const CACHE_DURATION = 120000; // 2 minutos

export const handler: Handler = async (event: HandlerEvent) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
  };

  try {
    // Responder ao Preflight de CORS
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: corsHeaders, body: "" };
    }

    const token = event.queryStringParameters?.token || process.env.BRAPI_TOKEN;

    // Se tivermos token, tentamos usar a Brapi para dados mais estáveis
    if (token) {
      try {
        // 1. Buscar Moedas
        const currencyUrl = `https://brapi.dev/api/v2/currency?currency=USD-BRL,EUR-BRL,BRL-USD&token=${token}`;
        const cryptoUrl = `https://brapi.dev/api/v2/crypto?coin=BTC,ETH&currency=BRL&token=${token}`;

        const [resCurr, resCrypto] = await Promise.all([
          fetch(currencyUrl, { signal: AbortSignal.timeout(8000) }),
          fetch(cryptoUrl, { signal: AbortSignal.timeout(8000) })
        ]);

        if (resCurr.ok && resCrypto.ok) {
          const dataCurr = await resCurr.json();
          const dataCrypto = await resCrypto.json();

          // Mapear para o formato que o frontend espera (formato da AwesomeAPI)
          const mappedData: any = {};
          
          if (dataCurr.currency && Array.isArray(dataCurr.currency)) {
            dataCurr.currency.forEach((c: any) => {
              const key = `${c.fromCurrency}${c.toCurrency}`;
              mappedData[key] = {
                bid: c.bidPrice,
                pctChange: c.variationPercentage
              };
            });
          }

          if (dataCrypto.coins && Array.isArray(dataCrypto.coins)) {
            dataCrypto.coins.forEach((c: any) => {
              const key = `${c.coin}BRL`;
              mappedData[key] = {
                bid: c.regularMarketPrice.toString(),
                pctChange: c.regularMarketChangePercent.toString()
              };
            });
          }

          // Fallback para Ouro/Prata da AwesomeAPI (se ainda funcionar) ou valores zerados
          mappedData['XAUUSD'] = mappedData['XAUUSD'] || { bid: '0', pctChange: '0' };
          mappedData['XAGUSD'] = mappedData['XAGUSD'] || { bid: '0', pctChange: '0' };

          return {
            statusCode: 200,
            headers: { ...corsHeaders, "X-Source": "Brapi" },
            body: JSON.stringify(mappedData),
          };
        }
      } catch (e) {
        console.warn("Erro ao buscar na Brapi, tentando AwesomeAPI:", e);
      }
    }

    // Fallback para AwesomeAPI (lógica original com cache)
    const now = Date.now();
    if (cachedData && (now - lastFetchTime < CACHE_DURATION)) {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, "X-Cache": "HIT" },
        body: JSON.stringify(cachedData),
      };
    }

    const TICKERS = 'USD-BRL,EUR-BRL,BTC-BRL,ETH-BRL,XAU-USD,XAG-USD,BRL-USD';
    const apiUrl = `https://economia.awesomeapi.com.br/last/${TICKERS}`;

    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) });
    
    if (!res.ok) {
      // Se a API principal falhar mas tivermos cache (mesmo velho), usamos o cache
      if (cachedData) {
        return {
          statusCode: 200,
          headers: { ...corsHeaders, "X-Cache": "STALE" },
          body: JSON.stringify(cachedData),
        };
      }
      return {
        statusCode: res.status,
        headers: corsHeaders,
        body: JSON.stringify({ error: `AwesomeAPI retornou status ${res.status}` }),
      };
    }

    const data = await res.json();
    cachedData = data;
    lastFetchTime = Date.now();

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "X-Cache": "MISS" },
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error("Erro no proxy Market:", error);
    
    // Fallback final para cache se tudo explodir
    if (cachedData) {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, "X-Cache": "STALE_FATAL" },
        body: JSON.stringify(cachedData),
      };
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: "Falha ao processar cotações do mercado",
        details: error instanceof Error ? error.message : String(error)
      }),
    };
  }
};
