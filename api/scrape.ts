import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Content-Type', 'application/json');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  const { url } = request.query;

  if (!url || typeof url !== 'string') {
    return response.status(400).json({ error: "URL é obrigatória." });
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      }
    });

    if (!res.ok) {
      return response.status(res.status).json({ error: `Alvo retornou status ${res.status}` });
    }

    const html = await res.text();
    return response.status(200).json({ html });
  } catch (error) {
    return response.status(500).json({ 
      error: "Erro ao realizar scraping",
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
