import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * /api/fundamentals?ticker=PETR4
 *
 * Quando o Yahoo bloqueia / retorna vazio o quoteSummary, este endpoint usa
 * o LLM configurado (Groq/OpenAI/etc — mesma chain do /api/ai) para PESQUISAR
 * fundamentos e o último resultado trimestral. SEMPRE marca cada valor como
 * "estimado por IA" + retorna a referência (data do último relatório que o
 * modelo conhece + se gerou alguma projeção).
 *
 * Não é fonte primária — é um fallback que evita "tudo zerado". A UI deve
 * mostrar o badge "IA" e a data de referência ao lado dos valores.
 */

interface AIFundamentalValue {
  /** Valor estimado, ou null se a IA não conseguir uma estimativa razoável. */
  value: number | null;
  /** Unidade — "ratio" (multiplicador), "pct" (fração 0–1), "brl" (R$), "usd" (US$). */
  unit: "ratio" | "pct" | "brl" | "usd" | "shares";
  /** Confiança da IA: "alta" (último relatório oficial), "media" (consenso recente), "baixa" (estimativa). */
  confianca: "alta" | "media" | "baixa";
  /** Referência: data e fonte. */
  referencia: string;
}

interface QuarterlyEstimate {
  periodo: string;
  receita: number | null;
  lucroLiquido: number | null;
  ebitda: number | null;
  margem: number | null;
  comentario: string;
  /** "real" = relatório já publicado; "projecao" = projeção da IA. */
  tipo: "real" | "projecao";
  referencia: string;
}

interface FundamentalsResponse {
  ticker: string;
  empresa: string;
  geradoEm: string;
  /** TRUE quando a resposta inteira veio da IA (não foi merge com dados reais). */
  estimadoPorIA: true;
  /** Lista de fontes que a IA mencionou (URLs, RI, B3, CVM). */
  fontes: string[];
  /** Aviso explícito para a UI mostrar. */
  aviso: string;
  fundamentais: {
    precoAtual?: AIFundamentalValue;
    pl?: AIFundamentalValue;
    pvp?: AIFundamentalValue;
    dividendYield?: AIFundamentalValue;
    roe?: AIFundamentalValue;
    roic?: AIFundamentalValue;
    debtToEbitda?: AIFundamentalValue;
    netMargin?: AIFundamentalValue;
    lpa?: AIFundamentalValue;
    vpa?: AIFundamentalValue;
    precoTetoGraham?: AIFundamentalValue;
    margemSeguranca?: AIFundamentalValue;
  };
  /** Último trimestre real (se possível) + projeção do próximo. */
  trimestres: QuarterlyEstimate[];
}

async function callAI(prompt: string, max_tokens = 1800): Promise<string> {
  const provider = (process.env.AI_PROVIDER || "groq") as string;
  const envMap: Record<string, string | undefined> = {
    groq: process.env.GROQ_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
  };
  const key = envMap[provider];
  if (!key) throw new Error(`IA não configurada (${provider.toUpperCase()}_API_KEY ausente)`);

  // Usa o mesmo handler interno chamando diretamente o upstream Groq por padrão
  if (provider === "groq") {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "Voce e analista fundamentalista. Responda APENAS com JSON valido, sem markdown.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
        max_tokens,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`AI upstream ${res.status}: ${errBody.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  }

  // Fallback para OpenAI
  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "Voce e analista fundamentalista. Responda APENAS com JSON valido, sem markdown.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
        max_tokens,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  }

  throw new Error(`Provider ${provider} ainda não suportado no fallback de fundamentals`);
}

function buildPrompt(ticker: string, currentPrice?: number): string {
  const priceLine =
    currentPrice && currentPrice > 0
      ? `Preço atual conhecido (Yahoo): R$ ${currentPrice.toFixed(2)}. Use isto para calcular P/L, P/VP, margem de segurança.`
      : "Preço atual: desconhecido — estime com base no último fechamento que você conhece.";

  return `Tarefa: pesquisar fundamentos atuais e o ultimo resultado trimestral da acao ${ticker}.

${priceLine}

Use SEMPRE o dado mais atualizado que voce conhece. Se nao tiver dado real para um campo, gere uma estimativa baseada nos ultimos numeros publicados + tendencia setorial. NUNCA invente: quando estimar, marque confianca como "baixa" e explique na referencia.

Para CADA campo, retorne:
- value: numero (ou null se nao houver base razoavel)
- unit: "ratio" (P/L, P/VP, Div/EBITDA), "pct" (DY, ROE, ROIC, Margem), "brl" (LPA, VPA, Preco Teto), "shares"
- confianca: "alta" (ultimo relatorio oficial), "media" (consenso recente), "baixa" (sua estimativa)
- referencia: texto curto descrevendo a base do numero (ex.: "Release 3T24 PETR4 publicado em 31/10/2024" ou "estimativa baseada em ROE historico medio 18%")

Adicionalmente, retorne os ULTIMOS DOIS TRIMESTRES que voce conhece (tipo: "real") + uma PROJECAO do proximo trimestre (tipo: "projecao") com comentario explicando.

UNITS:
- pl, pvp, debtToEbitda → unit "ratio"
- dividendYield, roe, roic, netMargin, margemSeguranca → unit "pct" (FRACAO: 0.12 = 12%)
- precoAtual, lpa, vpa, precoTetoGraham → unit "brl"

Schema JSON exato (sem markdown):
{
  "ticker": "${ticker}",
  "empresa": "Nome curto da empresa",
  "fontes": ["URL do RI / B3 / release", "consenso de analistas"],
  "aviso": "Frase explicando que estes valores foram estimados/recuperados por IA e podem estar desatualizados",
  "fundamentais": {
    "precoAtual":      { "value": 0.0, "unit": "brl",   "confianca": "alta", "referencia": "..." },
    "pl":              { "value": 0.0, "unit": "ratio", "confianca": "alta", "referencia": "..." },
    "pvp":             { "value": 0.0, "unit": "ratio", "confianca": "alta", "referencia": "..." },
    "dividendYield":   { "value": 0.0, "unit": "pct",   "confianca": "alta", "referencia": "..." },
    "roe":             { "value": 0.0, "unit": "pct",   "confianca": "alta", "referencia": "..." },
    "roic":            { "value": 0.0, "unit": "pct",   "confianca": "media","referencia": "..." },
    "debtToEbitda":    { "value": 0.0, "unit": "ratio", "confianca": "alta", "referencia": "..." },
    "netMargin":       { "value": 0.0, "unit": "pct",   "confianca": "alta", "referencia": "..." },
    "lpa":             { "value": 0.0, "unit": "brl",   "confianca": "alta", "referencia": "..." },
    "vpa":             { "value": 0.0, "unit": "brl",   "confianca": "alta", "referencia": "..." },
    "precoTetoGraham": { "value": 0.0, "unit": "brl",   "confianca": "media","referencia": "calculo sqrt(22.5 * LPA * VPA)" },
    "margemSeguranca": { "value": 0.0, "unit": "pct",   "confianca": "media","referencia": "(precoTeto - precoAtual) / precoTeto" }
  },
  "trimestres": [
    {
      "periodo": "3T24",
      "receita": 120000000000.0,
      "lucroLiquido": 18000000000.0,
      "ebitda": 50000000000.0,
      "margem": 0.15,
      "comentario": "Breve resumo do que aconteceu",
      "tipo": "real",
      "referencia": "Release oficial PETR4 publicado em DD/MM/AAAA"
    },
    {
      "periodo": "2T24",
      "receita": 0.0,
      "lucroLiquido": 0.0,
      "ebitda": 0.0,
      "margem": 0.0,
      "comentario": "...",
      "tipo": "real",
      "referencia": "..."
    },
    {
      "periodo": "4T24 (projetado)",
      "receita": 0.0,
      "lucroLiquido": 0.0,
      "ebitda": 0.0,
      "margem": 0.0,
      "comentario": "Projecao da IA baseada em tendencia setorial e ultimos resultados",
      "tipo": "projecao",
      "referencia": "Projecao IA — nao oficial"
    }
  ]
}

Responda APENAS o JSON, em portugues brasileiro, sem markdown, sem comentarios.`;
}

function cleanJson(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```json")) s = s.slice(7);
  if (s.startsWith("```")) s = s.slice(3);
  if (s.endsWith("```")) s = s.slice(0, -3);
  return s.trim();
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Content-Type", "application/json");

  if (request.method === "OPTIONS") return response.status(204).end();

  try {
    const ticker = String(request.query.ticker || "").toUpperCase().trim();
    const currentPrice = Number(request.query.price) || undefined;

    if (!ticker) {
      return response.status(400).json({ error: "Forneça ?ticker=XXXX" });
    }

    const prompt = buildPrompt(ticker, currentPrice);
    const raw = await callAI(prompt);
    const text = cleanJson(raw);

    let parsed: Omit<FundamentalsResponse, "geradoEm" | "estimadoPorIA">;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error("[api/fundamentals] JSON inválido da IA:", text.slice(0, 400));
      return response.status(502).json({
        error: "IA retornou JSON inválido",
        rawSnippet: text.slice(0, 200),
      });
    }

    const payload: FundamentalsResponse = {
      ...parsed,
      geradoEm: new Date().toISOString(),
      estimadoPorIA: true,
      aviso:
        parsed.aviso ||
        "Estes valores foram recuperados / estimados pela IA. Confira sempre na fonte oficial antes de decidir.",
      fontes: Array.isArray(parsed.fontes) ? parsed.fontes : [],
      trimestres: Array.isArray(parsed.trimestres) ? parsed.trimestres : [],
    };

    return response.status(200).json(payload);
  } catch (error) {
    console.error("[api/fundamentals] erro:", error);
    return response.status(500).json({
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
}
