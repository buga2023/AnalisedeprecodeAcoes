import type { Handler, HandlerEvent } from "@netlify/functions";

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

    return {
      statusCode: 200,
      headers: corsHeaders,
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
