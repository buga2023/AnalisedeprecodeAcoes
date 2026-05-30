/**
 * Digest semanal IA — gera resumo de 1 página da semana ANTERIOR usando
 * APENAS dados reais agregados em `assembleDigestContext`.
 *
 * Replica `callAIServerless` localmente (mesmo padrão de `aiDividends.ts`)
 * para isolar a feature de outras edições em `lib/ai.ts`.
 *
 * Regra dura: o LLM NÃO pode inventar eventos. Se um campo do contexto está
 * vazio, ele omite a frase correspondente. Tudo que aparece no digest sai
 * direto do `DigestContext`.
 */

import type {
  DigestContext,
  DigestProximaAcao,
  InvestorProfile,
  WeeklyDigest,
} from "@/types/stock";
import { PRAXIA_SYSTEM_PROMPT } from "./praxiaPrompt";
import { digestContextToPromptJson } from "./digest";
import { aiAuthHeaders, throwIfPaywalled } from "./aiAuth";

const AI_API_URL = "/api/ai";

const VALID_TARGETS: NonNullable<DigestProximaAcao["screenAlvo"]>[] = [
  "dividends",
  "analysis",
  "market",
  "alerts",
  "news",
  "home",
];

function describeProfileForDigest(profile: InvestorProfile | null): string {
  if (!profile) {
    return "PERFIL: nao definido. Comece o resumo pedindo para o usuario completar o quiz antes de aceitar recomendacoes.";
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
  return `PERFIL: risco ${risk}; horizonte ${horizon}; interesses: ${interests || "nao informado"}.`;
}

export async function gerarDigestSemanal(
  context: DigestContext,
  profile: InvestorProfile | null
): Promise<WeeklyDigest> {
  const prompt = `Voce e Pra, analista da Praxia. Gere um DIGEST SEMANAL de UMA PAGINA
sobre a carteira do usuario na semana ${context.isoWeek}. Use APENAS o JSON abaixo
como fonte de verdade. Se um campo esta vazio, NAO mencione esse tipo de evento.

${describeProfileForDigest(profile)}

=== CONTEXTO DA SEMANA (real, agregado pelo app) ===
${digestContextToPromptJson(context)}
=== FIM ===

REGRAS INEGOCIAVEIS:
- O resumo DEVE comecar com "Pelo seu perfil [risco], ...".
- NAO INVENTE eventos, tickers, numeros. Se "dividendosRecebidos" esta vazio,
  nao diga "voce recebeu dividendos". Se "alertasDisparados" esta vazio, nao
  diga "alguns alertas foram acionados".
- Numericos devem refletir EXATAMENTE os valores do JSON (use no maximo 2
  casas decimais). Quando "variacaoSemanaPct" e null, diga "sem snapshot de
  inicio de semana disponivel".
- "destaque" e UMA FRASE sobre o evento mais relevante (topMover, dividendo
  forte, alerta disparado ou noticia material).
- "eventosNotaveis" 2-4 itens; cada um com titulo curto + detalhe 1 frase.
- "proximasAcoes" 2-3 itens; "screenAlvo" deve ser EXATAMENTE um destes:
  ${VALID_TARGETS.join(" | ")}. Se a acao nao mapeia bem para uma tela, omita
  o campo "screenAlvo".
- "fontes" deve listar rotulos curtos das origens reais: "Yahoo Finance"
  (precos), "useTransactions" (ordens), "useAlerts" (alertas),
  "useStockNews" (noticias materiais), "calculo do app", "perfil do usuario".

Retorne SOMENTE JSON valido:
{
  "resumo": "Pelo seu perfil [risco], ... 2-3 frases",
  "destaque": "1 frase",
  "eventosNotaveis": [
    { "titulo": "Curto", "detalhe": "1 frase ancorada nos dados do JSON" }
  ],
  "proximasAcoes": [
    { "acao": "Texto curto", "motivo": "1 frase", "screenAlvo": "dividends" }
  ],
  "fontes": ["Yahoo Finance", "calculo do app", "perfil do usuario"]
}

Responda em portugues brasileiro, sem emojis, sem markdown.`;

  const raw = await callAIForDigest(prompt);
  return normalize(raw, context);
}

async function callAIForDigest(prompt: string): Promise<unknown> {
  const response = await fetch(AI_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...aiAuthHeaders() },
    body: JSON.stringify({
      messages: [
        { role: "system", content: PRAXIA_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 1100,
      response_format: { type: "json_object" },
      feature: "digest",
    }),
  });

  await throwIfPaywalled(response, "digest");

  if (!response.ok) {
    const errorData: { error?: string } = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Erro na API de IA (${response.status})`);
  }

  const data = (await response.json()) as { content?: string };
  const text = data?.content;
  if (!text) throw new Error("Resposta vazia da IA.");

  let cleanJson = String(text).trim();
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

function normalize(raw: unknown, ctx: DigestContext): WeeklyDigest {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const resumo = typeof obj.resumo === "string" ? obj.resumo : "";
  const destaque = typeof obj.destaque === "string" ? obj.destaque : "";
  const eventosRaw = Array.isArray(obj.eventosNotaveis) ? obj.eventosNotaveis : [];
  const acoesRaw = Array.isArray(obj.proximasAcoes) ? obj.proximasAcoes : [];
  const fontes = Array.isArray(obj.fontes)
    ? obj.fontes.filter((f): f is string => typeof f === "string")
    : [];

  const eventos = eventosRaw
    .map((e) => {
      const it = (e && typeof e === "object" ? e : {}) as Record<string, unknown>;
      return {
        titulo: typeof it.titulo === "string" ? it.titulo : "",
        detalhe: typeof it.detalhe === "string" ? it.detalhe : "",
      };
    })
    .filter((e) => e.titulo && e.detalhe);

  const acoes: DigestProximaAcao[] = acoesRaw
    .map((a) => {
      const it = (a && typeof a === "object" ? a : {}) as Record<string, unknown>;
      const target = it.screenAlvo;
      const screenAlvo: DigestProximaAcao["screenAlvo"] | undefined =
        typeof target === "string" &&
        VALID_TARGETS.includes(target as NonNullable<DigestProximaAcao["screenAlvo"]>)
          ? (target as DigestProximaAcao["screenAlvo"])
          : undefined;
      return {
        acao: typeof it.acao === "string" ? it.acao : "",
        motivo: typeof it.motivo === "string" ? it.motivo : "",
        screenAlvo,
      };
    })
    .filter((a) => a.acao);

  // Defesa: se nao veio nenhuma fonte mas temos dados, injeta as obvias.
  if (fontes.length === 0) {
    fontes.push("Yahoo Finance", "calculo do app");
    if (ctx.alertasDisparados.length > 0) fontes.push("useAlerts");
    if (ctx.transacoesDaSemana.length > 0) fontes.push("useTransactions");
    if (ctx.noticiasMateriais.length > 0) fontes.push("useStockNews");
  }

  return {
    isoWeek: ctx.isoWeek,
    resumo,
    destaque,
    eventosNotaveis: eventos,
    proximasAcoes: acoes,
    fontes,
    generatedAt: Date.now(),
  };
}
