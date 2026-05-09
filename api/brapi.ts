import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // Configuração de CORS para Vercel
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Content-Type', 'application/json');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const serverToken = process.env.BRAPI_TOKEN;
  const endpoint = Array.isArray(request.query.endpoint) ? request.query.endpoint[0] : request.query.endpoint;
  const { endpoint: _, ...query } = request.query;

  if (!endpoint) {
    return response.status(400).json({ error: "Parâmetro 'endpoint' é obrigatório." });
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    params.append(key, String(value));
  }
  
  // Token handling
  if (!params.has('token') && serverToken) {
    params.set('token', serverToken);
  }

  if (!params.has('token')) {
    return response.status(401).json({ error: "Brapi Token não configurado no servidor e não fornecido pelo cliente." });
  }

  const apiUrl = `https://brapi.dev/api${endpoint}?${params.toString()}`;

  try {
    const res = await fetch(apiUrl);
    if (!res.ok) {
      const errorText = await res.text();
      return response.status(res.status).json({ 
        error: `Brapi retornou status ${res.status}`, 
        details: errorText 
      });
    }
    const data = await res.json();
    return response.status(200).json(data);
  } catch (error) {
    return response.status(500).json({ 
      error: "Erro ao buscar dados na Brapi.",
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
