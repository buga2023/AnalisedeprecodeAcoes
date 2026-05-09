import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  response.setHeader('Content-Type', 'application/json');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const userKey = request.headers['x-api-key'];
  const serverKey = process.env.GROQ_API_KEY;
  const apiKey = userKey || serverKey;

  if (!apiKey) {
    return response.status(401).json({ error: "API Key do Groq não configurada." });
  }

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request.body),
    });

    if (!groqRes.ok) {
      const errorData = await groqRes.json();
      return response.status(groqRes.status).json(errorData);
    }

    const data = await groqRes.json();
    return response.status(200).json(data);
  } catch (error) {
    return response.status(500).json({ 
      error: "Erro na proxy da Groq API",
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
