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

  // Responder ao Preflight de CORS
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  // Verificar cache
  const now = Date.now();
  if (cachedData && (now - lastFetchTime < CACHE_DURATION)) {
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        "X-Cache": "HIT"
      },
      body: JSON.stringify(cachedData),
    };
  }

  try {
    // Lista simplificada e garantida de funcionar na AwesomeAPI
    const TICKERS = 'USD-BRL,EUR-BRL,BTC-BRL,ETH-BRL,XAU-USD,XAG-USD,BRL-USD';
    const apiUrl = `https://economia.awesomeapi.com.br/last/${TICKERS}`;

    const res = await fetch(apiUrl);
    
    if (!res.ok) {
      return {
        statusCode: res.status,
        headers: corsHeaders,
        body: JSON.stringify({ error: `AwesomeAPI retornou status ${res.status}` }),
      };
    }

    const data = await res.json();

    // Atualizar cache
    cachedData = data;
    lastFetchTime = Date.now();

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        "X-Cache": "MISS"
      },
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error("Erro no proxy Market:", error);
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
