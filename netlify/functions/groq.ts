import type { Handler, HandlerEvent } from "@netlify/functions";

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "Groq API Key não configurada no servidor." }) };
  }

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

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
        console.error("Groq API error:", response.status, errorBody);
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
    console.error("Erro no proxy Groq:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Erro ao processar insights via IA." }),
    };
  }
};
