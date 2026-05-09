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

  // Token do servidor (fallback)
  const serverToken = process.env.BRAPI_TOKEN;
  
  const endpoint = event.queryStringParameters?.endpoint;
  if (!endpoint) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Parâmetro 'endpoint' é obrigatório." }) };
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(event.queryStringParameters || {})) {
    if (key !== 'endpoint') {
      params.append(key, value || "");
    }
  }
  
  // Usa o token do cliente se fornecido, senão usa o do servidor
  if (!params.has('token') && serverToken) {
    params.set('token', serverToken);
  }

  if (!params.has('token')) {
    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: "Brapi Token não configurado no servidor e não fornecido pelo cliente." }) };
  }

  const apiUrl = `https://brapi.dev/api${endpoint}?${params.toString()}`;

  try {
    const res = await fetch(apiUrl);
    if (!res.ok) {
      const errorText = await res.text();
      return {
        statusCode: res.status,
        headers: corsHeaders,
        body: JSON.stringify({ error: `Brapi retornou status ${res.status}`, details: errorText }),
      };
    }
    const data = await res.json();

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(data),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: "Erro ao buscar dados na Brapi.",
        details: error instanceof Error ? error.message : String(error)
      }),
    };
  }
};
