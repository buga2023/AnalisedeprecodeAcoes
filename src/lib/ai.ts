import { coletarDadosRI } from "./scraping";
import type { InvestorProfile } from "@/types/stock";
import {
  fetchMacroContext,
  fetchTickerNews,
  fetchTopicNews,
  fetchWorldNews,
  buildContextBlock,
  newsUrlsFromBundles,
  urlsFromWorldNews,
  type MacroContext,
  type NewsBundle,
} from "./context";

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
0. ENQUADRAMENTO: voce gera SUGESTOES com fonte para um app de paper trading.
   NAO esta dando recomendacao personalizada de investimento. Sempre que falar
   de comprar/vender/segurar, deixe claro que e SUGESTAO baseada nos dados e
   no perfil — a decisao final e do usuario.
1. PERFIL: TODA sugestao DEVE comecar referenciando o perfil do usuario.
   Exemplo: "Pelo seu perfil moderado, ...". Sem perfil definido, NAO sugira
   ativo especifico — peca o perfil primeiro.
2. FONTES: Para CADA afirmacao fatual (preco, multiplo, noticia, resultado
   financeiro, evento macro, evento politico) inclua a fonte no campo "fontes":
   - URL completa de noticia (use os links do bloco "NOTICIAS RECENTES" abaixo
     quando estiver citando manchetes ou eventos politicos/sociais),
   - URL de RI / B3 / CVM / orgao oficial,
   - "Yahoo Finance" para preco/historico/fundamentos atuais,
   - "Banco Central do Brasil (SGS)" para SELIC, IPCA, CDI, IBC-Br, IGP-M,
   - "calculo do app" para valores derivados (Graham, score, margem de seguranca),
   - "perfil do usuario" para informacao do quiz.
3. Se NAO tiver fonte verificavel para um fato, escreva "(sem fonte verificavel)"
   e NAO afirme o fato. Nunca invente preco, multiplo ou noticia.
4. Numere o texto com [1], [2]... fazendo match com a ordem do array "fontes".
5. Sempre encerre lembrando que a decisao e do usuario quando der sugestao de
   compra/venda/segurar.
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
  /** Return on Invested Capital — fração (0,12 = 12%). 0 quando indisponível. */
  roic?: number;
  /** Return on Investment do investidor (posição atual vs custo médio) — fração. */
  roiPosicao?: number;
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
  /** ROIC — fração (0.12 = 12%). 0 quando indisponível. */
  roic: number;
  dividendYield: number;
  pl: number;
  pvp: number;
  debtToEbitda: number;
  margemLiquida: number;
  score: number;
  grahamValue: number;
  marginOfSafety: number;
}

function buildPortfolioPrompt(
  stocks: PortfolioData[],
  profile: InvestorProfile | null | undefined,
  contextBlock: string
): string {
  const stocksData = stocks
    .map(
      (s) =>
        `- ${s.ticker}: Preco R$${s.preco.toFixed(2)}, Variacao ${s.variacaoPercent >= 0 ? "+" : ""}${s.variacaoPercent.toFixed(2)}%, ` +
        `LPA ${s.lpa.toFixed(2)}, VPA ${s.vpa.toFixed(2)}, ROE ${(s.roe * 100).toFixed(1)}%, ` +
        `ROIC ${s.roic > 0 ? (s.roic * 100).toFixed(1) + "%" : "N/D"}, ` +
        `DY ${(s.dividendYield * 100).toFixed(1)}%, P/L ${s.pl.toFixed(1)}, P/VP ${s.pvp.toFixed(2)}, ` +
        `Div/EBITDA ${s.debtToEbitda.toFixed(1)}x, Margem Liq ${(s.margemLiquida * 100).toFixed(1)}%, Score ${s.score}/100, ` +
        `Graham R$${s.grahamValue.toFixed(2)}, Margem Seg. ${s.marginOfSafety.toFixed(1)}%`
    )
    .join("\n");

  return `Voce e Pra, analista financeira da Praxia especializada em B3 e mercados internacionais.
Analise o portfolio considerando fundamentos + cenario macro (SELIC, IPCA,
atividade) + eventos politicos/sociais relevantes do Brasil e do mundo.

${describeProfile(profile)}

PORTFOLIO DO INVESTIDOR (dados via Yahoo Finance):
${stocksData}

${contextBlock}

${SOURCE_AND_PROFILE_RULES}

INSTRUCOES DE SAIDA:
1. Responda EXCLUSIVAMENTE em formato JSON valido, sem markdown, sem blocos de codigo.
2. Schema exato:
{
  "resumo": "Frase curta com o sentimento geral, abrindo com 'Pelo seu perfil [risco]...' [1]",
  "sentimento": "otimista" | "pessimista" | "neutro",
  "fontes": ["Yahoo Finance", "Banco Central do Brasil (SGS)", "calculo do app", "https://noticia..."],
  "insights": [
    {
      "titulo": "Titulo curto",
      "tipo": "alta" | "baixa" | "neutro" | "alerta",
      "confianca": "alta" | "media" | "baixa",
      "categoria": "Tendencia" | "Valuation" | "Fundamentos" | "Risco" | "Dividendos" | "Momentum" | "Volatilidade" | "Macro" | "Politica",
      "descricao": "Descricao 2-3 frases, sempre ancorada no perfil. Inclua referencias [1], [2]...",
      "ticker": "TICKER ou null se for insight geral",
      "fontes": ["Yahoo Finance", "https://noticia...", "Banco Central do Brasil (SGS)", "calculo do app"]
    }
  ]
}

REGRAS DE ANALISE:
- Gere entre 4 e 8 insights ALINHADOS ao perfil do usuario.
- INCLUA pelo menos 1 insight de categoria "Macro" (SELIC/IPCA/cambio/IBC-Br)
  e quando houver noticia politica/social relevante, 1 de categoria "Politica".
  Para cada um, cite a URL exata da noticia ou "Banco Central do Brasil (SGS)".
- Conecte setor da empresa ao cenario (bancos vs SELIC, exportadoras vs cambio,
  varejo vs IPCA, energia/saneamento vs regulacao/politica).
- TODO insight DEVE ter fontes nao vazias. Se nao consegue citar, NAO emita.
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
  roic?: number;
  dividendYield: number;
  pl: number;
  pvp: number;
  debtToEbitda: number;
  netMargin: number;
  score: number;
  grahamValue?: number;
  marginOfSafety?: number;
}): PortfolioData {
  const grahamValue = stock.grahamValue ?? 0;
  const marginOfSafety = stock.marginOfSafety ?? 0;
  return {
    ticker: stock.ticker,
    preco: stock.price,
    variacao: stock.change,
    variacaoPercent: stock.changePercent,
    lpa: stock.lpa,
    vpa: stock.vpa,
    roe: stock.roe,
    roic: stock.roic ?? 0,
    dividendYield: stock.dividendYield,
    pl: stock.pl,
    pvp: stock.pvp,
    debtToEbitda: stock.debtToEbitda,
    margemLiquida: stock.netMargin,
    score: stock.score,
    grahamValue,
    marginOfSafety,
  };
}

export async function fetchAIInsights(
  stocks: PortfolioData[],
  profile: InvestorProfile | null = null
): Promise<AIResponse> {
  if (stocks.length === 0) {
    throw new Error("Nenhum ativo no portfolio para analisar.");
  }

  // Contexto extra em paralelo: macro (Banco Central) + manchetes nacionais
  // de politica e economia + manchetes dos tickers principais (ate 3) para
  // o modelo ter ancoras concretas a citar.
  const topTickers = stocks.slice(0, 3).map((s) => s.ticker);
  const [macro, worldNews, newsPolitica, newsEconomia, newsCrise, ...tickerNews] = await Promise.all([
    fetchMacroContext(),
    fetchWorldNews(),
    fetchTopicNews("politica", 4),
    fetchTopicNews("economia", 4),
    fetchTopicNews("crise", 3),
    ...topTickers.map((t) => fetchTickerNews(t, 3)),
  ]);
  const bundles: NewsBundle[] = [newsPolitica, newsEconomia, newsCrise, ...tickerNews];
  const contextBlock = buildContextBlock({ macro, news: bundles, worldNews });

  const prompt = buildPortfolioPrompt(stocks, profile, contextBlock);
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

  // Anexa as URLs que a IA citou no texto mas que talvez tenha esquecido no
  // array de fontes — assim o usuario sempre tem o link clicavel.
  const allUrls = [
    ...newsUrlsFromBundles(bundles),
    ...urlsFromWorldNews(worldNews),
  ];
  for (const u of allUrls) {
    const used =
      (result.resumo && result.resumo.includes(u)) ||
      result.insights.some((it) => it.descricao && it.descricao.includes(u));
    if (used && !result.fontes.includes(u)) result.fontes.push(u);
  }
  if (macro && macro.resumoParaPrompt && !result.fontes.includes("Banco Central do Brasil (SGS)")) {
    result.fontes.push("Banco Central do Brasil (SGS)");
  }
  return result;
}

// Re-exporta para que UI possa exibir o contexto sem refetch.
export type { MacroContext, NewsBundle };
export { fetchMacroContext, fetchTickerNews, fetchTopicNews };

export async function analisarAcaoComIA(
  ticker: string,
  nomeEmpresa: string,
  dados: DadosQuantitativos,
  profile: InvestorProfile | null = null
): Promise<AnaliseIA> {
  // Coleta de contexto em paralelo: RI + manchetes do ticker + manchetes
  // gerais (política/economia BR) + indicadores macro do Banco Central.
  const [dadosRI, newsTicker, newsPolitica, newsEconomia, newsCrise, macro, worldNews] =
    await Promise.all([
      coletarDadosRI(ticker),
      fetchTickerNews(ticker, 5),
      fetchTopicNews("politica", 3),
      fetchTopicNews("economia", 3),
      fetchTopicNews("crise", 3),
      fetchMacroContext(),
      fetchWorldNews(),
    ]);

  const contextBlock = buildContextBlock({
    macro,
    news: [newsTicker, newsPolitica, newsEconomia, newsCrise],
    worldNews,
  });

  const prompt = `Voce e Pra, analista fundamentalista da Praxia especializada em B3.
Analise a acao ${ticker} (${nomeEmpresa}) levando em conta fundamentos, contexto
macroeconomico (SELIC, IPCA, atividade), eventos politicos recentes e o
ambiente social/setorial relevante.

${describeProfile(profile)}

${
  dadosRI.conteudo
    ? `=== DADOS COLETADOS DE RI (${dadosRI.fonte}) ===
${dadosRI.conteudo}
=== FIM ===`
    : `=== DADOS DE RI ===
Sem dados de RI no momento. Use os fundamentos abaixo + macro + noticias.
=== FIM ===`
}

=== METRICAS CALCULADAS PELO APP (fonte: "calculo do app") ===
Cotacao atual: R$ ${dados.cotacao.toFixed(2)} (Yahoo Finance)
Preco Teto (Graham): R$ ${dados.precoTeto.toFixed(2)}
Margem de Seguranca: ${(dados.margemSeguranca * 100).toFixed(1)}%
Score fundamentalista: ${dados.score}/100
P/L: ${dados.pl > 0 ? dados.pl.toFixed(1) : "N/D"}
P/VP: ${dados.pvp > 0 ? dados.pvp.toFixed(2) : "N/D"}
ROE: ${(dados.roe * 100).toFixed(1)}% (retorno sobre patrimonio liquido)
ROIC: ${dados.roic && dados.roic !== 0 ? (dados.roic * 100).toFixed(1) + "% (retorno sobre capital total investido — proxy: EBIT*(1-34%)/(divida+PL))" : "N/D"}
ROI da posicao do usuario: ${
        dados.roiPosicao !== undefined
          ? (dados.roiPosicao * 100).toFixed(1) + "% (preco atual vs preco medio de compra)"
          : "N/D (usuario nao tem posicao ou nao informou custo medio)"
      }
Dividend Yield: ${(dados.dividendYield * 100).toFixed(1)}%
Divida/EBITDA: ${dados.debtToEbitda.toFixed(1)}x
Margem Liquida: ${(dados.netMargin * 100).toFixed(1)}%
=== FIM ===

INSTRUCOES DE RENTABILIDADE:
- Comente explicitamente ROE vs ROIC. Se ROIC < ROE de forma relevante, a empresa
  esta gerando retorno alto sobre o PL graças à alavancagem; sinalize o risco.
- Se ROIC > custo de capital implicito (>= SELIC + premio de risco ~5pp), e um
  bom alocador de capital — vale como "PRO" na tese.
- Se ROI da posicao do usuario estiver muito acima/abaixo da media historica do
  papel, considere se faz sentido realizar/aportar dado o perfil do usuario.

${contextBlock}

${SOURCE_AND_PROFILE_RULES}

INSTRUCOES ADICIONAIS:
- Ao mencionar eventos politicos/sociais/macro, SEMPRE cite a URL exata da
  noticia listada acima ou "Banco Central do Brasil (SGS)" para indicadores.
- Conecte o cenario macro ao setor da empresa (ex.: SELIC alta -> bancos
  ganham, varejo sofre; cambio fraco -> exportadoras ganham; politica fiscal
  expansiva -> aumenta premio de risco do soberano e afeta multiplos).
- Se a noticia for relevante para a tese, inclua-a em "redFlags" (risco) ou
  no "resumoTrimestral" (drive).

Retorne SOMENTE um JSON valido, sem markdown:
{
  "resumoTrimestral": "Resumo 2-3 frases combinando resultado + macro/politica relevante, com [n]",
  "recomendacao": "COMPRAR" | "SEGURAR" | "VENDER",
  "justificativa": "Comece com 'Pelo seu perfil [risco]...'. 2-4 frases conectando fundamentos + macro/politica/social ao perfil, com [n]",
  "redFlags": ["alerta com [n] referenciando fonte (noticia, macro, RI ou calculo)"],
  "comparacaoTrimestre": "Comparacao com trimestre anterior + impacto macro em 1-2 frases com [n]",
  "periodoAnalisado": "ex: 3T24 vs 2T24",
  "fontes": ["Yahoo Finance", "Banco Central do Brasil (SGS)", "calculo do app", "perfil do usuario", "https://noticia...", "${dadosRI.fonte || ""}"]
}

Responda em portugues brasileiro e NUNCA use emojis. Se faltar fonte para algo,
escreva "(sem fonte verificavel)" e NAO afirme o fato. Toda noticia citada
DEVE ter o link correspondente no array "fontes".`;

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
    analise.fontes = [];
  }
  // Garante que ao menos as fontes injetadas estejam na lista.
  const ensure = new Set(analise.fontes);
  if (dadosRI.fonte) ensure.add(dadosRI.fonte);
  ensure.add("Yahoo Finance");
  ensure.add("calculo do app");
  if (macro && macro.resumoParaPrompt) ensure.add("Banco Central do Brasil (SGS)");
  for (const u of [
    ...newsUrlsFromBundles([newsTicker, newsPolitica, newsEconomia, newsCrise]),
    ...urlsFromWorldNews(worldNews),
  ]) {
    // só adiciona URLs que a IA mencionou no texto (heurística: aparecem no
    // resumo ou justificativa). Se nao mencionou, deixa fora.
    if (
      (analise.resumoTrimestral && analise.resumoTrimestral.includes(u)) ||
      (analise.justificativa && analise.justificativa.includes(u))
    ) {
      ensure.add(u);
    }
  }
  analise.fontes = Array.from(ensure);

  return analise;
}

/** Item retornado pela comparação IA, um por ticker. */
export interface ComparacaoTickerIA {
  ticker: string;
  recomendacao: "COMPRAR" | "SEGURAR" | "VENDER";
  tese: string;
  pros: string[];
  contras: string[];
  fontes: string[];
}

export interface ComparacaoIA {
  vencedor: string;
  resumo: string;
  itens: ComparacaoTickerIA[];
  fontes: string[];
}

export async function compararAcoesComIA(
  stocks: PortfolioData[],
  profile: InvestorProfile | null = null
): Promise<ComparacaoIA> {
  if (stocks.length < 2) {
    throw new Error("Selecione pelo menos 2 ações para comparar.");
  }
  if (stocks.length > 4) {
    throw new Error("No máximo 4 ações por comparação.");
  }

  const stocksData = stocks
    .map(
      (s) =>
        `- ${s.ticker}: Preco R$${s.preco.toFixed(2)}, ROE ${(s.roe * 100).toFixed(1)}%, ` +
        `DY ${(s.dividendYield * 100).toFixed(1)}%, P/L ${s.pl.toFixed(1)}, P/VP ${s.pvp.toFixed(2)}, ` +
        `Div/EBITDA ${s.debtToEbitda.toFixed(1)}x, Margem ${(s.margemLiquida * 100).toFixed(1)}%, Score ${s.score}/100, ` +
        `Graham R$${s.grahamValue.toFixed(2)}, Margem Seg. ${s.marginOfSafety.toFixed(1)}%`
    )
    .join("\n");

  const tickers = stocks.map((s) => s.ticker).join(", ");

  const prompt = `Voce e Pra, analista da Praxia especializada em B3.
Compare estas acoes lado a lado e identifique qual encaixa melhor no perfil do usuario.

${describeProfile(profile)}

ATIVOS A COMPARAR (dados via BrAPI / Yahoo Finance):
${stocksData}

${SOURCE_AND_PROFILE_RULES}

Retorne SOMENTE um JSON valido, sem markdown:
{
  "vencedor": "TICKER mais alinhado ao perfil",
  "resumo": "Comece com 'Pelo seu perfil [risco]...'. 2-3 frases comparando os ativos com referencias [1], [2]...",
  "fontes": ["BrAPI", "calculo do app", "perfil do usuario"],
  "itens": [
    {
      "ticker": "${stocks[0].ticker}",
      "recomendacao": "COMPRAR" | "SEGURAR" | "VENDER",
      "tese": "Tese de 2-3 frases conectando dados ao perfil, com referencias",
      "pros": ["ponto positivo 1 [n]", "ponto positivo 2 [n]"],
      "contras": ["ponto de atencao 1 [n]"],
      "fontes": ["BrAPI", "calculo do app"]
    }
    // ... um por ticker, na ordem dos ativos: ${tickers}
  ]
}

Responda em portugues brasileiro, sem emojis. Se nao tiver fonte para algo, escreva "sem fonte verificavel" e nao afirme o fato.`;

  const result = await callAIServerless<ComparacaoIA>(prompt, "json_object");

  if (!Array.isArray(result.itens)) result.itens = [];
  if (!Array.isArray(result.fontes)) result.fontes = [];
  result.itens = result.itens.map((it) => ({
    ...it,
    pros: Array.isArray(it.pros) ? it.pros : [],
    contras: Array.isArray(it.contras) ? it.contras : [],
    fontes: Array.isArray(it.fontes) ? it.fontes : [],
  }));

  return result;
}

/**
 * SYSTEM PROMPT da Pra — analista da Praxia. Inclui:
 *  - papel + tom
 *  - contexto que ela recebe (macro BR, notícias por ticker, política/economia
 *    nacional, política GLOBAL via /api/world-news refreshed a cada 2h)
 *  - framework de transmissão "evento → indicador → setor" (do guia interno
 *    "Indicadores x Política & Macro")
 *  - regra das 3 perguntas (ruído x estrutural; temporário x permanente; preço
 *    já reflete?)
 *  - mandato de arbitragem
 *  - obrigação de citar URLs e usar perfil do usuário
 */
export const PRAXIA_SYSTEM_PROMPT = `Voce e a "Pra", analista fundamentalista e macro da Praxia (paper-trading B3 e mercados globais).

CONTEXTO QUE VOCE RECEBE EM CADA CHAMADA:
- Carteira do usuario (BrAPI/Yahoo) + perfil (risco/horizonte/interesses).
- Metricas calculadas pelo app: Graham, score 0-100, ROE, ROIC, ROI da posicao, P/L, P/VP, DY, Div/EBITDA, margens.
- Indicadores macro BR (BCB/SGS): SELIC, IPCA, CDI, IGP-M, IBC-Br, Ibovespa intraday.
- Noticias por ticker + topicos BR (politica, economia, crise, fiscal) via Google News RSS.
- NOTICIAS GLOBAIS atualizadas a cada 2 horas (GDELT 2.0 + Google News multi-pais + Reddit + BBC) cobrindo:
  geopolitica (conflitos, sancoes), politica EUA (Fed, tarifas, eleicao), China (estimulo, propriedade, Taiwan),
  commodities (OPEP, minerio, agro), Brasil fiscal (arcabouco, divida).
  Cada topico vem com "Angulo de arbitragem" pre-redigido pelo servidor — USE-O como ponto de partida.

CADEIAS DE TRANSMISSAO (mapa evento -> indicador -> setor que voce DEVE aplicar):

1) TENSAO POLITICA / RISCO PAIS sobe
   -> Beta sobe (acoes beta>1 caem mais), P/L comprime, sigma sobe, drawdown aumenta
   -> Saida de capital estrangeiro -> dolar sobe -> exportadoras GANHAM (PETR, VALE, JBS, EMBR)
   -> Estatais (PETR4, BBAS3, ELET3) sofrem (dividendos incertos)
   -> DY nominal sobe por queda do preco; nem sempre e DY real (armadilha)
   -> Pre-eleicao: prefira beta<1 ou hedge cambial via IVVB11/exportadora

2) SELIC sobe (ou expectativa)
   -> WACC sobe -> P/L justo comprime -> growth/small-caps sofrem
   -> FIIs comprimem (P/VP cai), construtoras/varejo alavancado sofrem
   -> BANCOS ganham no curto (NIM expande); divida/EBITDA sobe (empresas em CDI)

3) SELIC cai (ou expectativa dovish)
   -> WACC cai -> P/L expande -> growth, FIIs, construtoras, utilities (SAPR4, SBSP3, EQTL3) ganham
   -> Empresas com divida em CDI: cobertura de juros melhora direto

4) DOLAR sobe (USDBRL sobe)
   -> Exportadoras: margem liquida sobe, ROE sobe, P/L cai (lucro sobe mais que preco)
   -> Importadoras/varejo (PCAR3, AMAR3): margem bruta comprime, cobertura piora
   -> Divida em dolar fica mais cara (EV sobe)
   -> FIIs de logistica: cap rate sobe (reajuste IGP-M segue commodities)

5) PETROLEO sobe (conflito, OPEP corta)
   -> PETR3/PETR4/PRIO3: EBITDA expande, DY potencial sobe, divida/EBITDA cai
   -> Aereas (AZUL4, GOLL4), quimicas, plasticos: margem comprime
   -> Inflacao combustivel sobe -> SELIC resiste a cair (sai dovish)

6) CHINA estimula / minerio sobe
   -> VALE3, CSNA3, GGBR4: EBITDA expande
   -> Inverso: crise imobiliaria China -> minerio cai -> VALE3 sofre

7) TARIFAS EUA / guerra comercial
   -> Exportadoras BR para EUA (siderurgia, embraer): PSR e margem caem
   -> China-EUA tensao: agro brasileiro (SLCE3, AGRO3) GANHA (substituicao de soja USA)
   -> Tecnologia/semicondutores: volatilidade dispara

8) RISCO FISCAL BR piora (arcabouco furado, divida pub.)
   -> Curva DI abre, juro longo sobe -> P/L comprime geral
   -> FIIs/construtoras caem (Selic alta por mais tempo)
   -> Dolar sobe -> ciclo se reforca (exportadoras GANHAM como hedge)

MANDATO DE ARBITRAGEM:
Toda noticia relevante que voce mencionar DEVE incluir:
(a) qual indicador da carteira do usuario sera afetado (Beta, P/L, ROIC, DY, margem, etc.),
(b) qual SETOR/TICKER da carteira ganha vs perde,
(c) se a oportunidade e direcional (long-only) ou par (long X / short Y na mesma cadeia).
Quando ver dislocacao temporaria (ruido politico) em ativo com ROE/ROIC/FCL ainda solidos -> sinalize como oportunidade.
Quando ver mudanca estrutural (regulatoria, perda concessao, novo imposto) -> recalcule a tese, nao trate como ruido.

REGRA DAS 3 PERGUNTAS antes de qualquer recomendacao com base em noticia:
1. A noticia muda o RESULTADO OPERACIONAL (ROE, margem, FCL, ROIC) ou so o humor?
2. O impacto e TEMPORARIO (tensao eleitoral, geopolitica passageira) ou PERMANENTE (regulacao, concessao perdida)?
3. A EXPECTATIVA ja esta no preco? Compare P/L e EV/EBITDA atuais com a media historica.

OBRIGACOES SEMPRE:
- Toda sugestao COMECA referenciando o perfil do usuario ("Pelo seu perfil [risco]...").
- Cite a fonte de cada fato (URL completa para noticias; "Yahoo Finance" para preco/fundamentos;
  "Banco Central do Brasil (SGS)" para macro; "calculo do app" para metricas derivadas; "perfil do usuario").
- Numere o texto com [1], [2]... fazendo match com o array "fontes".
- Se nao tiver fonte, escreva "(sem fonte verificavel)" e NAO afirme o fato.
- Voce gera SUGESTOES com fonte para paper-trading. Decisao final e do usuario — encerre lembrando.
- ROE vs ROIC: comente. Se ROE >> ROIC, ha alavancagem inflando retorno; SINALIZE RISCO.
  Se ROIC > SELIC + ~5pp (premio de risco), e bom alocador de capital — vale como PRO na tese.

FORMATO DE RESPOSTA:
Responda APENAS com JSON valido, sem markdown, sem blocos de codigo, sem texto fora do JSON.
Use portugues brasileiro. NUNCA use emojis.`;

async function callAIServerless<T>(prompt: string, responseFormat: string = "text"): Promise<T> {
  const response = await fetch(AI_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        { role: "system", content: PRAXIA_SYSTEM_PROMPT },
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
