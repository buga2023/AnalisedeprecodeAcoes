import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors } from "./_cors";
import { checkRateLimit } from "./_ratelimit";
import { cacheKey, getCached, setCached, getCachedDurable, setCachedDurable } from "./_aicache";
import { getSemanticCached, setSemanticCached } from "./_semanticCache";
import { callLLM, defaultProvider, hasAnyProviderKey, LLMError, PROVIDERS, type Message, type Provider } from "./_llm";
import { assertCanUseAI, trackUsage, GuardError } from "./_usageGuard";
import { captureApiError } from "./_sentry";

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

  // Basta UM provider configurado — callLLM cai pro próximo com chave em 429/503.
  if (!hasAnyProviderKey()) {
    return response.status(503).json({
      error: `IA nao configurada no servidor: defina a chave de algum provider (ex.: OPENROUTER_API_KEY, GROQ_API_KEY).`,
    });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return response.status(400).json({ error: "messages e obrigatorio." });
  }

  // Paywall gate (dormente quando BILLING_ENABLED != "true"). `feature` vem do
  // client (string em PaywalledFeature); fallback genérico se ausente.
  const feature = typeof (body as { feature?: string }).feature === "string"
    ? (body as { feature: string }).feature
    : "ai-analysis";
  let gateUserId: string | null = null;
  try {
    const gate = await assertCanUseAI(request, feature);
    gateUserId = gate.userId;
  } catch (error) {
    if (error instanceof GuardError) {
      if (error.status === 402) return response.status(402).json(error.payload);
      return response.status(error.status).json({ error: error.message });
    }
    throw error;
  }

  // Cache: mesma combinação de (provider, messages, temperature, max_tokens,
  // response_format) → devolve resposta cacheada sem chamar o provider. TTL 10min.
  // Chave provider-agnostic ("balanced"): a mesma pergunta reusa a resposta
  // cacheada independente de qual provider (Groq/Gemini/OpenRouter) a gerou.
  const key = cacheKey({ provider: "balanced", messages, temperature, max_tokens, response_format });

  // L1 (memória, por instância): hit imediato.
  const l1 = getCached(key);
  if (l1) {
    response.setHeader("X-Cache", "HIT");
    return response.status(200).json(l1);
  }
  // L2 (Supabase durável, compartilhado): recicla geração de outro usuário/cold
  // start. Hit → promove pro L1. Cache hit não conta uso (não chamou o LLM).
  const l2 = await getCachedDurable(key);
  if (l2) {
    setCached(key, l2);
    response.setHeader("X-Cache", "HIT-L2");
    return response.status(200).json(l2);
  }
  // L3 (semântico, só chat): paráfrase da última pergunta reaproveita resposta
  // anterior. Dormente salvo SEMANTIC_CACHE_ENABLED + infra implantada.
  const isChat = feature === "chat";
  const lastUserMsg = isChat
    ? [...messages].reverse().find((m) => m.role === "user")?.content ?? ""
    : "";
  if (isChat && lastUserMsg) {
    const sem = await getSemanticCached(lastUserMsg);
    if (sem) {
      setCached(key, sem);
      response.setHeader("X-Cache", "HIT-SEM");
      return response.status(200).json(sem);
    }
  }
  response.setHeader("X-Cache", "MISS");

  try {
    const result = await callLLM({ provider, messages, temperature, max_tokens, response_format });
    setCached(key, result);
    void setCachedDurable(key, result); // popula L2 sem bloquear a resposta
    if (isChat && lastUserMsg) void setSemanticCached(lastUserMsg, result); // popula L3
    // Conta o uso só após sucesso de uma chamada real ao LLM (cache hit não conta).
    await trackUsage(gateUserId, feature);
    return response.status(200).json(result);
  } catch (error) {
    if (error instanceof LLMError) {
      // Log sanitizado: status + mensagem curta, sem payload upstream cru.
      console.error("[api/ai] %s %d %s", provider, error.status, String(error.message).slice(0, 120));
      const status = error.status === 401 || error.status === 403 ? 401 : error.status;
      const message =
        status === 401
          ? `API key invalida para ${provider}`
          : status === 429
            ? "A IA gratuita atingiu o limite agora. Tente de novo em alguns instantes."
            : error.message;
      return response.status(status).json({ error: message });
    }
    captureApiError(error, "ai");
    const msg = error instanceof Error ? error.message : "Erro interno";
    console.error("[api/ai] %s 500 %s", provider, msg.slice(0, 120));
    return response.status(500).json({ error: `Erro interno no servidor ao processar ${provider}` });
  }
}
