import { coletarDadosRI, type DadosRI } from "./scraping";
import type { InvestorProfile } from "@/types/stock";

const AI_API_URL = "/api/ai";

export interface AIInsight {
  titulo: string;
  tipo: "alta" | "baixa" | "neutro" | "alerta";
  confianca: "alta" | "media" | "baixa";
  categoria: string;
  descricao: string;
  ticker?: string;
  /**
   * Citações usadas pelo insight. Cada item é uma URL ou um rótulo curto
   * ("cálculo do app", "BrAPI", "Yahoo Finance"). Insight sem fontes
   * NÃO deve ser exibido — UI deve filtrar.
   */
  fontes: string[];
}

export interface AIResponse {
  insights: AIInsight[];
  resumo: string;
  sentimento: "otimista" | "pessimista" | "neutro";
  /** Fontes globais usadas pelo resumo / sentimento. */
  fontes: string[];
}

/** Resultado estruturado da analise da IA por acao. */
export interface AnaliseIA {
  resumoTrimestral: string;
  recomendacao: "COMPRAR" | "SEGURAR" | "VENDER";
  justificativa: string;
  redFlags: string[];
  comparacaoTrimestre: string;
  periodoAnalisado: string;
  /** Fonte de RI quando disponível (preenchida no servidor). */
  fonte: string;
  /** Citações exigidas pelo prompt — URL ou rótulo curto. */
  fontes: string[];
}

/**
 * Resumo amigável do perfil do investidor usado pelos prompts para
 * garantir que toda recomendação seja ancorada no perfil do usuário.
 */
function describeProfile(profile: InvestorProfile | null | undefined): string {
  if (!profile) {
    return "PERFIL: ainda nao definido. Nao da recomendacao especifica sem antes orientar o usuario a completar o perfil ou explicar a hipotese.";
  }
  const risk =
    profile.risk === "low" ? "conservador" : profile.risk === "high" ? "arrojado" : "moderado";
  const horizon =
    profile.horizon === "short" ? "curto (ate 1 ano)" : profile.horizon === "long" ? "longo (5+ anos)" : "medio (1-5 anos)";
  const interestMap: Record<string, string> = {
    div: "dividendos",
    gro: "crescimento",
    esg: "ESG",
    tec: "tecnologia",
  };
  const interests = (profile.interests ?? []).map((i) => interestMap[i] ?? i).join(", ");
  return `PERFIL DO USUARIO: risco ${risk}; horizonte ${horizon}; interesses: ${interests || "nao informado"}.`;
}

/** Bloco de regras compartilhado por TODOS os prompts. */
const SOURCE_AND_PROFILE_RULES = `
REGRAS OBRIGATORIAS (NUNCA QUEBRE):
1. PERFIL: TODA recomendacao ou opiniao DEVE comecar referenciando o perfil do usuario. Exemplo: "Pelo seu perfil moderado, ...". Sem perfil definido, recuse dar recomendacao especifica.
2. FONTES: Para CADA afirmacao fatual (preco, multiplo, noticia, resultado financeiro, evento) inclua a fonte no campo "fontes". Aceitavel:
   - URL completa (ex.: "https://www.b3.com.br/...", "https://ri.petrobras.com.br/..."),
   - "BrAPI" para preco/fundamento atual,
   - "Yahoo Finance" para historico/cotacao,
   - "calculo do app" para valores derivados (Graham, score, margem de seguranca),
   - "perfil do usuario" para informacao do quiz.
3. Se nao tiver fonte verificavel, escreva no texto "nao tenho fonte verificavel para isso" e NAO afirme o fato.
4. Numere o texto com [1], [2]... fazendo match com a ordem do array "fontes".
`;

/** Dados quantitativos da acao usados como insumo para a analise. */
export interface DadosQuantitativos {
  cotacao: number;
  precoTeto: number;
  margemSeguranca: number;
  score: number;
  pl: number;
  pvp: number;
  roe: number;
  dividendYield: number;
  debtToEbitda: number;
  netMargin: number;
}

interface PortfolioData {
  ticker: string;
  preco: number;
  variacao: number;
  variacaoPercent: number;
  lpa: number;
  vpa: number;
  roe: number;
  dividendYield: number;
  pl: number;
  pvp: number;
  debtToEbitda: number;
  margemLiquida: number;
  score: number;
}

function buildPortfolioPrompt(
  stocks: PortfolioData[],
  profile: InvestorProfile | null | undefined
): string {
  const stocksData = stocks
    .map(
      (s) =>
        `- ${s.ticker}: Preco R$${s.preco.toFixed(2)}, Variacao ${s.variacaoPercent >= 0 ? "+" : ""}${s.variacaoPercent.toFixed(2)}%, ` +
        `LPA ${s.lpa.toFixed(2)}, VPA ${s.vpa.toFixed(2)}, ROE ${(s.roe * 100).toFixed(1)}%, ` +
        `DY ${(s.dividendYield * 100).toFixed(1)}%, P/L ${s.pl.toFixed(1)}, P/VP ${s.pvp.toFixed(2)}, ` +
        `Div/EBITDA ${s.debtToEbitda.toFixed(1)}x, Margem Liq ${(s.margemLiquida * 100).toFixed(1)}%, Score ${s.score}/100`
    )
    .join("\n");

  return `Voce e Pra, analista financeira da Praxia especializada em B3 e mercados internacionais.
Analise o portfolio do usuario e gere insights acionaveis.

${describeProfile(profile)}

PORTFOLIO DO INVESTIDOR (dados via BrAPI / Yahoo Finance):
${stocksData}

${SOURCE_AND_PROFILE_RULES}

INSTRUCOES DE SAIDA:
1. Responda EXCLUSIVAMENTE em formato JSON valido, sem markdown, sem blocos de codigo.
2. Schema exato:
{
  "resumo": "Frase curta com o sentimento geral, abrindo com 'Pelo seu perfil [risco]...' [1]",
  "sentimento": "otimista" | "pessimista" | "neutro",
  "fontes": ["BrAPI", "calculo do app", "https://...", ...],
  "insights": [
    {
      "titulo": "Titulo curto",
      "tipo": "alta" | "baixa" | "neutro" | "alerta",
      "confianca": "alta" | "media" | "baixa",
      "categoria": "Tendencia" | "Valuation" | "Fundamentos" | "Risco" | "Dividendos" | "Momentum" | "Volatilidade",
      "descricao": "Descricao 2-3 frases, sempre ancorada no perfil. Inclua referencias [1], [2]...",
      "ticker": "TICKER ou null se for insight geral",
      "fontes": ["BrAPI", "https://...", "calculo do app"]
    }
  ]
}

REGRAS DE ANALISE:
- Gere entre 4 e 8 insights relevantes ALINHADOS ao perfil do usuario.
- Analise tendencias, valuation, saude financeira, rentabilidade e dividendos sempre considerando risco/horizonte do perfil.
- Use linguagem profissional em portugues do Brasil.
- TODO insight DEVE ter fontes nao vazias. Se nao consegue citar, NAO emita o insight.
- Responda SOMENTE com o JSON, nada mais.`;
}

export function toPortfolioData(stock: {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  lpa: number;
  vpa: number;
  roe: number;
  dividendYield: number;
  pl: number;
  pvp: number;
  debtToEbitda: number;
  netMargin: number;
  score: number;
}): PortfolioData {
  return {
    ticker: stock.ticker,
    preco: stock.price,
    variacao: stock.change,
    variacaoPercent: stock.changePercent,
    lpa: stock.lpa,
    vpa: stock.vpa,
    roe: stock.roe,
    dividendYield: stock.dividendYield,
    pl: stock.pl,
    pvp: stock.pvp,
    debtToEbitda: stock.debtToEbitda,
    margemLiquida: stock.netMargin,
    score: stock.score,
  };
}

export async function fetchAIInsights(
  stocks: PortfolioData[],
  profile: InvestorProfile | null = null
): Promise<AIResponse> {
  if (stocks.length === 0) {
    throw new Error("Nenhum ativo no portfolio para analisar.");
  }

  const prompt = buildPortfolioPrompt(stocks, profile);
  const result = await callAIServerless<AIResponse>(prompt, "json_object");

  // Defesa: garante o array de fontes nos insights, mesmo que o modelo esqueça.
  if (!Array.isArray(result.fontes)) result.fontes = [];
  if (Array.isArray(result.insights)) {
    result.insights = result.insights.map((i) => ({
      ...i,
      fontes: Array.isArray(i.fontes) ? i.fontes : [],
    }));
  } else {
    result.insights = [];
  }
  return result;
}

export async function analisarAcaoComIA(
  ticker: string,
  nomeEmpresa: string,
  dados: DadosQuantitativos,
  profile: InvestorProfile | null = null
): Promise<AnaliseIA> {
  const dadosRI: DadosRI = await coletarDadosRI(ticker);

  const prompt = `Voce e Pra, analista fundamentalista da Praxia especializada em B3.
Analise a acao ${ticker} (${nomeEmpresa}).

${describeProfile(profile)}

${
  dadosRI.conteudo
    ? `=== DADOS COLETADOS DE RI (${dadosRI.fonte}) ===
${dadosRI.conteudo}
=== FIM ===`
    : `=== DADOS DE RI ===
Sem dados de RI no momento. Baseie a analise nos numeros abaixo + conhecimento publico.
=== FIM ===`
}

=== METRICAS CALCULADAS PELO APP (fonte: "calculo do app") ===
Cotacao atual: R$ ${dados.cotacao.toFixed(2)} (BrAPI)
Preco Teto (Graham): R$ ${dados.precoTeto.toFixed(2)}
Margem de Seguranca: ${(dados.margemSeguranca * 100).toFixed(1)}%
Score fundamentalista: ${dados.score}/100
P/L: ${dados.pl > 0 ? dados.pl.toFixed(1) : "N/D"}
P/VP: ${dados.pvp > 0 ? dados.pvp.toFixed(2) : "N/D"}
ROE: ${(dados.roe * 100).toFixed(1)}%
Dividend Yield: ${(dados.dividendYield * 100).toFixed(1)}%
Divida/EBITDA: ${dados.debtToEbitda.toFixed(1)}x
Margem Liquida: ${(dados.netMargin * 100).toFixed(1)}%
=== FIM ===

${SOURCE_AND_PROFILE_RULES}

Retorne SOMENTE um JSON valido, sem markdown:
{
  "resumoTrimestral": "Resumo do ultimo trimestre em 2-3 frases com referencias [1], [2]...",
  "recomendacao": "COMPRAR" | "SEGURAR" | "VENDER",
  "justificativa": "Comece com 'Pelo seu perfil [risco]...'. 2-3 frases com referencias.",
  "redFlags": ["alerta com [n] referenciando fonte"],
  "comparacaoTrimestre": "Comparacao com trimestre anterior em 1-2 frases com referencias",
  "periodoAnalisado": "ex: 3T24 vs 2T24",
  "fontes": ["BrAPI", "calculo do app", "${dadosRI.fonte || "ri.empresa.com.br"}", "Yahoo Finance", "https://..."]
}

Responda em portugues brasileiro e NUNCA use emojis. Se faltar fonte para algo, escreva "sem fonte verificavel" e nao afirme o fato.`;

  const analise = await callAIServerless<AnaliseIA>(prompt, "json_object");
  analise.fonte = dadosRI.fonte || "";

  const recsValidas = ["COMPRAR", "SEGURAR", "VENDER"];
  if (!recsValidas.includes(analise.recomendacao)) {
    analise.recomendacao = "SEGURAR";
  }
  if (!Array.isArray(analise.redFlags)) {
    analise.redFlags = [];
  }
  if (!Array.isArray(analise.fontes)) {
    analise.fontes = dadosRI.fonte ? [dadosRI.fonte, "BrAPI", "calculo do app"] : ["BrAPI", "calculo do app"];
  }

  return analise;
}

async function callAIServerless<T>(prompt: string, responseFormat: string = "text"): Promise<T> {
  const response = await fetch(AI_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        {
          role: "system",
          content:
            "Voce e um analista financeiro profissional. Responda APENAS com JSON valido, sem nenhum texto adicional, sem markdown, sem blocos de codigo.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2048,
      response_format: { type: responseFormat },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Erro na API de IA (${response.status})`);
  }

  const data = await response.json();
  const textContent = data.content;

  if (!textContent) {
    throw new Error("Resposta vazia da IA.");
  }

  let cleanJson = String(textContent).trim();
  if (cleanJson.startsWith("```json")) cleanJson = cleanJson.slice(7);
  if (cleanJson.startsWith("```")) cleanJson = cleanJson.slice(3);
  if (cleanJson.endsWith("```")) cleanJson = cleanJson.slice(0, -3);
  cleanJson = cleanJson.trim();

  try {
    return JSON.parse(cleanJson) as T;
  } catch {
    console.error("Erro ao fazer parse da resposta IA:", textContent);
    throw new Error("Erro ao interpretar resposta da IA. Tente novamente.");
  }
}
