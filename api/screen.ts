import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors } from "./_cors";
import { checkRateLimit } from "./_ratelimit";
import { callLLM, defaultProvider } from "./_llm";

interface ScreenerFilters {
  minROE: number | null;
  maxPL: number | null;
  minDY: number | null;
  maxDebtToEbitda: number | null;
  sectors: string[] | null;
  sortBy: "score" | "dy" | "roe" | "pl";
}

interface ScreenerResponse {
  filters: ScreenerFilters;
  suggestedTickers: string[];
  label: string;
  rationale: string;
}

// Cache em memória por instância Vercel — 30min por query.
const SCREEN_CACHE = new Map<string, { data: ScreenerResponse; expiresAt: number }>();

const SYSTEM_PROMPT = `Você é um assistente especializado em triagem de ações brasileiras (B3). Analise a consulta e retorne APENAS JSON válido, sem markdown nem texto fora do JSON.

Formato obrigatório:
{
  "filters": {
    "minROE": <null ou número em % ex: 15>,
    "maxPL": <null ou número ex: 12>,
    "minDY": <null ou número em % ex: 6>,
    "maxDebtToEbitda": <null ou número ex: 3>,
    "sectors": <null ou array de strings de: ["Energia","Financeiro","Mineração","Industrial","Saúde","Consumo","Tecnologia","Telecom","Logística","Saneamento","Varejo","Petróleo","Bancário"]>,
    "sortBy": <"score" | "dy" | "roe" | "pl">
  },
  "suggestedTickers": <array de 10-14 tickers B3 que provavelmente atendem os critérios, ex: ["PETR4","VALE3","TAEE11"]>,
  "label": <descrição compacta dos filtros em PT-BR, ex: "DY > 6% · ROE > 15%">,
  "rationale": <1 frase em PT-BR explicando a lógica dos critérios>
}

Regras:
- Use apenas tickers B3 reais (formato: 4 letras + 1-2 dígitos, ex: PETR4, WEGE3, TAEE11).
- Priorize empresas de capital aberto com boa liquidez.
- Se a consulta menciona dividendos: inclua TAEE11, CMIG4, EGIE3, BBAS3, CPLE6.
- Se menciona crescimento/tech: inclua WEGE3, TOTS3, INTB3, RDOR3.
- Se menciona saúde: inclua RADL3, RDOR3, HAPV3.
- Se menciona bancário/financeiro: inclua ITUB4, BBDC4, BBAS3, SANB11.
- Se menciona petróleo/energia: inclua PETR4, PRIO3, RRRP3, CSAN3.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res, "POST, OPTIONS")) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const rate = checkRateLimit(req, { windowMs: 60_000, max: 8, burstMax: 3, burstWindowMs: 5_000 });
  if (!rate.allowed) {
    res.setHeader("Retry-After", String(rate.retryAfterSec));
    return res.status(429).json({ error: "rate-limited", retryAfterSec: rate.retryAfterSec });
  }

  const body = req.body as { query?: unknown; profile?: unknown };
  const query = typeof body.query === "string" ? body.query.trim() : "";

  if (!query || query.length < 3 || query.length > 500) {
    return res.status(400).json({ error: "Consulta inválida (3–500 caracteres)." });
  }

  const profileObj = body.profile && typeof body.profile === "object" ? (body.profile as Record<string, string>) : null;
  const profileSummary = profileObj
    ? `Perfil: risco=${profileObj.risk ?? "—"}, horizonte=${profileObj.horizon ?? "—"}`
    : "Perfil não informado";

  const cacheKey = `${query.toLowerCase()}|${profileSummary}`;
  const cached = SCREEN_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return res.status(200).json(cached.data);
  }

  try {
    const provider = defaultProvider();
    const result = await callLLM({
      provider,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Consulta: "${query}"\n${profileSummary}\n\nRetorne o JSON de triagem.` },
      ],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    let parsed: ScreenerResponse;
    try {
      parsed = JSON.parse(result.content) as ScreenerResponse;
    } catch {
      console.error("[api/screen] JSON parse failed:", result.content.slice(0, 200));
      return res.status(502).json({ error: "Resposta IA inválida — tente novamente." });
    }

    // Sanitizar tickers: só B3 no formato correto.
    const TICKER_RE = /^[A-Z]{4}\d{1,2}$/;
    if (Array.isArray(parsed.suggestedTickers)) {
      parsed.suggestedTickers = parsed.suggestedTickers
        .filter((t) => typeof t === "string" && TICKER_RE.test(t))
        .slice(0, 14);
    } else {
      parsed.suggestedTickers = [];
    }

    SCREEN_CACHE.set(cacheKey, { data: parsed, expiresAt: Date.now() + 30 * 60_000 });
    return res.status(200).json(parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 120) : "Erro desconhecido";
    console.error("[api/screen]", msg);
    return res.status(503).json({ error: msg });
  }
}
