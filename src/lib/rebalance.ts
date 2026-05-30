import type { Stock, InvestorProfile } from "@/types/stock";

/**
 * Rebalanceador determinístico (Fase 5 — Feature #3).
 *
 * Gera ordens CONCRETAS de compra/venda para mover a carteira de sua alocação
 * setorial atual em direção a uma alocação-alvo definida pelo usuário. Toda a
 * matemática vive aqui (puro, testável) — a IA (`explicarRebalanceamento` em
 * `ai.ts`) só comenta o plano em linguagem natural; nunca decide quantidades.
 *
 * Regra dura: rebalanceia APENAS entre ativos que o usuário JÁ possui — nunca
 * inventa tickers. Setores-alvo sem ativo na carteira viram `unmetSectors`
 * (a UI orienta a adicionar manualmente, sem fabricar uma ordem).
 */

/** Rótulo de setor canônico — espelha a regra de `lib/portfolio.ts`. */
export function sectorLabel(stock: Stock): string {
  return stock.sector && stock.sector !== "—" ? stock.sector : "Outros";
}

/** Alvo de alocação por setor, em pontos percentuais (0–100). */
export interface RebalanceTarget {
  sector: string;
  pct: number;
}

/** Estado de um setor: onde está vs. onde deveria estar. */
export interface SectorState {
  sector: string;
  currentValue: number;
  currentPct: number;
  targetPct: number;
  /** Alvo − atual em R$ (positivo = comprar; negativo = vender). */
  gapBRL: number;
}

/** Ordem acionável — alimenta `applyTransaction` + `record` (paper-trading). */
export interface RebalanceOrder {
  ticker: string;
  sector: string;
  action: "buy" | "sell";
  shares: number;
  price: number;
  /** shares × price — valor estimado da ordem. */
  estValue: number;
  /** Score do ativo (0–100) — justifica a escolha do ticker. */
  score: number;
}

export interface RebalancePlan {
  totalValue: number;
  sectors: SectorState[];
  orders: RebalanceOrder[];
  /** Setores-alvo sem ativo na carteira para comprar (adicionar manualmente). */
  unmetSectors: { sector: string; neededBRL: number }[];
  /** true quando a soma dos alvos fecha ~100% (tolerância de 1pp). */
  targetsValid: boolean;
}

/** Posições efetivas (quantidade e preço > 0). */
function heldStocks(stocks: Stock[]): Stock[] {
  return stocks.filter((s) => (s.quantity || 0) > 0 && s.price > 0);
}

/** Valor investido total a preço atual. */
function totalValue(stocks: Stock[]): number {
  return heldStocks(stocks).reduce((acc, s) => acc + s.quantity * s.price, 0);
}

/** Valor investido por setor. */
function valueBySector(stocks: Stock[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of heldStocks(stocks)) {
    const label = sectorLabel(s);
    map.set(label, (map.get(label) ?? 0) + s.quantity * s.price);
  }
  return map;
}

/** Setores presentes na carteira, ordenados por valor desc. */
export function portfolioSectors(stocks: Stock[]): string[] {
  return Array.from(valueBySector(stocks).entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label]) => label);
}

/**
 * Sugestão determinística de alvos com base no perfil. Parte da alocação atual
 * e aplica um teto de concentração por setor (conservador 25% · moderado 30% ·
 * arrojado 40%), redistribuindo o excedente proporcionalmente aos demais
 * setores. Resultado em inteiros somando 100. Não chama IA (frugalidade).
 */
export function suggestBalancedTargets(
  stocks: Stock[],
  profile: InvestorProfile | null | undefined
): RebalanceTarget[] {
  const total = totalValue(stocks);
  const byScore = valueBySector(stocks);
  if (total === 0 || byScore.size === 0) return [];

  const cap =
    profile?.risk === "low" ? 25 : profile?.risk === "high" ? 40 : 30;

  // Percentuais atuais.
  let pcts = Array.from(byScore.entries()).map(([sector, value]) => ({
    sector,
    pct: (value / total) * 100,
  }));

  // Itera o teto: corta quem excede e redistribui aos não-capados.
  for (let pass = 0; pass < pcts.length; pass++) {
    const over = pcts.filter((p) => p.pct > cap);
    if (over.length === 0) break;
    const excess = over.reduce((acc, p) => acc + (p.pct - cap), 0);
    const under = pcts.filter((p) => p.pct < cap);
    const underTotal = under.reduce((acc, p) => acc + p.pct, 0);
    pcts = pcts.map((p) => {
      if (p.pct > cap) return { ...p, pct: cap };
      if (underTotal > 0 && p.pct < cap) {
        return { ...p, pct: p.pct + excess * (p.pct / underTotal) };
      }
      return p;
    });
  }

  return roundTo100(pcts);
}

/** Arredonda para inteiros garantindo soma 100 (ajusta o maior resto). */
function roundTo100(pcts: { sector: string; pct: number }[]): RebalanceTarget[] {
  const floored = pcts.map((p) => ({
    sector: p.sector,
    pct: Math.floor(p.pct),
    frac: p.pct - Math.floor(p.pct),
  }));
  let remainder = 100 - floored.reduce((acc, p) => acc + p.pct, 0);
  floored.sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < floored.length && remainder > 0; i++, remainder--) {
    floored[i].pct += 1;
  }
  return floored
    .sort((a, b) => b.pct - a.pct)
    .map(({ sector, pct }) => ({ sector, pct }));
}

/** Valor mínimo de uma ordem para evitar ruído (1 ação ou R$ 50). */
const MIN_ORDER_BRL = 50;

/**
 * Gera o plano de rebalanceamento. Para cada setor com gap material:
 *  - Sobrepeso (gap < 0): vende, começando pelo ativo de MENOR score do setor,
 *    em cascata até cobrir o excesso (ou esgotar as posições).
 *  - Subpeso (gap > 0): compra o ativo de MAIOR score do setor já possuído.
 *    Sem ativo no setor → entra em `unmetSectors`.
 */
export function generateRebalancePlan(
  stocks: Stock[],
  targets: RebalanceTarget[]
): RebalancePlan {
  const held = heldStocks(stocks);
  const total = totalValue(stocks);
  const targetMap = new Map(targets.map((t) => [t.sector, t.pct]));
  const currentBySector = valueBySector(stocks);

  // União de setores presentes + setores-alvo.
  const allSectors = new Set<string>([
    ...currentBySector.keys(),
    ...targetMap.keys(),
  ]);

  const sectors: SectorState[] = Array.from(allSectors)
    .map((sector) => {
      const currentValue = currentBySector.get(sector) ?? 0;
      const targetPct = targetMap.get(sector) ?? 0;
      return {
        sector,
        currentValue,
        currentPct: total > 0 ? (currentValue / total) * 100 : 0,
        targetPct,
        gapBRL: (targetPct / 100) * total - currentValue,
      };
    })
    .sort((a, b) => b.currentValue - a.currentValue);

  const orders: RebalanceOrder[] = [];
  const unmetSectors: { sector: string; neededBRL: number }[] = [];

  for (const st of sectors) {
    if (Math.abs(st.gapBRL) < MIN_ORDER_BRL) continue;

    const sectorHoldings = held.filter((s) => sectorLabel(s) === st.sector);

    if (st.gapBRL < 0) {
      // Sobrepeso → vender. Pior score primeiro, em cascata.
      let remaining = -st.gapBRL;
      const worstFirst = [...sectorHoldings].sort((a, b) => a.score - b.score);
      for (const s of worstFirst) {
        if (remaining < MIN_ORDER_BRL) break;
        const maxByGap = Math.floor(remaining / s.price);
        const shares = Math.min(s.quantity, maxByGap);
        if (shares <= 0) continue;
        orders.push({
          ticker: s.ticker,
          sector: st.sector,
          action: "sell",
          shares,
          price: s.price,
          estValue: shares * s.price,
          score: s.score,
        });
        remaining -= shares * s.price;
      }
    } else {
      // Subpeso → comprar o melhor score do setor.
      if (sectorHoldings.length === 0) {
        unmetSectors.push({ sector: st.sector, neededBRL: st.gapBRL });
        continue;
      }
      const best = [...sectorHoldings].sort((a, b) => b.score - a.score)[0];
      const shares = Math.floor(st.gapBRL / best.price);
      if (shares <= 0) continue;
      orders.push({
        ticker: best.ticker,
        sector: st.sector,
        action: "buy",
        shares,
        price: best.price,
        estValue: shares * best.price,
        score: best.score,
      });
    }
  }

  const sumTargets = targets.reduce((acc, t) => acc + t.pct, 0);

  return {
    totalValue: total,
    sectors,
    orders,
    unmetSectors,
    targetsValid: Math.abs(sumTargets - 100) <= 1,
  };
}
