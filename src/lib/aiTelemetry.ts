/**
 * Telemetria leve de chamadas LLM no Praxia. Roda 100% client-side em
 * localStorage — sem dependencia externa. Objetivos:
 *
 *   1. Contar chamadas LLM por capacidade (chat, analise, insights, ...) pra
 *      validar empiricamente que as otimizacoes das Fases A-E reduziram custo.
 *   2. Detectar HIT vs MISS de cache pra avaliar qualidade da signature.
 *   3. Estimar tokens (heuristica: chars / 4) pra dar ideia de gasto sem precisar
 *      de billing real.
 *   4. Rate-limit guard preventivo — Groq free tier permite ~10 req/min; se ja
 *      fizemos 8 nos ultimos 60s, recusamos antes de bater no 429.
 */

const STATS_KEY = "praxia-llm-stats";
const RECENT_KEY = "praxia-llm-recent-calls"; // timestamps das ultimas N chamadas
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT_THRESHOLD = 8; // por janela de 60s (folga ate o limite real de 10)

export type AICapability =
  | "chat"
  | "analise"
  | "insights"
  | "comparacao"
  | "news_topic"
  | "news_feed";

export interface CapabilityStats {
  calls: number;
  hits: number;
  misses: number;
  estTokensIn: number;
  estTokensOut: number;
  lastCallAt: number | null;
}

export interface TelemetryStats {
  byCapability: Record<AICapability, CapabilityStats>;
  totalCalls: number;
  totalHits: number;
  totalEstTokens: number;
  since: number; // timestamp da primeira chamada registrada
}

function emptyCapStats(): CapabilityStats {
  return {
    calls: 0,
    hits: 0,
    misses: 0,
    estTokensIn: 0,
    estTokensOut: 0,
    lastCallAt: null,
  };
}

function emptyStats(): TelemetryStats {
  return {
    byCapability: {
      chat: emptyCapStats(),
      analise: emptyCapStats(),
      insights: emptyCapStats(),
      comparacao: emptyCapStats(),
      news_topic: emptyCapStats(),
      news_feed: emptyCapStats(),
    },
    totalCalls: 0,
    totalHits: 0,
    totalEstTokens: 0,
    since: Date.now(),
  };
}

function readStats(): TelemetryStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return emptyStats();
    const parsed = JSON.parse(raw) as TelemetryStats;
    // Defesa contra schema antigo
    if (!parsed.byCapability || !parsed.byCapability.chat) return emptyStats();
    return parsed;
  } catch {
    return emptyStats();
  }
}

function writeStats(stats: TelemetryStats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    /* quota cheia: ignora */
  }
}

/** Estimativa rasa: ~4 chars por token. Suficiente pra ordens de grandeza. */
export function estimateTokens(text: string | null | undefined): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/** Registra HIT de cache — nao houve chamada LLM. */
export function recordHit(capability: AICapability) {
  const stats = readStats();
  stats.byCapability[capability].hits += 1;
  stats.totalHits += 1;
  writeStats(stats);
}

/** Registra MISS + chamada LLM efetuada. tokens sao estimativas. */
export function recordCall(
  capability: AICapability,
  estTokensIn: number,
  estTokensOut: number
) {
  const stats = readStats();
  const cap = stats.byCapability[capability];
  cap.calls += 1;
  cap.misses += 1;
  cap.estTokensIn += estTokensIn;
  cap.estTokensOut += estTokensOut;
  cap.lastCallAt = Date.now();
  stats.totalCalls += 1;
  stats.totalEstTokens += estTokensIn + estTokensOut;
  writeStats(stats);

  // Atualiza timestamps recentes pra rate-limit guard.
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? (JSON.parse(raw) as number[]) : [];
    const now = Date.now();
    const filtered = arr.filter((t) => now - t < RATE_WINDOW_MS);
    filtered.push(now);
    localStorage.setItem(RECENT_KEY, JSON.stringify(filtered.slice(-20)));
  } catch {
    /* ignora */
  }
}

export function getStats(): TelemetryStats {
  return readStats();
}

export function clearStats() {
  try {
    localStorage.removeItem(STATS_KEY);
    localStorage.removeItem(RECENT_KEY);
  } catch {
    /* ignora */
  }
}

/**
 * Verifica se podemos fazer uma nova chamada LLM agora ou se o rate-limit
 * preventivo barra. Retorna {allowed: false, retryAfterMs} quando precisa esperar.
 */
export function checkRateLimit(): { allowed: boolean; retryAfterMs: number } {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return { allowed: true, retryAfterMs: 0 };
    const arr = JSON.parse(raw) as number[];
    const now = Date.now();
    const recent = arr.filter((t) => now - t < RATE_WINDOW_MS);
    if (recent.length < RATE_LIMIT_THRESHOLD) {
      return { allowed: true, retryAfterMs: 0 };
    }
    const oldest = Math.min(...recent);
    const retryAfterMs = Math.max(0, RATE_WINDOW_MS - (now - oldest));
    return { allowed: false, retryAfterMs };
  } catch {
    return { allowed: true, retryAfterMs: 0 };
  }
}

/* ─── Cache clear granular ────────────────────────────────────────────── */

const CACHE_KEY_BY_KIND: Record<string, (key: string) => boolean> = {
  analise: (k) => k.startsWith("stocks-ai-analysis:"),
  insights: (k) => k === "stocks-ai-portfolio-insights",
  comparacao: (k) => k.startsWith("praxia-compare:"),
  news_feed: (k) => k.startsWith("praxia-news-feed-analysis:"),
  news_topic: (k) => k.startsWith("praxia-news-summary:"),
  market_context: (k) => k === "praxia-market-context",
  fundamentals: (k) => k.startsWith("praxia-fundamentals:"),
  stock_news: (k) => k.startsWith("praxia-stock-news:"),
};

export type CacheKind = keyof typeof CACHE_KEY_BY_KIND | "all";

export function clearCacheByKind(kind: CacheKind): number {
  let removed = 0;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (kind === "all") {
        // Sweep generico: todas as keys que comecam com prefixos da IA.
        if (
          key.startsWith("stocks-ai-") ||
          key.startsWith("praxia-compare:") ||
          key.startsWith("praxia-news-") ||
          key.startsWith("praxia-fundamentals:") ||
          key.startsWith("praxia-stock-news:") ||
          key === "praxia-market-context"
        ) {
          toRemove.push(key);
        }
      } else if (CACHE_KEY_BY_KIND[kind]?.(key)) {
        toRemove.push(key);
      }
    }
    for (const k of toRemove) {
      localStorage.removeItem(k);
      removed += 1;
    }
  } catch {
    /* ignora */
  }
  return removed;
}
