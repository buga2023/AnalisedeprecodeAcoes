/**
 * Helper compartilhado para chamada a provedor LLM (NVIDIA/Groq/Cerebras/OpenAI/Anthropic/Gemini).
 *
 * Centraliza o protocolo de cada provedor + resolução de env var. Os handlers
 * (`api/ai.ts`, `api/fundamentals.ts`) ficam responsáveis SOMENTE pelas suas
 * camadas próprias: CORS, rate-limit, cache, validação de input, parsing de
 * resposta. Tudo que toca rede com o provedor passa por aqui.
 *
 * Arquivos `_*.ts` em `api/` são utilitários — não viram rota Vercel.
 */

export type Provider = "nvidia" | "groq" | "cerebras" | "openai" | "anthropic" | "gemini";
// Ordem importa: é a prioridade do fallback (gratuitos primeiro).
export const PROVIDERS: Provider[] = ["nvidia", "groq", "cerebras", "openai", "anthropic", "gemini"];

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CallLLMOptions {
  provider: Provider;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  response_format?: unknown;
}

export interface CallLLMResult {
  content: string;
  provider: Provider;
}

export class LLMError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "LLMError";
  }
}

/** Resolve a chave do provedor em `process.env`. Retorna `null` se ausente. */
export function getProviderApiKey(provider: Provider): string | null {
  const map: Record<Provider, string | undefined> = {
    nvidia: process.env.NVIDIA_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    groq: process.env.GROQ_API_KEY,
    cerebras: process.env.CEREBRAS_API_KEY,
  };
  return map[provider] || null;
}

/** Modelo do provedor, sobrescrevível via env (`GROQ_MODEL`, `NVIDIA_MODEL`, …). */
function envModel(provider: Provider, fallback: string): string {
  return process.env[`${provider.toUpperCase()}_MODEL`] || fallback;
}

/** Resolve o provedor padrão: env `AI_PROVIDER` ou `nvidia`. */
export function defaultProvider(): Provider {
  const fromEnv = (process.env.AI_PROVIDER as Provider) || "nvidia";
  return PROVIDERS.includes(fromEnv) ? fromEnv : "nvidia";
}

/**
 * Chama o provedor LLM e devolve `{ content, provider }`. Lança `LLMError`
 * (com `status` HTTP) em falha — handler decide como traduzir pro cliente.
 */
export async function callLLM(opts: CallLLMOptions): Promise<CallLLMResult> {
  const { provider, messages, temperature = 0.7, max_tokens = 2048, response_format } = opts;
  const apiKey = getProviderApiKey(provider);
  if (!apiKey) {
    throw new LLMError(503, `IA nao configurada: defina ${provider.toUpperCase()}_API_KEY.`);
  }

  switch (provider) {
    case "nvidia":
      return callNvidia(apiKey, messages, temperature, max_tokens, response_format);
    case "openai":
      return callOpenAI(apiKey, messages, temperature, max_tokens, response_format);
    case "anthropic":
      return callAnthropic(apiKey, messages, temperature, max_tokens);
    case "gemini":
      return callGemini(apiKey, messages, temperature, max_tokens);
    case "groq":
      return callGroq(apiKey, messages, temperature, max_tokens, response_format);
    case "cerebras":
      return callCerebras(apiKey, messages, temperature, max_tokens, response_format);
    default:
      throw new LLMError(400, `Provider ${provider} nao suportado.`);
  }
}

// Erros que valem tentar outro provedor: chave inválida, rate limit, indisponibilidade.
const FALLBACK_STATUSES = new Set([401, 403, 408, 429, 500, 502, 503, 504]);

/**
 * Como `callLLM`, mas se o provedor pedido falhar com erro recuperável
 * (401/403/429/5xx), tenta os demais provedores COM chave configurada,
 * na ordem de `PROVIDERS`. Lança o último erro se todos falharem.
 */
export async function callLLMWithFallback(opts: CallLLMOptions): Promise<CallLLMResult> {
  const chain: Provider[] = [
    opts.provider,
    ...PROVIDERS.filter((p) => p !== opts.provider && getProviderApiKey(p)),
  ];
  let lastError: unknown;
  for (const provider of chain) {
    try {
      return await callLLM({ ...opts, provider });
    } catch (error) {
      lastError = error;
      if (!(error instanceof LLMError) || !FALLBACK_STATUSES.has(error.status)) throw error;
      console.warn("[_llm] %s falhou (%d) — tentando proximo provedor", provider, error.status);
    }
  }
  throw lastError;
}

async function callNvidia(
  apiKey: string,
  messages: Message[],
  temperature: number,
  max_tokens: number,
  response_format: unknown
): Promise<CallLLMResult> {
  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: envModel("nvidia", "meta/llama-3.3-70b-instruct"),
      messages,
      temperature,
      max_tokens,
      ...(response_format ? { response_format } : {}),
    }),
  });
  if (!res.ok) {
    const err = await safeJson(res);
    throw new LLMError(res.status, err?.error?.message || "Erro na NVIDIA NIM");
  }
  const data = await res.json();
  return { content: data.choices?.[0]?.message?.content ?? "", provider: "nvidia" };
}

async function callOpenAI(
  apiKey: string,
  messages: Message[],
  temperature: number,
  max_tokens: number,
  response_format: unknown
): Promise<CallLLMResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
      messages,
      temperature,
      max_tokens,
      ...(response_format ? { response_format } : {}),
    }),
  });
  if (!res.ok) {
    const err = await safeJson(res);
    throw new LLMError(res.status, err?.error?.message || "Erro na OpenAI");
  }
  const data = await res.json();
  return { content: data.choices?.[0]?.message?.content ?? "", provider: "openai" };
}

async function callAnthropic(
  apiKey: string,
  messages: Message[],
  temperature: number,
  max_tokens: number
): Promise<CallLLMResult> {
  const systemMessage = messages.find((m) => m.role === "system")?.content;
  const userMessages = messages.filter((m) => m.role !== "system");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      system: systemMessage,
      messages: userMessages,
      temperature,
      max_tokens,
    }),
  });
  if (!res.ok) {
    const err = await safeJson(res);
    throw new LLMError(res.status, err?.error?.message || "Erro na Anthropic");
  }
  const data = await res.json();
  return { content: data.content?.[0]?.text ?? "", provider: "anthropic" };
}

async function callGemini(
  apiKey: string,
  messages: Message[],
  temperature: number,
  max_tokens: number
): Promise<CallLLMResult> {
  const model = "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.content }] }));
  const systemInstruction = messages.find((m) => m.role === "system")?.content;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
      generationConfig: { temperature, maxOutputTokens: max_tokens },
    }),
  });
  if (!res.ok) {
    const err = await safeJson(res);
    throw new LLMError(res.status, err?.error?.message || "Erro no Gemini");
  }
  const data = await res.json();
  return { content: data.candidates?.[0]?.content?.parts?.[0]?.text ?? "", provider: "gemini" };
}

async function callGroq(
  apiKey: string,
  messages: Message[],
  temperature: number,
  max_tokens: number,
  response_format: unknown
): Promise<CallLLMResult> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: envModel("groq", "qwen/qwen3-32b"),
      messages,
      temperature,
      max_tokens,
      ...(response_format ? { response_format } : {}),
    }),
  });
  if (!res.ok) {
    const err = await safeJson(res);
    throw new LLMError(res.status, err?.error?.message || "Erro no Groq");
  }
  const data = await res.json();
  return { content: data.choices?.[0]?.message?.content ?? "", provider: "groq" };
}

async function callCerebras(
  apiKey: string,
  messages: Message[],
  temperature: number,
  max_tokens: number,
  response_format: unknown
): Promise<CallLLMResult> {
  const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: envModel("cerebras", "gpt-oss-120b"),
      messages,
      temperature,
      max_tokens,
      ...(response_format ? { response_format } : {}),
    }),
  });
  if (!res.ok) {
    const err = await safeJson(res);
    throw new LLMError(res.status, err?.error?.message || "Erro na Cerebras");
  }
  const data = await res.json();
  return { content: data.choices?.[0]?.message?.content ?? "", provider: "cerebras" };
}

async function safeJson(res: Response): Promise<{ error?: { message?: string } } | null> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
