/**
 * Dicas de tutorial por feature — texto curto que explica cada tela na voz do
 * app. Aparecem 1 vez como banner dismissivel no topo da tela; a dispensa fica
 * persistida em localStorage (uma chave so, JSON de keys dispensadas).
 *
 * Logica pura aqui; o componente visual e o FeatureHintBanner.
 */

export type HintKey =
  | "home"
  | "market"
  | "analysis"
  | "stock"
  | "dividends"
  | "rebalance"
  | "news"
  | "compare"
  | "alerts";

interface Hint {
  title: string;
  body: string;
}

export const TUTORIAL_HINTS: Record<HintKey, Hint> = {
  home: {
    title: "Sua carteira num relance",
    body: "Aqui voce ve patrimonio, variacao do dia e um resumo da Pra. Toque numa posicao para abrir os detalhes e a analise da acao.",
  },
  market: {
    title: "Encontre e adicione acoes",
    body: "Busque um ticker (ex: PETR4) ou explore as listas. Toque em adicionar para incluir na carteira — o app calcula o score e o valor justo automaticamente.",
  },
  analysis: {
    title: "O raio-x da carteira",
    body: "Veja o score agregado (0-100), retorno, setor lider e insights da Pra. Use para entender forcas e riscos antes de comprar ou vender.",
  },
  stock: {
    title: "Analise, nao corretora",
    body: "Aqui voce ANALISA a acao: grafico, valor justo de Graham e Bazin, score e o sinal da Pra (COMPRAR/SEGURAR/VENDER e um veredito de valuation, nao uma ordem). Comprar/Vender sao SIMULACOES — nada de dinheiro real nem ordem em corretora.",
  },
  dividends: {
    title: "Calendario de proventos",
    body: "Acompanhe quando cada acao paga dividendos e use “Otimizar renda passiva com IA” para a Pra sugerir ajustes na carteira.",
  },
  rebalance: {
    title: "Rebalanceie com clareza",
    body: "Defina a alocacao-alvo por setor; o app calcula as ordens de compra e venda. A Pra refina a estrategia considerando datas de dividendos e custos.",
  },
  news: {
    title: "Noticias que importam",
    body: "Manchetes das suas acoes com sentimento (positivo/neutro/negativo) classificado pela Pra. Eventos materiais ganham destaque.",
  },
  compare: {
    title: "Compare lado a lado",
    body: "Selecione de 2 a 4 acoes para comparar indicadores e scores numa tabela. A Pra resume qual se encaixa melhor no seu perfil.",
  },
  alerts: {
    title: "Avisos automaticos",
    body: "Crie alertas de preco, margem de seguranca, score ou dividendos. O app avisa quando o gatilho dispara, mesmo com o app fechado.",
  },
};

const STORAGE_KEY = "praxia-tutorial-hints";

function readDismissed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function isHintDismissed(key: HintKey): boolean {
  return readDismissed()[key] === true;
}

export function dismissHint(key: HintKey): void {
  const current = readDismissed();
  current[key] = true;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
}

export function resetTutorialHints(): void {
  localStorage.removeItem(STORAGE_KEY);
}
