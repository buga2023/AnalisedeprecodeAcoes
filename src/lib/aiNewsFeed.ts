import type { InvestorProfile, Stock } from "@/types/stock";
import type { WorldNewsItem } from "./context";
import {
  PRAXIA_SYSTEM_PROMPT,
  JSON_ONLY_SUFFIX,
  buildContextReceivedTag,
  describeProfileLine,
  describePortfolioLine,
} from "./praxiaPrompt";
import { checkRateLimit, estimateTokens, recordCall, recordHit } from "./aiTelemetry";
import { aiAuthHeaders, throwIfPaywalled } from "./aiAuth";

/**
 * Análise IA POR NOTÍCIA INDIVIDUAL — cruza a manchete com a carteira do
 * usuário para responder "como ISSO me afeta". Diferente de `aiNews.ts` que
 * resume tópicos inteiros, esta função foca em UMA notícia + tickers que o
 * usuário REALMENTE tem.
 *
 * Cache 24h em localStorage por (URL + signature da carteira). Quando a
 * carteira muda, análises antigas continuam válidas pra mesma URL — só
 * recalcula se o usuário pedir refresh manual.
 */

const AI_API_URL = "/api/ai";
const CACHE_KEY_PREFIX = "praxia-news-feed-analysis:";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface TickerImpact {
  ticker: string;
  direcao: "ganha" | "perde" | "neutro";
  /** 1 = leve, 2 = relevante, 3 = forte. Usado pra ordenar e colorir chips. */
  intensidade: 1 | 2 | 3;
  motivo: string;
  /** Se o ticker está na carteira do usuário (passado pelo cliente). */
  emCarteira: boolean;
}

export interface AnaliseNoticiaIA {
  /** 2-3 frases começando por "Pelo seu perfil X..." quando há perfil. */
  tese: string;
  /** Lista priorizada — primeiro os que estão em carteira, depois sugestões. */
  tickersImpactados: TickerImpact[];
  /** "Considere reduzir/aumentar/segurar X, criar alerta em Y..." ou "Sem ação imediata recomendada." */
  acaoSugerida: string;
  /** Categoria pra filtro: guerra, queda-acoes, ma, macro, setor, outro. */
  categoria: "guerra" | "queda-acoes" | "ma-corporativo" | "macro" | "setor" | "outro";
  /** URLs/rótulos efetivamente citados na tese. */
  fontes: string[];
}

interface CacheEntry {
  savedAt: number;
  signature: string;
  payload: AnaliseNoticiaIA;
}

/** Signature da carteira: tickers ordenados pra ser estável. */
function portfolioSignature(stocks: Stock[]): string {
  return stocks
    .map((s) => s.ticker.toUpperCase())
    .sort()
    .join(",");
}

type NewsCategoria = AnaliseNoticiaIA["categoria"];

/**
 * Classifica categoria da noticia por keyword no titulo — barato e
 * deterministico. Quando bate, dispensamos a IA de decidir, economizando
 * tokens de output. Retorna null quando incerto -> deixa pra IA.
 */
function classifyCategoriaByTitle(titulo: string): NewsCategoria | null {
  const t = titulo.toLowerCase();
  // Ordem importa: padroes mais especificos primeiro.
  if (/\b(guerra|conflito|missil|ataque|invasao|cessar[- ]fogo|bombardei)/i.test(t)) {
    return "guerra";
  }
  if (/\b(aquisic|aquisi[cç]|oferta|fus[aã]o|m&a|takeover|recompra|follow[- ]on|spin[- ]off)\b/i.test(t)) {
    return "ma-corporativo";
  }
  if (/\b(despenc|tomba|cai\s+\d|queda\s+forte|circuit\s+breaker|tomba\s+em\s+b)/i.test(t)) {
    return "queda-acoes";
  }
  if (/\b(selic|copom|ipca|cdi|ibc-br|igp-m|inflac|fed|juros|banco central|bcb)\b/i.test(t)) {
    return "macro";
  }
  return null;
}

/**
 * Hash composto djb2 + FNV-1a — 64 bits efetivos, sync, sem dep. Probabilidade
 * de colisao para ~1000 URLs de noticias e desprezivel (~1 em 10^15). Solucao
 * pragmatica pra evitar cascata async via crypto.subtle.digest.
 */
function cacheKeyFor(url: string): string {
  let djb2 = 5381;
  let fnv = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    const c = url.charCodeAt(i);
    djb2 = ((djb2 << 5) + djb2 + c) | 0;
    fnv = (fnv ^ c) >>> 0;
    fnv = (fnv + ((fnv << 1) + (fnv << 4) + (fnv << 7) + (fnv << 8) + (fnv << 24))) >>> 0;
  }
  const hi = (djb2 >>> 0).toString(36).padStart(7, "0");
  const lo = fnv.toString(36).padStart(7, "0");
  return `${CACHE_KEY_PREFIX}${hi}${lo}`;
}

function readCache(url: string, sig: string): AnaliseNoticiaIA | null {
  try {
    const raw = localStorage.getItem(cacheKeyFor(url));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (entry.signature !== sig) return null;
    if (Date.now() - entry.savedAt > CACHE_TTL_MS) return null;
    return entry.payload;
  } catch {
    return null;
  }
}

function writeCache(url: string, sig: string, payload: AnaliseNoticiaIA) {
  try {
    const entry: CacheEntry = { savedAt: Date.now(), signature: sig, payload };
    localStorage.setItem(cacheKeyFor(url), JSON.stringify(entry));
  } catch {
    /* quota cheia: ignora */
  }
}

export function getCachedAnaliseNoticia(
  item: WorldNewsItem,
  stocks: Stock[]
): AnaliseNoticiaIA | null {
  return readCache(item.link, portfolioSignature(stocks));
}

/**
 * Pede à IA uma análise da notícia DIRECIONADA à carteira do usuário.
 * Resposta é JSON estruturado (response_format quando suportado).
 */
export async function analisarNoticiaParaCarteira(
  item: WorldNewsItem,
  profile: InvestorProfile | null,
  stocks: Stock[],
  topicLabel?: string
): Promise<AnaliseNoticiaIA> {
  const sig = portfolioSignature(stocks);
  const cached = readCache(item.link, sig);
  if (cached) {
    recordHit("news_feed");
    return cached;
  }

  // Rate-limit guard preventivo.
  const gate = checkRateLimit();
  if (!gate.allowed) {
    const seconds = Math.ceil(gate.retryAfterMs / 1000);
    throw new Error(`Limite de chamadas IA atingido. Aguarde ~${seconds}s.`);
  }

  // Classifier deterministico: se conseguir, omite o campo do schema da IA.
  const categoriaPreClassificada = classifyCategoriaByTitle(item.titulo);
  const categoriaField = categoriaPreClassificada
    ? "" // omitido — preenchido determinsticamente depois
    : `\n  "categoria": "guerra" | "queda-acoes" | "ma-corporativo" | "macro" | "setor" | "outro",`;

  const userPrompt = `MODO DE OUTPUT: JSON estruturado (analise por noticia individual).
${buildContextReceivedTag({
  carteira: stocks.length > 0,
  perfil: !!profile,
  noticiasGlobais: true,
})}
NOTICIA PARA ANALISAR:
  Manchete: ${item.titulo}
  Fonte:    ${item.fonte || "(nao informada)"}
  URL:      ${item.link}
  Publicado: ${item.publicado || "(sem data)"}
${item.tom !== undefined ? `  Tom GDELT: ${item.tom.toFixed(2)} (escala -1..1)\n` : ""}${topicLabel ? `  Topico atribuido pelo agregador: ${topicLabel}\n` : ""}
${describeProfileLine(profile)}

${describePortfolioLine(stocks)}

Aplique o reasoning_chain do system prompt (passos 1-6) e as transmission_chains relevantes. Devolva ESTE JSON:
{
  "tese": "2-3 frases em pt-BR comecando por 'Pelo seu perfil [risco], ...'",
  "tickersImpactados": [
    {
      "ticker": "PETR4",
      "direcao": "ganha" | "perde" | "neutro",
      "intensidade": 1 | 2 | 3,
      "motivo": "frase curta com a cadeia de transmissao aplicada",
      "emCarteira": true | false
    }
  ],
  "acaoSugerida": "uma frase concreta coerente com o perfil — ou 'Sem acao imediata recomendada.'",${categoriaField}
  "fontes": ["${item.link}", "Yahoo Finance", "..."]
}

REGRAS ESPECIFICAS DESTA TASK:
- Use no maximo 5 tickers no array. Tickers da CARTEIRA tem prioridade (emCarteira: true).
- Sugestoes fora da carteira: maximo 2, emCarteira: false.
- INTENSIDADE: 1=leve (impacto indireto), 2=relevante (impacto setorial direto), 3=forte (impacto direto na empresa).
- Para perfil conservador, prefira acoes como "criar alerta" ou "sem acao imediata".
- O array "fontes" DEVE incluir a URL da noticia analisada.

${JSON_ONLY_SUFFIX}`;

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

  // Telemetria: registra a chamada (system + user prompts in; resposta out).
  recordCall(
    "news_feed",
    estimateTokens(PRAXIA_SYSTEM_PROMPT) + estimateTokens(userPrompt),
    estimateTokens(raw)
  );

  const parsed = JSON.parse(raw) as Partial<AnaliseNoticiaIA>;

  // Defesas mínimas — IA pode quebrar contrato
  const normalized: AnaliseNoticiaIA = {
    tese: typeof parsed.tese === "string" ? parsed.tese : "Análise indisponível.",
    tickersImpactados: Array.isArray(parsed.tickersImpactados)
      ? parsed.tickersImpactados
          .filter((t): t is TickerImpact => !!t && typeof t.ticker === "string")
          .map((t) => ({
            ticker: t.ticker.toUpperCase(),
            direcao:
              t.direcao === "ganha" || t.direcao === "perde" || t.direcao === "neutro"
                ? t.direcao
                : "neutro",
            intensidade:
              t.intensidade === 1 || t.intensidade === 2 || t.intensidade === 3 ? t.intensidade : 1,
            motivo: typeof t.motivo === "string" ? t.motivo : "",
            emCarteira: !!t.emCarteira,
          }))
          .slice(0, 5)
      : [],
    acaoSugerida:
      typeof parsed.acaoSugerida === "string"
        ? parsed.acaoSugerida
        : "Sem ação imediata recomendada.",
    categoria:
      // Classifier deterministico vence — se classificou, evitou ate gastar
      // tokens no schema da IA acima.
      categoriaPreClassificada ??
      (parsed.categoria === "guerra" ||
      parsed.categoria === "queda-acoes" ||
      parsed.categoria === "ma-corporativo" ||
      parsed.categoria === "macro" ||
      parsed.categoria === "setor"
        ? parsed.categoria
        : "outro"),
    fontes: Array.isArray(parsed.fontes) ? parsed.fontes.filter((f) => typeof f === "string") : [],
  };

  // Garantia: o link da notícia analisada deve estar nas fontes
  if (!normalized.fontes.includes(item.link)) normalized.fontes.unshift(item.link);

  // Reforço de "emCarteira" — fonte da verdade é a carteira passada, não a IA
  const carteiraSet = new Set(stocks.map((s) => s.ticker.toUpperCase()));
  normalized.tickersImpactados = normalized.tickersImpactados
    .map((t) => ({ ...t, emCarteira: carteiraSet.has(t.ticker) }))
    .sort((a, b) => {
      // Em carteira vem primeiro, depois maior intensidade
      if (a.emCarteira !== b.emCarteira) return a.emCarteira ? -1 : 1;
      return b.intensidade - a.intensidade;
    });

  writeCache(item.link, sig, normalized);
  return normalized;
}

export function clearAllNewsFeedAnalysisCache() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_KEY_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}
