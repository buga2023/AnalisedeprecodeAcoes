import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  response.setHeader('Content-Type', 'application/json');

  try {
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request.body || {}),
        signal: controller.signal,
      });

      if (!groqRes.ok) {
        const errorText = await groqRes.text().catch(() => "Erro desconhecido na Groq");
        console.warn(`[groq] Erro da API: ${groqRes.status}`, errorText);
        return response.status(200).json({ 
          choices: [{ message: { content: "Desculpe, não consegui gerar a análise agora. Tente novamente em instantes." } }] 
        });
      }

      const data = await groqRes.json();
      return response.status(200).json(data);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error("Erro fatal na Groq API:", error);
    return response.status(200).json({ 
      choices: [{ message: { content: "O serviço de IA está temporariamente instável. Por favor, tente novamente." } }] 
    });
  }
}
