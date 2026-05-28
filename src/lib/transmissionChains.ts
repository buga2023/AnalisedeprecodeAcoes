/**
 * Cadeias de transmissao macro -> setor usadas pela Pra no passo 4 do
 * reasoning_chain. Antes ficavam todas inline no PRAXIA_SYSTEM_PROMPT
 * (~80 linhas hardcoded). Agora as 4 cadeias "sempre relevantes" (politica,
 * SELIC sobe, SELIC cai, dolar) ficam no prompt mestre e estas 4 cadeias
 * setoriais especificas sao injetadas SOB DEMANDA via pickRelevantChains().
 *
 * Cada cadeia segue: gatilho -> indicador -> setor ganha/perde.
 * Use keywords pra decidir se a cadeia eh relevante pro contexto da chamada.
 */

export interface TransmissionChain {
  id: string;
  /** Titulo curto exibido no prompt. */
  title: string;
  /** Texto da cadeia (mesmo formato das chains 1-4 inline). */
  body: string;
  /** Palavras-chave (lowercase) que disparam a injecao. */
  triggers: string[];
}

export const OPTIONAL_TRANSMISSION_CHAINS: TransmissionChain[] = [
  {
    id: "petroleo",
    title: "PETROLEO sobe (conflito ativo, OPEP corta)",
    body: `PETROLEO sobe (conflito ativo, OPEP corta)
    -> PETR3/PETR4/PRIO3: EBITDA expande, DY potencial sobe, divida/EBITDA cai
    -> Aereas (AZUL4, GOLL4), quimicas (UNIP6, BRKM5), plasticos: margem comprime
    -> Inflacao combustivel sobe -> SELIC resiste a cair -> ciclo se reforca`,
    triggers: [
      "petroleo", "petrobras", "petr3", "petr4", "prio", "opep", "brent", "wti",
      "guerra", "conflito", "ira", "ataque", "missil", "oriente medio",
      "aerea", "azul", "gol", "azul4", "goll4",
    ],
  },
  {
    id: "china-minerio",
    title: "CHINA estimula / minerio sobe",
    body: `CHINA estimula / minerio sobe
    -> VALE3, CSNA3, GGBR4, USIM5: EBITDA expande
    -> Inverso: crise imobiliaria China -> minerio cai -> VALE3 sofre forte`,
    triggers: [
      "china", "minerio", "ferro", "vale", "vale3", "csna3", "ggbr4", "usim5",
      "siderurgia", "estimulo chines", "pboc", "imobiliario china", "evergrande",
    ],
  },
  {
    id: "tarifas-eua",
    title: "TARIFAS EUA / guerra comercial",
    body: `TARIFAS EUA / guerra comercial
    -> Exportadoras BR para EUA (siderurgia, EMBR3): PSR e margem caem
    -> China-EUA tensao: agro brasileiro (SLCE3, AGRO3, SOJA3) GANHA por substituicao de soja USA
    -> Tecnologia/semicondutores: volatilidade dispara`,
    triggers: [
      "tarifa", "tariff", "trump", "biden", "guerra comercial", "trade war",
      "embraer", "embr3", "siderurgia", "aco",
      "soja", "agro", "slce", "agro3", "soja3", "semicondutor", "chip",
    ],
  },
  {
    id: "fiscal-br",
    title: "RISCO FISCAL BR piora (arcabouco furado, divida publica)",
    body: `RISCO FISCAL BR piora (arcabouco furado, divida publica)
    -> Curva DI abre, juro longo sobe -> P/L comprime geral (DCF castigado)
    -> FIIs/construtoras caem (Selic alta por mais tempo)
    -> Dolar sobe -> ciclo se reforca (exportadoras GANHAM como hedge natural)
    -> Bancos: efeito ambiguo (NIM ganha de curto, inadimplencia preocupa de medio)`,
    triggers: [
      "arcabouco", "fiscal", "divida publica", "deficit", "primario",
      "haddad", "lula", "fazenda", "tesouro nacional",
      "curva di", "juro longo", "ntn-b", "ipca+",
      "fii", "construtora", "incorporadora", "cyre3", "mrve3", "ezte3",
    ],
  },
];

/**
 * Decide quais cadeias opcionais sao relevantes pro contexto desta chamada.
 * Faz matching simples de keyword (case-insensitive) no texto consolidado.
 *
 * @param context Texto livre que contem manchetes, prompt do usuario, dados macro.
 * @returns Array de cadeias relevantes (vazio se nenhuma bate).
 */
export function pickRelevantChains(context: string): TransmissionChain[] {
  if (!context) return [];
  const haystack = context.toLowerCase();
  return OPTIONAL_TRANSMISSION_CHAINS.filter((chain) =>
    chain.triggers.some((kw) => haystack.includes(kw))
  );
}

/**
 * Monta o bloco <transmission_chains_optional> a ser anexado ao user prompt
 * quando alguma cadeia opcional for relevante. Retorna string vazia se nada
 * bate — assim o token nao eh gasto a toa.
 */
export function buildOptionalChainsBlock(context: string): string {
  const chains = pickRelevantChains(context);
  if (chains.length === 0) return "";
  const body = chains.map((c, i) => `(${i + 5}) ${c.body}`).join("\n\n");
  return `\n<transmission_chains_optional>\nCadeias adicionais relevantes pro contexto desta chamada:\n\n${body}\n</transmission_chains_optional>\n`;
}
