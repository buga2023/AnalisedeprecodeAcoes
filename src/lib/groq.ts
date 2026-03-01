/**
 * Servico de integracao com a API do Groq
 * Utiliza o modelo llama-3.3-70b-versatile (gratuito)
 * API compativel com OpenAI
 */

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const GROQ_KEY_STORAGE = "stocks-ai-groq-key";

export function getStoredGroqKey(): string {
    return localStorage.getItem(GROQ_KEY_STORAGE) ?? "";
}

export function setStoredGroqKey(key: string) {
    if (key) {
        localStorage.setItem(GROQ_KEY_STORAGE, key);
    } else {
        localStorage.removeItem(GROQ_KEY_STORAGE);
    }
}

export interface GroqInsight {
    titulo: string;
    tipo: "alta" | "baixa" | "neutro" | "alerta";
    confianca: "alta" | "media" | "baixa";
    categoria: string;
    descricao: string;
    ticker?: string;
}

export interface GroqResponse {
    insights: GroqInsight[];
    resumo: string;
    sentimento: "otimista" | "pessimista" | "neutro";
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
- Analise tendencias de preco, valuation (comparando P/L, P/VP com medias setoriais), saude financeira (Divida/EBITDA), rentabilidade (ROE), e distribuicao de dividendos (DY)
- Identifique oportunidades de compra (acoes com bom Graham score e ROE alto)
- Alerte sobre riscos (alavancagem excessiva, P/L muito alto, margem comprimida)
- Compare os ativos entre si quando relevante
- Use linguagem profissional mas acessivel em portugues do Brasil
- Considere o cenario macroeconomico brasileiro atual (SELIC, inflacao, cambio)
- NUNCA use emojis
- Cada insight deve ter uma descricao com no minimo 2 frases detalhadas

Responda SOMENTE com o JSON, nada mais.`;
}

export async function fetchGroqInsights(
    apiKey: string,
    stocks: PortfolioData[]
): Promise<GroqResponse> {
    if (!apiKey) {
        throw new Error("Chave da API Groq nao configurada.");
    }

    if (stocks.length === 0) {
        throw new Error("Nenhum ativo no portfolio para analisar.");
    }

    const prompt = buildPrompt(stocks);

    const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: GROQ_MODEL,
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
            response_format: { type: "json_object" },
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        if (response.status === 401) {
            throw new Error("Chave da API Groq invalida. Verifique sua chave em console.groq.com.");
        }
        if (response.status === 429) {
            throw new Error("Limite de requisicoes da API Groq atingido. Aguarde alguns minutos.");
        }
        if (response.status === 413) {
            throw new Error("Portfolio muito grande para processar. Tente com menos ativos.");
        }
        console.error("Groq API error:", response.status, errorBody);
        throw new Error(`Erro na API Groq: ${response.status}`);
    }

    const data = await response.json();

    const textContent = data?.choices?.[0]?.message?.content;

    if (!textContent) {
        throw new Error("Resposta vazia da API Groq.");
    }

    try {
        let cleanJson = textContent.trim();
        // Limpar possivel markdown
        if (cleanJson.startsWith("```json")) {
            cleanJson = cleanJson.slice(7);
        }
        if (cleanJson.startsWith("```")) {
            cleanJson = cleanJson.slice(3);
        }
        if (cleanJson.endsWith("```")) {
            cleanJson = cleanJson.slice(0, -3);
        }
        cleanJson = cleanJson.trim();

        const parsed: GroqResponse = JSON.parse(cleanJson);

        if (!parsed.insights || !Array.isArray(parsed.insights)) {
            throw new Error("Formato de resposta invalido.");
        }

        return parsed;
    } catch (parseError) {
        console.error("Erro ao fazer parse da resposta Groq:", textContent);
        throw new Error("Erro ao interpretar resposta da IA. Tente novamente.");
    }
}
