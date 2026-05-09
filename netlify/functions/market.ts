import type { Handler, HandlerEvent } from "@netlify/functions";

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const TICKERS = 'USD-BRL,EUR-BRL,BTC-BRL,ETH-BRL,XAU-USD,XAG-USD,BRL-USD';
  const apiKey = process.env.AWESOME_API_KEY;

  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "API Key não configurada no servidor." }) };
  }

  const apiUrl = `https://economia.awesomeapi.com.br/last/${TICKERS}/?apikey=${apiKey}`;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

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
    console.error("Erro no proxy AwesomeAPI:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Erro ao buscar cotações de moedas." }),
    };
  }
};
