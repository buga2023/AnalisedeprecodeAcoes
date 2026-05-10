import type { AIProviderConfig } from '@/types/stock';
import { coletarDadosRI, type DadosRI } from "./scraping";

const AI_API_URL = "/api/ai";

export interface AIInsight {
    titulo: string;
    tipo: "alta" | "baixa" | "neutro" | "alerta";
    confianca: "alta" | "media" | "baixa";
    categoria: string;
    descricao: string;
    ticker?: string;
}

export interface AIResponse {
    insights: AIInsight[];
    resumo: string;
    sentimento: "otimista" | "pessimista" | "neutro";
}

/** Resultado estruturado da analise da IA por acao */
export interface AnaliseIA {
  resumoTrimestral: string;
  recomendacao: "COMPRAR" | "SEGURAR" | "VENDER";
  justificativa: string;
  redFlags: string[];
  comparacaoTrimestre: string;
  periodoAnalisado: string;
  fonte: string;
}

/** Dados quantitativos da acao */
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

function buildPrompt(stocks: PortfolioData[]): string {
    const stocksData = stocks
        .map(
            (s) =>
                `- ${s.ticker}: Preco R$${s.preco.toFixed(2)}, Variacao ${s.variacaoPercent >= 0 ? "+" : ""}${s.variacaoPercent.toFixed(2)}%, ` +
                `LPA ${s.lpa.toFixed(2)}, VPA ${s.vpa.toFixed(2)}, ROE ${(s.roe * 100).toFixed(1)}%, ` +
                `DY ${(s.dividendYield * 100).toFixed(1)}%, P/L ${s.pl.toFixed(1)}, P/VP ${s.pvp.toFixed(2)}, ` +
                `Div/EBITDA ${s.debtToEbitda.toFixed(1)}x, Margem Liq ${(s.margemLiquida * 100).toFixed(1)}%, Score ${s.score}/100`
        )
        .join("\n");

    return `Voce e um analista financeiro profissional especializado no mercado brasileiro (B3) e internacional.
Analise o portfolio abaixo e gere insights acionaveis e detalhados.

PORTFOLIO DO INVESTIDOR:
${stocksData}

INSTRUCOES:
1. Responda EXCLUSIVAMENTE em formato JSON valido, sem markdown, sem blocos de codigo, apenas o JSON puro.
2. Use o seguinte schema exato:
{
  "resumo": "Frase curta resumindo o sentimento geral do portfolio",
  "sentimento": "otimista" | "pessimista" | "neutro",
  "insights": [
    {
      "titulo": "Titulo curto e direto do insight",
      "tipo": "alta" | "baixa" | "neutro" | "alerta",
      "confianca": "alta" | "media" | "baixa",
      "categoria": "Tendencia" | "Valuation" | "Fundamentos" | "Risco" | "Dividendos" | "Momentum" | "Volatilidade",
      "descricao": "Descricao detalhada com analise fundamentalista e recomendacao pratica (2-3 frases)",
      "ticker": "TICKER ou null se for insight geral"
    }
  ]
}

REGRAS DE ANALISE:
- Gere entre 4 e 8 insights relevantes
- Analise tendencias de preco, valuation, saude financeira, rentabilidade, e dividendos.
- Identifique oportunidades e riscos claros.
- Use linguagem profissional em portugues do Brasil.
- Responda SOMENTE com o JSON, nada mais.`;
}

export async function fetchAIInsights(config: AIProviderConfig, stocks: PortfolioData[]): Promise<AIResponse> {
    if (stocks.length === 0) {
        throw new Error("Nenhum ativo no portfolio para analisar.");
    }

    const prompt = buildPrompt(stocks);
    return callAIServerless(config, prompt, "json_object");
}

export async function analisarAcaoComIA(config: AIProviderConfig, ticker: string, nomeEmpresa: string, dados: DadosQuantitativos): Promise<AnaliseIA> {
  const dadosRI: DadosRI = await coletarDadosRI(ticker);

  const prompt = `Voce e um analista fundamentalista especializado no mercado brasileiro (B3).
Analise a acao ${ticker} (${nomeEmpresa}) com base nos dados abaixo.

${
  dadosRI.conteudo
    ? `=== DADOS COLETADOS DE ${dadosRI.fonte} ===
${dadosRI.conteudo}
=== FIM DOS DADOS COLETADOS ===`
    : `=== DADOS DE RI ===
Dados de RI nao disponiveis no momento. Baseie sua analise nos dados quantitativos abaixo.
=== FIM ===`
}

=== ANALISE QUANTITATIVA JA CALCULADA ===
Cotacao atual: R$ ${dados.cotacao.toFixed(2)}
Preco Teto (Graham): R$ ${dados.precoTeto.toFixed(2)}
Margem de Seguranca: ${(dados.margemSeguranca * 100).toFixed(1)}%
Score fundamentalista: ${dados.score}/100
P/L: ${dados.pl > 0 ? dados.pl.toFixed(1) : "N/D"}
P/VP: ${dados.pvp > 0 ? dados.pvp.toFixed(2) : "N/D"}
ROE: ${(dados.roe * 100).toFixed(1)}%
Dividend Yield: ${(dados.dividendYield * 100).toFixed(1)}%
Divida/EBITDA: ${dados.debtToEbitda.toFixed(1)}x
Margem Liquida: ${(dados.netMargin * 100).toFixed(1)}%
=== FIM DA ANALISE QUANTITATIVA ===

Retorne SOMENTE um JSON valido, sem markdown:
{
  "resumoTrimestral": "resumo do ultimo resultado trimestral em 2-3 frases",
  "recomendacao": "COMPRAR ou SEGURAR ou VENDER",
  "justificativa": "explicacao objetiva da recomendacao em 2-3 frases",
  "redFlags": ["alerta1", "alerta2"],
  "comparacaoTrimestre": "comparacao com trimestre anterior em 1-2 frases",
  "periodoAnalisado": "ex: 3T24 vs 2T24"
}

Responda em portugues brasileiro e NUNCA use emojis.`;

  const result = await callAIServerless(config, prompt, "json_object");
  const analise = result as unknown as AnaliseIA;
  analise.fonte = dadosRI.fonte || "";

  const recsValidas = ["COMPRAR", "SEGURAR", "VENDER"];
  if (!recsValidas.includes(analise.recomendacao)) {
    analise.recomendacao = "SEGURAR";
  }
  if (!Array.isArray(analise.redFlags)) {
    analise.redFlags = [];
  }

  return analise;
}

async function callAIServerless(config: AIProviderConfig, prompt: string, responseFormat: string = "text"): Promise<any> {
    const response = await fetch(AI_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            provider: config.provider,
            apiKey: config.apiKey,
            messages: [
                {
                    role: "system",
                    content: "Voce e um analista financeiro profissional. Responda APENAS com JSON valido, sem nenhum texto adicional, sem markdown, sem blocos de codigo.",
                },
                {
                    role: "user",
                    content: prompt,
                },
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

    try {
        let cleanJson = textContent.trim();
        if (cleanJson.startsWith("```json")) cleanJson = cleanJson.slice(7);
        if (cleanJson.startsWith("```")) cleanJson = cleanJson.slice(3);
        if (cleanJson.endsWith("```")) cleanJson = cleanJson.slice(0, -3);
        cleanJson = cleanJson.trim();

        return JSON.parse(cleanJson);
    } catch {
        console.error("Erro ao fazer parse da resposta IA:", textContent);
        throw new Error("Erro ao interpretar resposta da IA. Tente novamente.");
    }
}
