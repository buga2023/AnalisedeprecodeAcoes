/**
 * Otimização de dividendos via IA — sugere realocação no portfólio para subir
 * o DY médio sem perder qualidade do score fundamentalista do usuário.
 *
 * NOTA DE DESIGN: este arquivo replica `callAIServerless` localmente em vez de
 * importar de `src/lib/ai.ts` propositalmente. `lib/ai.ts` é editado por
 * múltiplos fluxos (Pra chat, insights, comparação, análise per-stock); manter
 * a chamada de IA da Fase 3 isolada aqui reduz risco de conflito com outras
 * features em desenvolvimento paralelo. O custo é ~30 linhas duplicadas,
 * aceitável dado o ganho de paralelismo.
 *
 * Toda chamada respeita `SOURCE_AND_PROFILE_RULES`:
 *  - resposta começa "Pelo seu perfil ..."
 *  - cada sugestão carrega `fontes: string[]`
 */

import type { InvestorProfile, Stock } from "@/types/stock";
import type { MonthBucket } from "./dividends";
import { PRAXIA_SYSTEM_PROMPT } from "./praxiaPrompt";

const AI_API_URL = "/api/ai";

export interface DividendActionSuggestion {
  /** Ticker alvo da sugestão (mantém formato uppercase do `Stock.ticker`). */
  ticker: string;
  /** "manter" | "aumentar" | "reduzir" | "adicionar" — guideline curta. */
  acao: "manter" | "aumentar" | "reduzir" | "adicionar";
  /** Tese de 1-2 frases conectando a sugestão ao perfil + dados. */
  tese: string;
  /** Impacto estimado em renda passiva (texto livre, ex.: "+R$ 120/mês"). */
  impactoEstimado: string;
  /** Citações exigidas pelo prompt — URL ou rótulo curto. */
  fontes: string[];
}

export interface DividendOptimization {
  /** Resumo da estratégia — DEVE começar com "Pelo seu perfil ...". */
  resumo: string;
  /** Sugestões acionáveis, ordenadas por relevância pelo modelo. */
  sugestoes: DividendActionSuggestion[];
  /** Fontes globais usadas pelo resumo (independentes das fontes por sugestão). */
  fontes: string[];
}

/** Subset do `Stock` que o otimizador precisa — desacopla do tipo cheio. */
export type DividendStockInput = Pick<
  Stock,
  "ticker" | "quantity" | "price" | "dividendYield" | "score" | "sector"
>;

/* ─── helpers de prompt ──────────────────────────────────────────────────── */

function describeProfileForDividends(profile: InvestorProfile | null | undefined): string {
  if (!profile) {
    return "PERFIL: ainda nao definido. Comece a resposta orientando o usuario a completar o quiz de perfil antes de aceitar sugestoes de realocacao.";
  }
  const risk =
    profile.risk === "low" ? "conservador" : profile.risk === "high" ? "arrojado" : "moderado";
  const horizon =
    profile.horizon === "short"
      ? "curto (ate 1 ano)"
      : profile.horizon === "long"
      ? "longo (5+ anos)"
      : "medio (1-5 anos)";
  const interestMap: Record<string, string> = {
    div: "dividendos",
    gro: "crescimento",
    esg: "ESG",
    tec: "tecnologia",
  };
  const interests = (profile.interests ?? []).map((i) => interestMap[i] ?? i).join(", ");
  return `PERFIL DO USUARIO: risco ${risk}; horizonte ${horizon}; interesses: ${interests || "nao informado"}.`;
}

function buildPortfolioBlock(stocks: DividendStockInput[]): string {
  return stocks
    .filter((s) => s.quantity > 0)
    .map(
      (s) =>
        `- ${s.ticker}: ${s.quantity} cotas a R$${(s.price ?? 0).toFixed(2)}, ` +
        `DY ${((s.dividendYield ?? 0)).toFixed(2)}%, Score ${s.score}/100` +
        (s.sector ? `, setor ${s.sector}` : "")
    )
    .join("\n");
}

function buildBucketsBlock(buckets: MonthBucket[]): string {
  const total = buckets.reduce((acc, b) => acc + b.amount, 0);
  const avg = total / Math.max(1, buckets.length);
  const months = buckets.map((b) => `  ${b.month}: R$${b.amount.toFixed(2)}`).join("\n");
  return `PROJECAO 12 MESES (total R$${total.toFixed(2)}, media mensal R$${avg.toFixed(2)}):
${months}`;
}

/* ─── função pública ─────────────────────────────────────────────────────── */

export async function otimizarDividendos(
  stocks: DividendStockInput[],
  buckets: MonthBucket[],
  profile: InvestorProfile | null
): Promise<DividendOptimization> {
  const eligible = stocks.filter((s) => s.quantity > 0);
  if (eligible.length === 0) {
    throw new Error("Adicione ações com posição na carteira para receber sugestões.");
  }

  const prompt = `Voce e Pra, analista da Praxia especializada em B3 e renda passiva.
Sugira realocacoes pontuais no portfolio do usuario para subir o DY medio SEM cair
abaixo de score 60 nas posicoes existentes. Priorize empresas com historico consistente
de pagamento (cadencia regular).

${describeProfileForDividends(profile)}

CARTEIRA ATUAL (dados via BrAPI / Yahoo Finance + calculo do app):
${buildPortfolioBlock(eligible)}

${buildBucketsBlock(buckets)}

REGRAS INEGOCIAVEIS:
1. O resumo DEVE comecar com "Pelo seu perfil ...".
2. Cada sugestao precisa de pelo menos uma fonte (URL ou rotulo: "calculo do app",
   "BrAPI", "Yahoo Finance", "perfil do usuario"). Sem fonte, nao afirme o fato.
3. Use APENAS tickers que ja existem na carteira ou que sejam B3 reconhecidos
   (PETR4, ITSA4, BBAS3, ITUB4, BBDC4, TAEE11, FIIs XX11). Nao invente.
4. Acoes possiveis: "manter" | "aumentar" | "reduzir" | "adicionar".

Retorne SOMENTE um JSON valido, sem markdown:
{
  "resumo": "Pelo seu perfil [risco], ... 2-3 frases com referencias [1], [2]...",
  "fontes": ["BrAPI", "calculo do app", "perfil do usuario"],
  "sugestoes": [
    {
      "ticker": "PETR4",
      "acao": "manter",
      "tese": "Tese curta conectando dados ao perfil, com referencias [n]",
      "impactoEstimado": "+R$ XX/mes (estimativa pela cadencia historica)",
      "fontes": ["BrAPI", "calculo do app"]
    }
  ]
}

Responda em portugues brasileiro, sem emojis. Maximo 5 sugestoes, priorizadas por impacto.`;

  const result = await callAIForDividends(prompt);
  return normalizeResult(result);
}

/* ─── chamada HTTP isolada ───────────────────────────────────────────────── */

async function callAIForDividends(prompt: string): Promise<unknown> {
  const response = await fetch(AI_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        { role: "system", content: PRAXIA_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorData: { error?: string } = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Erro na API de IA (${response.status})`);
  }

  const data = (await response.json()) as { content?: string };
  const textContent = data?.content;
  if (!textContent) {
    throw new Error("Resposta vazia da IA.");
  }

  let cleanJson = String(textContent).trim();
  if (cleanJson.startsWith("```json")) cleanJson = cleanJson.slice(7);
  if (cleanJson.startsWith("```")) cleanJson = cleanJson.slice(3);
  if (cleanJson.endsWith("```")) cleanJson = cleanJson.slice(0, -3);
  cleanJson = cleanJson.trim();

  try {
    return JSON.parse(cleanJson);
  } catch {
    throw new Error("Erro ao interpretar resposta da IA. Tente novamente.");
  }
}

/* ─── normalização defensiva ─────────────────────────────────────────────── */

function normalizeResult(raw: unknown): DividendOptimization {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const resumo = typeof obj.resumo === "string" ? obj.resumo : "";
  const fontes = Array.isArray(obj.fontes) ? obj.fontes.filter((f) => typeof f === "string") : [];
  const sugestoesRaw = Array.isArray(obj.sugestoes) ? obj.sugestoes : [];

  const sugestoes: DividendActionSuggestion[] = sugestoesRaw
    .map((item) => {
      const it = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      const acao = it.acao;
      const validAcoes: DividendActionSuggestion["acao"][] = [
        "manter",
        "aumentar",
        "reduzir",
        "adicionar",
      ];
      const acaoFinal: DividendActionSuggestion["acao"] = validAcoes.includes(
        acao as DividendActionSuggestion["acao"]
      )
        ? (acao as DividendActionSuggestion["acao"])
        : "manter";
      return {
        ticker: typeof it.ticker === "string" ? it.ticker.toUpperCase() : "",
        acao: acaoFinal,
        tese: typeof it.tese === "string" ? it.tese : "",
        impactoEstimado: typeof it.impactoEstimado === "string" ? it.impactoEstimado : "",
        fontes: Array.isArray(it.fontes)
          ? it.fontes.filter((f): f is string => typeof f === "string")
          : [],
      };
    })
    .filter((s) => s.ticker && s.tese);

  return { resumo, fontes, sugestoes };
}
