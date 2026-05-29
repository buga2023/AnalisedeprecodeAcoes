/**
 * Helper compartilhado para chamada a provedor LLM (Groq/OpenAI/Anthropic/Gemini).
 *
 * Centraliza o protocolo de cada provedor + resolução de env var. Os handlers
 * (`api/ai.ts`, `api/fundamentals.ts`) ficam responsáveis SOMENTE pelas suas
 * camadas próprias: CORS, rate-limit, cache, validação de input, parsing de
 * resposta. Tudo que toca rede com o provedor passa por aqui.
 *
 * Arquivos `_*.ts` em `api/` são utilitários — não viram rota Vercel.
 */

export type Provider = "groq" | "openai" | "anthropic" | "gemini" | "openrouter";
export const PROVIDERS: Provider[] = ["groq", "openai", "anthropic", "gemini", "openrouter"];

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
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    groq: process.env.GROQ_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
  };
  return map[provider] || null;
}

/** Resolve o provedor padrão: env `AI_PROVIDER` ou `openrouter`. */
export function defaultProvider(): Provider {
  const fromEnv = (process.env.AI_PROVIDER as Provider) || "openrouter";
  return PROVIDERS.includes(fromEnv) ? fromEnv : "openrouter";
}

/** True se ALGUM provider tem chave configurada (qualquer um serve via fallback). */
export function hasAnyProviderKey(): boolean {
  return PROVIDERS.some((p) => getProviderApiKey(p));
}

/** Status HTTP que valem trocar de provider (capacidade/quota/transitório). */
const PROVIDER_FALLBACK_STATUSES = new Set([429, 502, 503, 504]);

/** Pool free balanceado (round-robin). Cada um tem quota free SEPARADA. */
const BALANCE_POOL: Provider[] = ["groq", "gemini", "openrouter"];
/** Cursor de rodízio (por instância). Espalha a carga ~igualmente pelos 3. */
let rrCursor = 0;

/**
 * Ordem de tentativa por requisição: round-robin entre os providers free com
 * chave (Groq/Gemini/OpenRouter) — cada chamada COMEÇA por um provider
 * diferente, distribuindo o uso e economizando a quota free de cada um. Os
 * demais ficam como fallback (em 429/503 cai pro próximo). Se nenhum do pool
 * free tiver chave, usa qualquer provider configurado (ex.: OpenAI/Anthropic).
 */
function balancedChain(): Provider[] {
  const pool = BALANCE_POOL.filter((p) => getProviderApiKey(p));
  if (pool.length === 0) {
    return PROVIDERS.filter((p) => getProviderApiKey(p));
  }
  const start = rrCursor % pool.length;
  rrCursor = (rrCursor + 1) % pool.length;
  // Começa no provider da vez; o resto vira fallback na ordem do pool.
  return [...pool.slice(start), ...pool.slice(0, start)];
}

function callSingleProvider(
  provider: Provider,
  apiKey: string,
  messages: Message[],
  temperature: number,
  max_tokens: number,
  response_format: unknown
): Promise<CallLLMResult> {
  switch (provider) {
    case "openai":
      return callOpenAI(apiKey, messages, temperature, max_tokens, response_format);
    case "anthropic":
      return callAnthropic(apiKey, messages, temperature, max_tokens);
    case "gemini":
      return callGemini(apiKey, messages, temperature, max_tokens, response_format);
    case "groq":
      return callGroq(apiKey, messages, temperature, max_tokens, response_format);
    case "openrouter":
      return callOpenRouter(apiKey, messages, temperature, max_tokens, response_format);
    default:
      throw new LLMError(400, `Provider ${provider} nao suportado.`);
  }
}

/**
 * Chama o LLM e devolve `{ content, provider }`. Tenta o provider preferido e,
 * em 429/502/503/504 (capacidade/quota), cai para o próximo provider com chave.
 * Erros não-transitórios (401/400) sobem na hora. Lança `LLMError` se todos
 * falharem ou nenhum estiver configurado.
 */
export async function callLLM(opts: CallLLMOptions): Promise<CallLLMResult> {
  const { provider, messages, temperature = 0.7, max_tokens = 2048, response_format } = opts;
  // Se o caller forçou um provider específico (e ele tem chave), respeita e usa
  // os demais como fallback. Caso contrário, round-robin entre os free.
  const forced = getProviderApiKey(provider) ? provider : null;
  const chain = forced
    ? [forced, ...balancedChain().filter((p) => p !== forced)]
    : balancedChain();

  let lastErr: LLMError = new LLMError(503, "IA nao configurada: defina a chave de algum provider.");
  for (const p of chain) {
    const apiKey = getProviderApiKey(p);
    if (!apiKey) continue;
    try {
      return await callSingleProvider(p, apiKey, messages, temperature, max_tokens, response_format);
    } catch (error) {
      if (error instanceof LLMError && PROVIDER_FALLBACK_STATUSES.has(error.status)) {
        lastErr = error; // tenta o próximo provider
        continue;
      }
      throw error; // 401/400/etc — problema real, surface imediatamente
    }
  }
  throw lastErr;
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
  max_tokens: number,
  response_format: unknown
): Promise<CallLLMResult> {
  // Modelo via env `GEMINI_MODEL` (default 2.0-flash: free, rápido, JSON nativo;
  // suba para gemini-2.5-flash p/ mais qualidade). Tier free do AI Studio é bem
  // mais generoso que o free do OpenRouter (~1500 req/dia vs ~50).
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.content }] }));
  const systemInstruction = messages.find((m) => m.role === "system")?.content;
  // JSON mode nativo quando o app pede json_object → resposta sempre parseável,
  // sem gastar tokens/retry com markdown ou texto solto.
  const wantsJson = (response_format as { type?: string } | undefined)?.type === "json_object";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
      generationConfig: {
        temperature,
        maxOutputTokens: max_tokens,
        ...(wantsJson ? { responseMimeType: "application/json" } : {}),
      },
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
      model: "llama-3.3-70b-versatile",
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

/** `await sleep(ms)` — backoff entre retries. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Cadeia de modelos free pro OpenRouter rotear em fallback: tenta o primário e,
 * se indisponível/throttled, cai pro próximo. Primário via `OPENROUTER_MODEL`;
 * cadeia inteira customizável via `OPENROUTER_FALLBACKS` (CSV). Todos `:free`.
 */
function resolveOpenRouterModels(): string[] {
  // Modelos free fortes p/ análise financeira PT-BR + JSON (capacidade alta,
  // contexto grande). DeepSeek V4 Flash primário; Qwen3-80B e GPT-OSS-120B de
  // fallback. Override por env `OPENROUTER_MODEL` / `OPENROUTER_FALLBACKS`.
  const primary = process.env.OPENROUTER_MODEL || "deepseek/deepseek-v4-flash:free";
  const fallbacks = process.env.OPENROUTER_FALLBACKS
    ? process.env.OPENROUTER_FALLBACKS.split(",").map((s) => s.trim()).filter(Boolean)
    : ["qwen/qwen3-next-80b-a3b-instruct:free", "openai/gpt-oss-120b:free"];
  // OpenRouter limita `models` a 3 itens — dedup + corta no teto.
  return [...new Set([primary, ...fallbacks])].slice(0, 3);
}

async function callOpenRouter(
  apiKey: string,
  messages: Message[],
  temperature: number,
  max_tokens: number,
  response_format: unknown
): Promise<CallLLMResult> {
  // OpenRouter é OpenAI-compatible. `models[]` faz fallback automático entre
  // modelos free; status 429/503 (capacidade/throttle do free) ganham retry com
  // backoff curto. Outros erros falham na hora.
  const models = resolveOpenRouterModels();
  const body = JSON.stringify({
    models,
    messages,
    temperature,
    max_tokens,
    ...(response_format ? { response_format } : {}),
  });
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    // Headers opcionais de ranking do OpenRouter (identificam o app).
    "X-Title": "Praxia",
    ...(process.env.OPENROUTER_REFERER ? { "HTTP-Referer": process.env.OPENROUTER_REFERER } : {}),
  };

  const MAX_ATTEMPTS = 3;
  let lastErr: LLMError = new LLMError(500, "Erro no OpenRouter");
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers,
      body,
    });
    if (res.ok) {
      const data = await res.json();
      return { content: data.choices?.[0]?.message?.content ?? "", provider: "openrouter" };
    }
    const err = await safeJson(res);
    lastErr = new LLMError(res.status, err?.error?.message || "Erro no OpenRouter");
    // Só re-tenta throttle/capacidade transitória; backoff 400ms, 800ms.
    if ((res.status === 429 || res.status === 503) && attempt < MAX_ATTEMPTS) {
      await sleep(attempt * 400);
      continue;
    }
    throw lastErr;
  }
  throw lastErr;
}

async function safeJson(res: Response): Promise<{ error?: { message?: string } } | null> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
