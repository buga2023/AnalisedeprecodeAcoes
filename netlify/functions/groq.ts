import type { Handler, HandlerEvent } from "@netlify/functions";

export const handler: Handler = async (event: HandlerEvent) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: "Method Not Allowed" };
  }

  // Prioridade: Header do cliente > Env Var do Servidor
  const apiKey = (event.headers["x-api-key"] || event.headers["X-API-Key"]) || process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    return { 
      statusCode: 401, 
      headers: corsHeaders,
      body: JSON.stringify({ error: "Groq API Key não configurada. Forneça uma chave no cabeçalho x-api-key ou configure no servidor." }) 
    };
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

    const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: payload.model || "llama-3.3-70b-versatile",
            messages: payload.messages,
            temperature: payload.temperature ?? 0.7,
            max_tokens: payload.max_tokens ?? 2048,
            response_format: payload.response_format ?? { type: "json_object" },
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        return {
            statusCode: response.status,
            headers: corsHeaders,
            body: JSON.stringify({ error: `Groq retornou status ${response.status}`, details: errorBody })
        };
    }

    const data = await response.json();
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
        error: "Erro ao processar via IA.", 
        details: error instanceof Error ? error.message : String(error)
      }),
    };
  }
};
