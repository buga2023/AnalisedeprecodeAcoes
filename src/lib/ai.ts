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
import { PRAXIA_SYSTEM_PROMPT } from "./praxiaPrompt";
import { buildOptionalChainsBlock } from "./transmissionChains";
import { SCREENER_SECTORS, type ScreenerFilter, type ScreenerSortBy } from "./screener";
import { checkRateLimit, estimateTokens, recordCall, recordHit } from "./aiTelemetry";

// Re-exporta pra compatibilidade com imports antigos. Fonte unica em praxiaPrompt.ts.
export { PRAXIA_SYSTEM_PROMPT };

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

/**
 * Lembrete curto para reforcar as regras do system prompt em cada user prompt.
 * As regras COMPLETAS vivem em <rules> do PRAXIA_SYSTEM_PROMPT (praxiaPrompt.ts).
 * Mantemos so um ponteiro aqui pra economizar tokens — o LLM ja tem o contexto.
 */
const RULES_REMINDER = `Siga as <rules> e o <output_format> do system: comece com perfil, cite [n] com fonte verificavel em "fontes", nunca invente. Decisao final e do usuario.`;

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

${RULES_REMINDER}

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
  const baseContextBlock = buildContextBlock({ macro, news: bundles, worldNews });
  // Injeta cadeias setoriais opcionais (petroleo, china/minerio, tarifas EUA,
  // fiscal BR) so quando o contexto bate em keywords relacionadas — economiza
  // tokens nos casos comuns sem perder sinal nos casos especificos.
  const contextBlock = baseContextBlock + buildOptionalChainsBlock(baseContextBlock);

  const prompt = buildPortfolioPrompt(stocks, profile, contextBlock);
  const result = await callAIServerless<AIResponse>(prompt, "json_object", "insights");

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

  const baseContextBlock = buildContextBlock({
    macro,
    news: [newsTicker, newsPolitica, newsEconomia, newsCrise],
    worldNews,
  });
  // Cadeias setoriais opcionais sob demanda (mesma logica de fetchAIInsights).
  const contextBlock = baseContextBlock + buildOptionalChainsBlock(baseContextBlock + " " + ticker);

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

${RULES_REMINDER}

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
  "justificativa": "1-2 frases CURTAS sobre o angulo qualitativo (macro, noticia, setor, regulacao) que reforcam ou contradizem a tese. NAO repita Graham/Score/MoS — o app ja exibe esses numeros deterministicamente acima. Foque no que SO o LLM consegue dizer.",
  "redFlags": ["alerta com [n] referenciando fonte (noticia, macro, RI ou calculo)"],
  "comparacaoTrimestre": "Comparacao com trimestre anterior + impacto macro em 1-2 frases com [n]",
  "periodoAnalisado": "ex: 3T24 vs 2T24",
  "fontes": ["Yahoo Finance", "Banco Central do Brasil (SGS)", "calculo do app", "perfil do usuario", "https://noticia...", "${dadosRI.fonte || ""}"]
}

Responda em portugues brasileiro e NUNCA use emojis. Se faltar fonte para algo,
escreva "(sem fonte verificavel)" e NAO afirme o fato. Toda noticia citada
DEVE ter o link correspondente no array "fontes".`;

  const analise = await callAIServerless<AnaliseIA>(prompt, "json_object", "analise");
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

/* Cache local de comparacoes — chave estavel pelos tickers ordenados + perfil. */
const COMPARE_CACHE_PREFIX = "praxia-compare:";
const COMPARE_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2h

interface CompareCacheEntry {
  savedAt: number;
  signature: string;
  payload: ComparacaoIA;
}

function compareCacheKey(stocks: PortfolioData[]): string {
  return COMPARE_CACHE_PREFIX + stocks.map((s) => s.ticker.toUpperCase()).sort().join(",");
}

function compareSignature(stocks: PortfolioData[], profile: InvestorProfile | null): string {
  // Score + perfil — mudou material? recalcula. So oscilacao de preco nao invalida.
  const stocksSig = stocks
    .map((s) => `${s.ticker}:${s.score}:${Math.round(s.roe * 20)}`)
    .sort()
    .join("|");
  const profSig = profile
    ? `${profile.risk}-${profile.horizon}-${(profile.interests ?? []).slice().sort().join(",")}`
    : "noprof";
  return `${stocksSig}#${profSig}`;
}

function readCompareCache(stocks: PortfolioData[], sig: string): ComparacaoIA | null {
  try {
    const raw = localStorage.getItem(compareCacheKey(stocks));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CompareCacheEntry;
    if (entry.signature !== sig) return null;
    if (Date.now() - entry.savedAt > COMPARE_CACHE_TTL_MS) return null;
    return entry.payload;
  } catch {
    return null;
  }
}

function writeCompareCache(stocks: PortfolioData[], sig: string, payload: ComparacaoIA) {
  try {
    const entry: CompareCacheEntry = { savedAt: Date.now(), signature: sig, payload };
    localStorage.setItem(compareCacheKey(stocks), JSON.stringify(entry));
  } catch {
    /* quota cheia: ignora */
  }
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

  const sig = compareSignature(stocks, profile);
  const cached = readCompareCache(stocks, sig);
  if (cached) {
    recordHit("comparacao");
    return cached;
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

${RULES_REMINDER}

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

  const result = await callAIServerless<ComparacaoIA>(prompt, "json_object", "comparacao");

  if (!Array.isArray(result.itens)) result.itens = [];
  if (!Array.isArray(result.fontes)) result.fontes = [];
  result.itens = result.itens.map((it) => ({
    ...it,
    pros: Array.isArray(it.pros) ? it.pros : [],
    contras: Array.isArray(it.contras) ? it.contras : [],
    fontes: Array.isArray(it.fontes) ? it.fontes : [],
  }));

  writeCompareCache(stocks, sig, result);
  return result;
}

/* ─── Fase 3: Otimização de dividendos ──────────────────────────────────── */

/** Item da carteira simplificado para o otimizador. */
export interface OptimizeStockInput {
  ticker: string;
  preco: number;
  quantidade: number;
  dividendYield: number; // fração 0..1
  score: number; // 0..100
  setor?: string;
}

/** Candidato externo (ex.: vindo do IBOV) opcional. */
export interface OptimizeCandidate {
  ticker: string;
  preco: number;
  dividendYield: number;
  score: number;
  setor?: string;
  nome?: string;
}

export interface OtimizacaoDividendosRecomendacao {
  /** Ticker atual a reduzir peso ou vender; null = só comprar candidato. */
  vender: string | null;
  /** Ticker a aumentar peso ou comprar; null = só vender (raro). */
  comprar: string | null;
  /** Acao em texto curto ("Trocar ITUB4 por BBAS3"). */
  acao: string;
  /** Variacao estimada de DY medio da carteira em pontos percentuais (0.4 = +0,4pp). */
  dyDeltaPp: number;
  justificativa: string;
  fontes: string[];
}

export interface OtimizacaoDividendosIA {
  recomendacoes: OtimizacaoDividendosRecomendacao[];
  dyMedioAtualPct: number;
  dyMedioProjetadoPct: number;
  resumo: string;
  fontes: string[];
}

/**
 * Sugere ajustes na carteira pra subir o DY medio sem sacrificar qualidade.
 * Trabalha com dados REAIS:
 *  - `stocks`: posicoes do usuario (preco, qty, DY, score atuais).
 *  - `annualProjected`: total anual projetado em R$ (do useDividendCalendar).
 *  - `candidates`: universo externo OPCIONAL ja pre-filtrado pela UI; vazio = LLM
 *    so sugere rebalance interno (aumentar peso de tickers da propria carteira
 *    com DY > media). Sem inventar tickers.
 */
export async function otimizarDividendosComIA(
  stocks: OptimizeStockInput[],
  annualProjected: number,
  profile: InvestorProfile | null,
  candidates: OptimizeCandidate[] = []
): Promise<OtimizacaoDividendosIA> {
  const eligible = stocks.filter((s) => s.quantidade > 0 && s.preco > 0);
  if (eligible.length === 0) {
    throw new Error("Sem ativos com posicao para otimizar.");
  }

  // Calcula DY medio ponderado REAL (em codigo, nao confia no LLM pra isso).
  const totalValue = eligible.reduce((acc, s) => acc + s.preco * s.quantidade, 0);
  const dyWeighted =
    totalValue > 0
      ? eligible.reduce((acc, s) => acc + s.dividendYield * s.preco * s.quantidade, 0) / totalValue
      : 0;
  const scoreAvg =
    eligible.reduce((acc, s) => acc + s.score, 0) / eligible.length;

  // Filtra candidatos por qualidade: DY > media atual E score >= media - 10.
  // Mantem no max 8 candidatos pra nao inflar o prompt.
  const filteredCandidates = candidates
    .filter(
      (c) =>
        c.dividendYield > dyWeighted &&
        c.score >= scoreAvg - 10 &&
        !eligible.some((s) => s.ticker === c.ticker)
    )
    .sort((a, b) => b.dividendYield - a.dividendYield)
    .slice(0, 8);

  const portfolioLines = eligible
    .map(
      (s) =>
        `- ${s.ticker}: posicao R$${(s.preco * s.quantidade).toFixed(2)} ` +
        `(${s.quantidade} x R$${s.preco.toFixed(2)}), DY ${(s.dividendYield * 100).toFixed(2)}%, ` +
        `score ${s.score}/100${s.setor ? `, setor ${s.setor}` : ""}`
    )
    .join("\n");

  const candidatesLines =
    filteredCandidates.length > 0
      ? filteredCandidates
          .map(
            (c) =>
              `- ${c.ticker}${c.nome ? ` (${c.nome})` : ""}: preco R$${c.preco.toFixed(2)}, ` +
              `DY ${(c.dividendYield * 100).toFixed(2)}%, score ${c.score}/100` +
              `${c.setor ? `, setor ${c.setor}` : ""}`
          )
          .join("\n")
      : "(Nenhum candidato externo fornecido — sugira apenas rebalance interno ou marque que nao ha troca util.)";

  const prompt = `Voce e Pra, analista da Praxia. Objetivo: aumentar o DY medio
ponderado da carteira do usuario PRESERVANDO qualidade (score fundamentalista
ponderado nao deve cair mais que 10 pontos).

${describeProfile(profile)}

=== CARTEIRA ATUAL (dados Yahoo Finance + calculo do app) ===
${portfolioLines}

DY medio ponderado ATUAL: ${(dyWeighted * 100).toFixed(2)}%
Total anual de dividendos projetado: R$${annualProjected.toFixed(2)} (fonte: useDividendCalendar)
Score medio: ${scoreAvg.toFixed(1)}/100
=== FIM ===

=== CANDIDATOS EXTERNOS DISPONIVEIS (ja filtrados por qualidade) ===
${candidatesLines}
=== FIM ===

${RULES_REMINDER}

REGRAS DURAS:
- Nao invente tickers. So use tickers que aparecem nas duas listas acima.
- Se nao houver troca util (candidatos fracos, carteira ja otimizada), retorne
  array vazio em "recomendacoes" e explique no "resumo".
- Maximo 3 recomendacoes. Cada uma deve elevar DY medio em pelo menos 0.2pp.
- "dyDeltaPp" deve ser o ganho ESTIMADO em pontos percentuais de DY medio
  ponderado apos aplicar a troca (positivo).
- Justificativa curta (2 frases) referenciando perfil, DY e score.
- "vender" pode ser null se for so comprar (aumentar exposicao com dividendos
  acumulados). "comprar" idem.

Retorne SOMENTE um JSON valido, sem markdown:
{
  "dyMedioAtualPct": ${(dyWeighted * 100).toFixed(2)},
  "dyMedioProjetadoPct": numero apos aplicar todas as recomendacoes,
  "resumo": "Comece com 'Pelo seu perfil [risco]...'. 1-2 frases.",
  "recomendacoes": [
    {
      "vender": "TICKER ou null",
      "comprar": "TICKER ou null",
      "acao": "Trocar X por Y",
      "dyDeltaPp": 0.4,
      "justificativa": "Texto 2 frases com [1] [2]",
      "fontes": ["Yahoo Finance", "calculo do app", "perfil do usuario"]
    }
  ],
  "fontes": ["Yahoo Finance", "calculo do app", "perfil do usuario"]
}

Responda em portugues brasileiro, sem emojis. Toda recomendacao DEVE ter fontes.`;

  const result = await callAIServerless<OtimizacaoDividendosIA>(prompt, "json_object");

  if (!Array.isArray(result.recomendacoes)) result.recomendacoes = [];
  if (!Array.isArray(result.fontes)) result.fontes = ["calculo do app", "Yahoo Finance"];
  result.recomendacoes = result.recomendacoes
    .map((r) => ({
      vender: r.vender ?? null,
      comprar: r.comprar ?? null,
      acao: r.acao ?? "",
      dyDeltaPp: typeof r.dyDeltaPp === "number" ? r.dyDeltaPp : 0,
      justificativa: r.justificativa ?? "",
      fontes: Array.isArray(r.fontes) && r.fontes.length > 0 ? r.fontes : ["calculo do app"],
    }))
    // Defesa: descarta recomendacoes que citam ticker fora das listas.
    .filter((r) => {
      const known = new Set<string>([
        ...eligible.map((s) => s.ticker),
        ...filteredCandidates.map((c) => c.ticker),
      ]);
      if (r.vender && !known.has(r.vender)) return false;
      if (r.comprar && !known.has(r.comprar)) return false;
      return true;
    });

  // Garante numericos reais quando LLM retorna lixo.
  if (typeof result.dyMedioAtualPct !== "number") {
    result.dyMedioAtualPct = Math.round(dyWeighted * 10000) / 100;
  }
  if (typeof result.dyMedioProjetadoPct !== "number") {
    result.dyMedioProjetadoPct = result.dyMedioAtualPct;
  }
  if (!result.resumo) {
    result.resumo = "Carteira ja apresenta DY equilibrado para o perfil informado.";
  }

  return result;
}

// PRAXIA_SYSTEM_PROMPT mestre vive em src/lib/praxiaPrompt.ts (re-exportado no topo).

async function callAIServerless<T>(
  prompt: string,
  responseFormat: string = "text",
  capability: "analise" | "insights" | "comparacao" | "news_topic" | "news_feed" | "screener" = "insights",
  /**
   * Substitui o PRAXIA_SYSTEM_PROMPT por um system curto. Usado em tarefas de
   * extração pura (ex.: traduzir busca → filtros), onde a persona completa da
   * Pra só desperdiçaria tokens.
   */
  systemOverride?: string
): Promise<T> {
  const systemPrompt = systemOverride ?? PRAXIA_SYSTEM_PROMPT;
  // Rate-limit preventivo — barra antes de bater 429 no provider gratuito.
  const gate = checkRateLimit();
  if (!gate.allowed) {
    const seconds = Math.ceil(gate.retryAfterMs / 1000);
    throw new Error(
      `Limite de chamadas IA atingido (Groq free tier). Aguarde ~${seconds}s.`
    );
  }

  const response = await fetch(AI_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1200,
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

  // Telemetria: estimativa de tokens in (system prompt + user) / out (resposta).
  recordCall(
    capability,
    estimateTokens(systemPrompt) + estimateTokens(prompt),
    estimateTokens(String(textContent))
  );

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
