import type { InvestorProfile } from "@/types/stock";
import type { WorldNewsTopicBundle } from "./context";
import { PRAXIA_SYSTEM_PROMPT, JSON_ONLY_SUFFIX } from "./praxiaPrompt";
import { checkRateLimit, estimateTokens, recordCall, recordHit } from "./aiTelemetry";
import { aiAuthHeaders, throwIfPaywalled } from "./aiAuth";

/**
 * Resumo IA de um bundle de notícias (um tópico) — passa pelo /api/ai como
 * qualquer outra chamada, sob o SYSTEM PROMPT padrão da Pra (cadeias de
 * transmissão + arbitragem). Cache 2h em localStorage por signature do bundle.
 */

const AI_API_URL = "/api/ai";
const CACHE_KEY_PREFIX = "praxia-news-summary:";
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 horas (alinhado com o refresh do servidor)

export interface ResumoNoticiasIA {
  /** 2-3 frases em pt-BR com citações [1], [2]... no texto. */
  resumo: string;
  /** Como esse conjunto de notícias afeta preço de ativos / arbitragem. */
  impactoArbitragem: string;
  /**
   * Lista de pares "TICKER ou SETOR → direção". Ex.:
   * [{ alvo: "PETR4", direcao: "ganha" }, { alvo: "Aéreas", direcao: "perde" }]
   */
  alvos: { alvo: string; direcao: "ganha" | "perde" | "neutro"; motivo: string }[];
  /** URLs efetivamente citadas no texto. */
  fontes: string[];
}

interface CacheEntry {
  savedAt: number;
  signature: string;
  payload: ResumoNoticiasIA;
}

function signatureFor(bundle: WorldNewsTopicBundle): string {
  // Mais leve do que hashear todas as URLs — primeiros 5 títulos bastam pra
  // detectar mudança de manchete (que é quando a IA deve refazer o resumo).
  return bundle.items
    .slice(0, 5)
    .map((n) => n.titulo)
    .join("|");
}

function readCache(topic: string, sig: string): ResumoNoticiasIA | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + topic);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (entry.signature !== sig) return null;
    if (Date.now() - entry.savedAt > CACHE_TTL_MS) return null;
    return entry.payload;
  } catch {
    return null;
  }
}

function writeCache(topic: string, sig: string, payload: ResumoNoticiasIA) {
  try {
    const entry: CacheEntry = { savedAt: Date.now(), signature: sig, payload };
    localStorage.setItem(CACHE_KEY_PREFIX + topic, JSON.stringify(entry));
  } catch {
    /* quota cheia: ignora */
  }
}

export function getCachedResumoNoticias(bundle: WorldNewsTopicBundle): ResumoNoticiasIA | null {
  return readCache(bundle.topic, signatureFor(bundle));
}

export async function resumirNoticiasComIA(
  bundle: WorldNewsTopicBundle,
  profile: InvestorProfile | null = null
): Promise<ResumoNoticiasIA> {
  const sig = signatureFor(bundle);
  const cached = readCache(bundle.topic, sig);
  if (cached) {
    recordHit("news_topic");
    return cached;
  }

  // Rate-limit guard preventivo.
  const gate = checkRateLimit();
  if (!gate.allowed) {
    const seconds = Math.ceil(gate.retryAfterMs / 1000);
    throw new Error(`Limite de chamadas IA atingido. Aguarde ~${seconds}s.`);
  }

  if (bundle.items.length === 0) {
    return {
      resumo: "Sem manchetes recentes neste tópico.",
      impactoArbitragem: bundle.arbitrageAngle,
      alvos: [],
      fontes: [],
    };
  }

  // Lista numerada de manchetes para a IA citar como [1], [2]...
  const manchetes = bundle.items
    .slice(0, 8)
    .map(
      (n, i) =>
        `[${i + 1}] ${n.titulo}${n.fonte ? ` — ${n.fonte}` : ""}${
          n.publicado ? ` (${n.publicado})` : ""
        }\n     ${n.link}`
    )
    .join("\n");

  const profilePt =
    profile?.risk === "low"
      ? "conservador"
      : profile?.risk === "high"
      ? "arrojado"
      : profile
      ? "moderado"
      : "ainda não definido";

  const userPrompt = `MODO DE OUTPUT: JSON estruturado.

TOPICO: ${bundle.topic.toUpperCase()} — ${bundle.description}
ANGULO DE ARBITRAGEM JA MAPEADO PELO SERVIDOR: ${bundle.arbitrageAngle}

PERFIL DO USUARIO: ${profilePt}

MANCHETES (use [n] para citar; cada link DEVE entrar em "fontes" se citado):
${manchetes}

Aplique o reasoning_chain do system prompt e devolva ESTE JSON:
{
  "resumo": "2-3 frases em pt-BR comecando com 'Pelo seu perfil [risco]...', com [1], [2]... fazendo match com as manchetes",
  "impactoArbitragem": "1-2 frases explicando como essas noticias mexem com preco de ativos / setores especificos da B3 (use as transmission_chains)",
  "alvos": [
    { "alvo": "TICKER ou SETOR", "direcao": "ganha" | "perde" | "neutro", "motivo": "frase curta com cadeia aplicada" }
  ],
  "fontes": ["URL 1", "URL 2", "..."]
}

Use no maximo 5 alvos. ${JSON_ONLY_SUFFIX}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  let response: Response;
  try {
    response = await fetch(AI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...aiAuthHeaders() },
      body: JSON.stringify({
        messages: [
          { role: "system", content: PRAXIA_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 900,
        response_format: { type: "json_object" },
        feature: "classify-news",
      }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("IA demorou demais (timeout 30s). Tente novamente.");
    }
    throw e;
  }
  clearTimeout(timeoutId);

  await throwIfPaywalled(response, "classify-news");

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Erro IA (${response.status})`);
  }

  const data = await response.json();
  let raw = String(data.content ?? "").trim();
  if (raw.startsWith("```json")) raw = raw.slice(7);
  if (raw.startsWith("```")) raw = raw.slice(3);
  if (raw.endsWith("```")) raw = raw.slice(0, -3);
  raw = raw.trim();

  const parsed = JSON.parse(raw) as ResumoNoticiasIA;
  // Defesas mínimas: garante arrays
  if (!Array.isArray(parsed.alvos)) parsed.alvos = [];
  if (!Array.isArray(parsed.fontes)) parsed.fontes = [];

  // Telemetria.
  recordCall(
    "news_topic",
    estimateTokens(PRAXIA_SYSTEM_PROMPT) + estimateTokens(userPrompt),
    estimateTokens(raw)
  );

  writeCache(bundle.topic, sig, parsed);
  return parsed;
}

export function clearAllNewsSummaryCache() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_KEY_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}
