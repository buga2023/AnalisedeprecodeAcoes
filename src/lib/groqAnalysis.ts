/**
 * Analise individual de acao com IA (Groq + Llama 3.3 70B)
 *
 * Fluxo:
 * 1. Coleta dados de RI via scraping (Investidor10/StatusInvest)
 * 2. Combina com dados quantitativos ja disponoveis no app
 * 3. Envia contexto completo para o Llama via Groq API
 * 4. Retorna analise estruturada em JSON
 *
 * Se o scraping falhar, a IA analisa apenas com dados quantitativos.
 */

import { coletarDadosRI, type DadosRI } from "./scraping";

const GROQ_API_URL = "/api/groq";
const GROQ_MODEL = "llama-3.3-70b-versatile";

/** Resultado estruturado da analise da IA */
export interface AnaliseIA {
  resumoTrimestral: string;
  recomendacao: "COMPRAR" | "SEGURAR" | "VENDER";
  justificativa: string;
  redFlags: string[];
  comparacaoTrimestre: string;
  periodoAnalisado: string;
  fonte: string;
}

/** Dados quantitativos da acao que ja temos no app */
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

/**
 * Analisa uma acao individualmente usando dados de scraping + IA
 */
export async function analisarAcaoComIA(ticker: string, nomeEmpresa: string, dados: DadosQuantitativos, apiKey: string): Promise<AnaliseIA> {
  // 1. Coletar dados via scraping (pode retornar vazio — nao bloqueia)
  const dadosRI: DadosRI = await coletarDadosRI(ticker);

  // 2. Montar prompt com contexto completo
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

Retorne SOMENTE um JSON valido, sem markdown, sem texto antes ou depois:
{
  "resumoTrimestral": "resumo do ultimo resultado trimestral em 2-3 frases",
  "recomendacao": "COMPRAR ou SEGURAR ou VENDER",
  "justificativa": "explicacao objetiva da recomendacao em 2-3 frases",
  "redFlags": ["alerta1", "alerta2"],
  "comparacaoTrimestre": "comparacao com trimestre anterior em 1-2 frases",
  "periodoAnalisado": "ex: 3T24 vs 2T24"
}

Regras:
- recomendacao deve ser exatamente uma das tres opcoes: COMPRAR, SEGURAR ou VENDER
- redFlags pode ser array vazio [] se nao houver alertas
- Se os dados de RI nao estiverem disponiveis, baseie-se nos dados quantitativos
- Use linguagem profissional mas acessivel
- Responda em portugues brasileiro
- NUNCA use emojis`;

  // 3. Chamar Groq API
  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.3, // Baixo para respostas mais consistentes
      max_tokens: 1000,
      messages: [
        {
          role: "system",
          content:
            "Voce e um analista financeiro profissional. Responda APENAS com JSON valido, sem nenhum texto adicional, sem markdown, sem blocos de codigo.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const erro = await response.text().catch(() => "");
    if (response.status === 401) {
      throw new Error(
        "Chave da API Groq invalida. Verifique sua chave em console.groq.com."
      );
    }
    if (response.status === 429) {
      throw new Error(
        "Limite de requisicoes da API Groq atingido. Aguarde alguns minutos."
      );
    }
    throw new Error(`Erro na API Groq: ${response.status} — ${erro}`);
  }

  const data = await response.json();
  const textoResposta = data?.choices?.[0]?.message?.content ?? "";

  if (!textoResposta) {
    throw new Error("Resposta vazia da API Groq.");
  }

  // 4. Parsear JSON da resposta
  try {
    let jsonLimpo = textoResposta.trim();
    // Limpar possivel markdown
    if (jsonLimpo.startsWith("```json")) {
      jsonLimpo = jsonLimpo.slice(7);
    }
    if (jsonLimpo.startsWith("```")) {
      jsonLimpo = jsonLimpo.slice(3);
    }
    if (jsonLimpo.endsWith("```")) {
      jsonLimpo = jsonLimpo.slice(0, -3);
    }
    jsonLimpo = jsonLimpo.trim();

    const analise = JSON.parse(jsonLimpo) as AnaliseIA;

    // Garantir que fonte esteja preenchida
    analise.fonte = dadosRI.fonte || "";

    // Validar recomendacao
    const recsValidas = ["COMPRAR", "SEGURAR", "VENDER"];
    if (!recsValidas.includes(analise.recomendacao)) {
      analise.recomendacao = "SEGURAR";
    }

    // Garantir redFlags como array
    if (!Array.isArray(analise.redFlags)) {
      analise.redFlags = [];
    }

    return analise;
  } catch {
    console.error(
      "[groqAnalysis] Erro ao fazer parse da resposta:",
      textoResposta
    );
    throw new Error("Resposta da IA nao esta em formato JSON valido. Tente novamente.");
  }
}

