/**
 * Template deterministico para a "justificativa" da analise per-stock.
 *
 * Antes a IA gastava ~150 tokens reescrevendo Graham/MoS/Score/Label —
 * dados que JA temos calculados pelo app. Agora o template cobre essa
 * parte "mecanica" e a IA fica responsavel SO pela camada qualitativa
 * (macro/noticia) em 1-2 frases.
 *
 * Filosofia: deixar visivel pro usuario os numeros que sustentam a tese,
 * sem o LLM precisar prosa-los toda vez.
 */

import type { InvestorProfile, Stock } from "@/types/stock";
import { calculateGrahamValue, calculateMarginOfSafety, getScoreLabel } from "./calculators";

function riskTerm(profile: InvestorProfile | null): string {
  if (!profile) return "ainda nao definido";
  if (profile.risk === "low") return "conservador";
  if (profile.risk === "high") return "arrojado";
  return "moderado";
}

function interpretarMos(mosPct: number, profile: InvestorProfile | null): string {
  const risk = profile?.risk ?? "mid";
  if (mosPct >= 30) {
    return "margem de seguranca confortavel — preco desconta o valor intrinseco com folga";
  }
  if (mosPct >= 10) {
    return risk === "low"
      ? "margem moderada — exige atencao para perfil conservador"
      : "margem moderada — ainda dentro do alvo para perfil " + (risk === "high" ? "arrojado" : "moderado");
  }
  if (mosPct >= -5) {
    return "preco proximo do valor intrinseco — sem grande desconto nem premio";
  }
  return "preco acima do valor intrinseco (Graham) — ausencia de margem de seguranca";
}

/**
 * Monta a frase deterministica que cobre os numeros centrais.
 * Saida exemplo:
 *   "Pelo seu perfil moderado, PETR4 negocia 12.4% abaixo do Graham
 *    (R$ 47.18), com Score 72/100 (Observacao) e MoS +12.4% — margem
 *    moderada, ainda dentro do alvo para perfil moderado."
 */
export function buildJustificativaTemplate(stock: Stock, profile: InvestorProfile | null): string {
  const graham = calculateGrahamValue(stock.lpa, stock.vpa);
  const hasGraham = graham > 0 && Number.isFinite(graham);

  if (!hasGraham) {
    // Sem Graham (LPA/VPA zerados ou negativos) — template degrada graciosamente.
    return `Pelo seu perfil ${riskTerm(profile)}, ${stock.ticker} tem Score ${stock.score}/100 (${getScoreLabel(stock.score)}). Sem dados suficientes para calcular o valor intrinseco (Graham) — analise abaixo cobre o contexto qualitativo.`;
  }

  const mosPct = calculateMarginOfSafety(stock.price, graham); // ja em percentual
  const direcao = stock.price < graham ? "abaixo" : "acima";
  const absPct = Math.abs(((graham - stock.price) / graham) * 100);

  return [
    `Pelo seu perfil ${riskTerm(profile)},`,
    `${stock.ticker} negocia ${absPct.toFixed(1)}% ${direcao} do Graham (R$ ${graham.toFixed(2)}),`,
    `com Score ${stock.score}/100 (${getScoreLabel(stock.score)}) e MoS ${mosPct >= 0 ? "+" : ""}${mosPct.toFixed(1)}%`,
    `— ${interpretarMos(mosPct, profile)}.`,
  ].join(" ");
}
