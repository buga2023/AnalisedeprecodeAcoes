import type { InvestorProfile } from "@/types/stock";
import type { NewsItem } from "./context";
import { fetchTickerNews } from "./context";
import { PRAXIA_SYSTEM_PROMPT, JSON_ONLY_SUFFIX } from "./praxiaPrompt";

/**
 * Notícias por ação + sentimento e impacto, classificadas pela IA em batch.
 * Reusa /api/news?ticker=X e segue o SYSTEM PROMPT mestre + SOURCE_AND_PROFILE_RULES.
 * Cache 1h em localStorage por ticker (invalidado quando a 1ª manchete muda).
 */

const AI_API_URL = "/api/ai";
const CACHE_KEY_PREFIX = "praxia-stock-news:";
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_ITEMS = 6;

export type StockNewsSentiment = "positivo" | "neutro" | "negativo";

export interface StockNewsClassifiedItem {
  /** Match com NewsItem original — IA preserva titulo/link literalmente. */
  titulo: string;
  link: string;
  fonte: string;
  publicado: string;
  sentimento: StockNewsSentiment;
  /** Marcado quando a notícia muda a tese da ação (fato relevante, M&A, guidance forte). */
  material: boolean;
  /** 1 frase curta sobre o impacto para o ticker, ancorada no perfil. */
  impacto: string;
}

export interface StockNewsAnalysis {
  ticker: string;
  /** Resumo 2 frases do conjunto, começando com "Pelo seu perfil X...". */
  resumo: string;
  /** Saldo agregado das notícias para o ticker. */
  sentimentoGeral: StockNewsSentiment;
  itens: StockNewsClassifiedItem[];
  /** True se ≥1 item.material === true. Usado pelo banner de Surpresa do ScreenHome. */
  hasMaterial: boolean;
  /** Pelo menos 1 URL citada. */
  fontes: string[];
  /** Timestamp da geração — para mostrar "há 12min". */
  generatedAt: number;
}

interface CacheEntry {
  signature: string;
  payload: StockNewsAnalysis;
}

function signatureFor(items: NewsItem[]): string {
  return items
    .slice(0, 5)
    .map((n) => n.titulo)
    .join("|");
}

function readCache(ticker: string, sig: string): StockNewsAnalysis | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + ticker);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (entry.signature !== sig) return null;
    if (Date.now() - entry.payload.generatedAt > CACHE_TTL_MS) return null;
    return entry.payload;
  } catch {
    return null;
  }
}

function writeCache(ticker: string, sig: string, payload: StockNewsAnalysis) {
  try {
    const entry: CacheEntry = { signature: sig, payload };
    localStorage.setItem(CACHE_KEY_PREFIX + ticker, JSON.stringify(entry));
  } catch {
    /* quota cheia */
  }
}

/** Lê o cache atual sem chamar IA — usado pelo banner de evento material no Home. */
export function getCachedStockNews(ticker: string): StockNewsAnalysis | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + ticker);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.payload.generatedAt > CACHE_TTL_MS) return null;
    return entry.payload;
  } catch {
    return null;
  }
}

function profileWord(profile: InvestorProfile | null): string {
  if (!profile) return "ainda nao definido";
  if (profile.risk === "low") return "conservador";
  if (profile.risk === "high") return "arrojado";
  return "moderado";
}

function emptyAnalysis(ticker: string, profile: InvestorProfile | null): StockNewsAnalysis {
  return {
    ticker,
    resumo: profile
      ? `Pelo seu perfil ${profileWord(profile)}, ${ticker} nao tem manchetes recentes relevantes — sem mudanca na tese.`
      : `Sem manchetes recentes para ${ticker}.`,
    sentimentoGeral: "neutro",
    itens: [],
    hasMaterial: false,
    fontes: [],
    generatedAt: Date.now(),
  };
}

/**
 * Classifica manchetes do ticker pela IA. Faz 1 chamada com até MAX_ITEMS.
 * Sempre devolve `StockNewsAnalysis` (mesmo vazio) — UI decide o que mostrar.
 */
export async function analisarNoticiasAcao(
  ticker: string,
  profile: InvestorProfile | null = null
): Promise<StockNewsAnalysis> {
  const upper = ticker.toUpperCase();
  const bundle = await fetchTickerNews(upper, MAX_ITEMS);
  const items = bundle.items.slice(0, MAX_ITEMS);

  if (items.length === 0) return emptyAnalysis(upper, profile);

  const sig = signatureFor(items);
  const cached = readCache(upper, sig);
  if (cached) return cached;

  const manchetes = items
    .map(
      (n, i) =>
        `[${i + 1}] ${n.titulo}${n.fonte ? ` — ${n.fonte}` : ""}${
          n.publicado ? ` (${n.publicado})` : ""
        }\n     ${n.link}`
    )
    .join("\n");

  const userPrompt = `MODO DE OUTPUT: JSON estruturado.

TICKER: ${upper}
PERFIL DO USUARIO: ${profileWord(profile)}

MANCHETES RECENTES (use [n] no resumo e cite os links em "fontes"):
${manchetes}

Classifique CADA manchete e devolva ESTE JSON:
{
  "resumo": "2 frases pt-BR comecando com 'Pelo seu perfil [risco], ...' explicando o saldo das noticias para ${upper}, com [1], [2]... fazendo match com a ordem das manchetes",
  "sentimentoGeral": "positivo" | "neutro" | "negativo",
  "itens": [
    {
      "indice": 1,
      "sentimento": "positivo" | "neutro" | "negativo",
      "material": true | false,
      "impacto": "1 frase curta dizendo como essa noticia mexe com a tese de ${upper} no perfil ${profileWord(profile)} (use cadeia de transmissao do system prompt)"
    }
    // ... um por manchete na MESMA ORDEM
  ],
  "fontes": ["URL [1]", "URL [2]", "..."]
}

REGRAS:
- "material" = true APENAS para fato relevante, M&A, follow-on, mudanca de guidance, novo CEO, processo regulatorio grave ou queda forte (>5%). Manchete genérica de mercado = false.
- "sentimento" do item = como a noticia afeta o PRECO do ticker, nao sentimento da redacao.
- "fontes" deve conter os links das manchetes que voce citou no resumo.
- Use no maximo ${MAX_ITEMS} itens — um por manchete fornecida.
- ${JSON_ONLY_SUFFIX}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  let response: Response;
  try {
    response = await fetch(AI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: PRAXIA_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1200,
        response_format: { type: "json_object" },
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

  type RawItem = {
    indice?: number;
    sentimento?: string;
    material?: boolean;
    impacto?: string;
  };
  interface RawParsed {
    resumo?: string;
    sentimentoGeral?: string;
    itens?: RawItem[];
    fontes?: string[];
  }
  const parsed = JSON.parse(raw) as RawParsed;

  const normSentiment = (s: string | undefined): StockNewsSentiment => {
    if (s === "positivo" || s === "negativo") return s;
    return "neutro";
  };

  const rawItens: RawItem[] = Array.isArray(parsed.itens) ? parsed.itens : [];
  const classified: StockNewsClassifiedItem[] = items.map((n, i) => {
    const match = rawItens.find((it) => Number(it.indice) === i + 1) ?? rawItens[i];
    return {
      titulo: n.titulo,
      link: n.link,
      fonte: n.fonte,
      publicado: n.publicado,
      sentimento: normSentiment(match?.sentimento),
      material: match?.material === true,
      impacto: typeof match?.impacto === "string" ? match.impacto : "",
    };
  });

  const fontes = Array.isArray(parsed.fontes)
    ? parsed.fontes.filter((s) => typeof s === "string" && s.length > 0)
    : [];
  // Garante que cada link das manchetes citadas com [n] esteja em fontes.
  const cited = new Set(fontes);
  for (let i = 0; i < classified.length; i++) {
    const tag = `[${i + 1}]`;
    if (parsed.resumo && parsed.resumo.includes(tag) && classified[i].link) {
      cited.add(classified[i].link);
    }
  }

  const analysis: StockNewsAnalysis = {
    ticker: upper,
    resumo: typeof parsed.resumo === "string" ? parsed.resumo : "",
    sentimentoGeral: normSentiment(parsed.sentimentoGeral),
    itens: classified,
    hasMaterial: classified.some((it) => it.material),
    fontes: Array.from(cited),
    generatedAt: Date.now(),
  };

  writeCache(upper, sig, analysis);
  return analysis;
}

export function clearStockNewsCache(ticker?: string) {
  try {
    if (ticker) {
      localStorage.removeItem(CACHE_KEY_PREFIX + ticker.toUpperCase());
      return;
    }
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_KEY_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}
