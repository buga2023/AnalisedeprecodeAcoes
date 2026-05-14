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
    return response.status(204).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { provider: bodyProvider, messages, temperature = 0.7, max_tokens = 2048, response_format } = request.body;

  const provider = (bodyProvider || process.env.AI_PROVIDER || 'groq') as string;

  const envKeyMap: Record<string, string | undefined> = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    groq: process.env.GROQ_API_KEY,
  };
  const apiKey = envKeyMap[provider];

  if (!apiKey) {
    return response.status(503).json({
      error: `IA nao configurada no servidor: defina ${provider.toUpperCase()}_API_KEY no ambiente.`,
    });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return response.status(400).json({ error: 'messages e obrigatorio.' });
  }

  try {
    let result;
    switch (provider) {
      case 'openai':
        result = await handleOpenAI(apiKey, messages, temperature, max_tokens, response_format);
        break;
      case 'anthropic':
        result = await handleAnthropic(apiKey, messages, temperature, max_tokens);
        break;
      case 'gemini':
        result = await handleGemini(apiKey, messages, temperature, max_tokens);
        break;
      case 'groq':
        result = await handleGroq(apiKey, messages, temperature, max_tokens, response_format);
        break;
      default:
        return response.status(400).json({ error: `Provider ${provider} nao suportado.` });
    }

    return response.status(200).json(result);
  } catch (error: any) {
    console.error(`Erro no provider ${provider}:`, error);
    const status = error.status || 500;
    const message = error.message || `Erro interno no servidor ao processar ${provider}`;
    
    if (status === 401 || status === 403) {
      return response.status(401).json({ error: `API key invalida para ${provider}` });
    }

    return response.status(status).json({ error: message });
  }
}

async function handleOpenAI(apiKey: string, messages: any[], temperature: number, max_tokens: number, response_format: any) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages,
      temperature,
      max_tokens,
      ...(response_format ? { response_format } : {}),
    }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw { status: res.status, message: error.error?.message || 'Erro na OpenAI' };
  }

  const data = await res.json();
  return { 
    content: data.choices[0].message.content,
    provider: 'openai'
  };
}

async function handleAnthropic(apiKey: string, messages: any[], temperature: number, max_tokens: number) {
  // Anthropic messages format differs slightly
  const systemMessage = messages.find(m => m.role === 'system')?.content;
  const userMessages = messages.filter(m => m.role !== 'system');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      system: systemMessage,
      messages: userMessages,
      temperature,
      max_tokens,
    }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw { status: res.status, message: error.error?.message || 'Erro na Anthropic' };
  }

  const data = await res.json();
  return { 
    content: data.content[0].text,
    provider: 'anthropic'
  };
}

async function handleGemini(apiKey: string, messages: any[], temperature: number, max_tokens: number) {
  const model = 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Gemini expects a different structure
  const contents = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }));

  const systemInstruction = messages.find(m => m.role === 'system')?.content;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents,
      ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
      generationConfig: {
        temperature,
        maxOutputTokens: max_tokens,
      }
    }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw { status: res.status, message: error.error?.message || 'Erro no Gemini' };
  }

  const data = await res.json();
  return { 
    content: data.candidates[0].content.parts[0].text,
    provider: 'gemini'
  };
}

async function handleGroq(apiKey: string, messages: any[], temperature: number, max_tokens: number, response_format: any) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature,
      max_tokens,
      ...(response_format ? { response_format } : {}),
    }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw { status: res.status, message: error.error?.message || 'Erro no Groq' };
  }

  const data = await res.json();
  return { 
    content: data.choices[0].message.content,
    provider: 'groq'
  };
}
