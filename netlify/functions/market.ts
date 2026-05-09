import type { Handler, HandlerEvent } from "@netlify/functions";

export const handler: Handler = async (event: HandlerEvent) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: corsHeaders, body: "Method Not Allowed" };
  }

  const TICKERS = 'USD-BRL,EUR-BRL,BTC-BRL,ETH-BRL,XAU-USD,XAG-USD,BRL-USD';
  const apiKey = process.env.AWESOME_API_KEY;

  // AwesomeAPI funciona sem chave para a maioria dos casos, mas usamos se disponível
  const apiUrl = apiKey 
    ? `https://economia.awesomeapi.com.br/last/${TICKERS}/?token=${apiKey}`
    : `https://economia.awesomeapi.com.br/last/${TICKERS}`;



  try {
    const res = await fetch(apiUrl);
    if (!res.ok) {
      throw new Error(`AwesomeAPI retornou status ${res.status}`);
    }
    const data = await res.json();

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(data),
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Erro no proxy AwesomeAPI:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: "Erro ao buscar cotações de moedas.",
        details: errorMsg,
        stack: error instanceof Error ? error.stack : undefined
      }),
    };
  }
};
