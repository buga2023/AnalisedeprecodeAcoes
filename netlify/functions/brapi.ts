import type { Handler, HandlerEvent } from "@netlify/functions";

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const token = process.env.BRAPI_TOKEN;
  if (!token) {
    return { statusCode: 500, body: JSON.stringify({ error: "Token da Brapi não configurado no servidor." }) };
  }

  const endpoint = event.queryStringParameters?.endpoint;
  if (!endpoint) {
    return { statusCode: 400, body: JSON.stringify({ error: "Parâmetro 'endpoint' é obrigatório." }) };
  }

  // Remove o endpoint do queryStringParameters para não enviar duas vezes
  const params = new URLSearchParams(event.queryStringParameters as Record<string, string>);
  params.delete('endpoint');
  
  // Adiciona o token no queryString
  params.set('token', token);

  const apiUrl = `https://brapi.dev/api${endpoint}?${params.toString()}`;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  try {
    const res = await fetch(apiUrl);
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Brapi Error (${res.status}):`, errorText);
      return {
        statusCode: res.status,
        headers: corsHeaders,
        body: JSON.stringify({ error: `Brapi retornou status ${res.status}` }),
      };
    }
    const data = await res.json();

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error("Erro no proxy Brapi:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Erro ao buscar dados na Brapi." }),
    };
  }
};
