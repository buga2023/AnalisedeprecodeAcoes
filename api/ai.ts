import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors } from "./_cors";
import { checkRateLimit } from "./_ratelimit";
import { cacheKey, getCached, setCached } from "./_aicache";
import { callLLM, defaultProvider, getProviderApiKey, LLMError, PROVIDERS, type Message, type Provider } from "./_llm";

const MAX_TOKENS_HARD_CAP = 2048;

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (applyCors(request, response, "POST, OPTIONS")) return;

  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method Not Allowed" });
  }

  // Rate limit conservador: 10 req/min/IP + burst 3 req em 5s.
  // Groq free tier tem cota baixa — limite agressivo evita estourar.
  const rate = checkRateLimit(request, { windowMs: 60_000, max: 10, burstMax: 3, burstWindowMs: 5_000 });
  if (!rate.allowed) {
    response.setHeader("Retry-After", String(rate.retryAfterSec));
    return response.status(429).json({
      error:
        rate.reason === "burst"
          ? "Calma — espere alguns segundos entre mensagens."
          : "Muitas requisições no último minuto. Tente novamente em breve.",
      retryAfterSec: rate.retryAfterSec,
    });
  }

  const body = request.body || {};
  const { messages, temperature = 0.7, max_tokens: rawMaxTokens = 2048, response_format } = body as {
    messages: Message[];
    temperature?: number;
    max_tokens?: number;
    response_format?: unknown;
  };

  // Teto absoluto pra evitar bill drain via input do cliente.
  const max_tokens = Math.min(MAX_TOKENS_HARD_CAP, Math.max(1, Number(rawMaxTokens) || 2048));

  const bodyProvider = (body as { provider?: string }).provider;
  const provider: Provider = PROVIDERS.includes(bodyProvider as Provider)
    ? (bodyProvider as Provider)
    : defaultProvider();

  // Valida input antes de checar chave — retorna 400 sem depender do ambiente.
  if (!Array.isArray(messages) || messages.length === 0) {
    return response.status(400).json({ error: "messages e obrigatorio." });
  }

  if (!getProviderApiKey(provider)) {
    return response.status(503).json({
      error: `IA nao configurada no servidor: defina ${provider.toUpperCase()}_API_KEY no ambiente.`,
    });
  }

  // Cache: mesma combinação de (provider, messages, temperature, max_tokens,
  // response_format) → devolve resposta cacheada sem chamar o provider. TTL 10min.
  const key = cacheKey({ provider, messages, temperature, max_tokens, response_format });
  const cached = getCached(key);
  if (cached) {
    response.setHeader("X-Cache", "HIT");
    return response.status(200).json(cached);
  }
  response.setHeader("X-Cache", "MISS");

  try {
    const result = await callLLM({ provider, messages, temperature, max_tokens, response_format });
    setCached(key, result);
    return response.status(200).json(result);
  } catch (error) {
    if (error instanceof LLMError) {
      // Log sanitizado: status + mensagem curta, sem payload upstream cru.
      console.error("[api/ai] %s %d %s", provider, error.status, String(error.message).slice(0, 120));
      const status = error.status === 401 || error.status === 403 ? 401 : error.status;
      const message = status === 401 ? `API key invalida para ${provider}` : error.message;
      return response.status(status).json({ error: message });
    }
    const msg = error instanceof Error ? error.message : "Erro interno";
    console.error("[api/ai] %s 500 %s", provider, msg.slice(0, 120));
    return response.status(500).json({ error: `Erro interno no servidor ao processar ${provider}` });
  }
}
