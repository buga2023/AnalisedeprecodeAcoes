import type { Stock } from "@/types/stock";
import { sectorAllocation, totalPortfolioValue } from "@/lib/portfolio";
import type { SectorSlice } from "@/lib/portfolio";

export interface RebalanceOrder {
  ticker: string;
  name: string;
  sector: string;
  type: "buy" | "sell";
  shares: number;
  price: number;
  estimatedValue: number;
  reason: string;
  stock: Stock;
}

export interface RebalancePlan {
  orders: RebalanceOrder[];
  slices: SectorSlice[];
  totalValue: number;
  /** Setores com gap ≥ limiar mas sem ativo elegível para negociar. */
  ungrouped: string[];
}

// Não gera ordem abaixo desse valor (evita ruído de centavos).
const MIN_ORDER_VALUE = 20;

/** Agrupa os stocks por setor e retorna o de maior/menor score. */
function stocksBySector(stocks: Stock[]): Map<string, Stock[]> {
  const map = new Map<string, Stock[]>();
  for (const s of stocks) {
    if ((s.quantity ?? 0) <= 0 && s.price <= 0) continue;
    const sector = s.sector && s.sector !== "—" ? s.sector : "Outros";
    const list = map.get(sector) ?? [];
    list.push(s);
    map.set(sector, list);
  }
  return map;
}

/**
 * Gera as ordens de rebalanceamento a partir da alocação atual e do alvo
 * informado pelo usuário (percentuais por setor, deve somar 100).
 *
 * Algoritmo:
 *   Para cada setor com gap ≥ MIN_ORDER_VALUE:
 *     - BUY: escolhe o ativo com maior score do setor
 *     - SELL: escolhe o ativo com menor score do setor (com posição > 0)
 *   Arredonda para baixo (shares inteiros), sem vender mais do que se tem.
 */
export function generateRebalanceOrders(
  stocks: Stock[],
  targetPcts: Record<string, number>
): RebalancePlan {
  const totalValue = totalPortfolioValue(stocks);
  const slices = sectorAllocation(stocks);
  const bySector = stocksBySector(stocks);

  const orders: RebalanceOrder[] = [];
  const ungrouped: string[] = [];

  const allSectors = new Set([
    ...slices.map((s) => s.label),
    ...Object.keys(targetPcts),
  ]);

  for (const sector of allSectors) {
    const targetPct = targetPcts[sector] ?? 0;
    const slice = slices.find((s) => s.label === sector);
    const currentValue = slice?.value ?? 0;
    const targetValue = (targetPct / 100) * totalValue;
    const gap = targetValue - currentValue; // + = need to buy, - = need to sell

    if (Math.abs(gap) < MIN_ORDER_VALUE) continue;

    const candidates = bySector.get(sector) ?? [];

    if (gap > 0) {
      // BUY: pick highest-score candidate
      const best = [...candidates].sort((a, b) => b.score - a.score)[0];
      if (!best || best.price <= 0) {
        ungrouped.push(sector);
        continue;
      }
      const shares = Math.floor(gap / best.price);
      if (shares < 1) continue;
      orders.push({
        ticker: best.ticker,
        name: best.name ?? best.ticker,
        sector,
        type: "buy",
        shares,
        price: best.price,
        estimatedValue: shares * best.price,
        reason: `${sector} está ${((slice?.pct ?? 0)).toFixed(1)}% da carteira (alvo ${targetPct}%)`,
        stock: best,
      });
    } else {
      // SELL: pick lowest-score candidate that has a position
      const owned = candidates.filter((s) => (s.quantity ?? 0) > 0);
      if (owned.length === 0) {
        ungrouped.push(sector);
        continue;
      }
      const worst = [...owned].sort((a, b) => a.score - b.score)[0];
      const sharesToSell = Math.min(
        Math.floor(Math.abs(gap) / worst.price),
        worst.quantity
      );
      if (sharesToSell < 1) continue;
      orders.push({
        ticker: worst.ticker,
        name: worst.name ?? worst.ticker,
        sector,
        type: "sell",
        shares: sharesToSell,
        price: worst.price,
        estimatedValue: sharesToSell * worst.price,
        reason: `${sector} está ${((slice?.pct ?? 0)).toFixed(1)}% da carteira (alvo ${targetPct}%)`,
        stock: worst,
      });
    }
  }

  // Ordenar: vendas antes de compras (libera capital primeiro)
  orders.sort((a, b) => {
    if (a.type !== b.type) return a.type === "sell" ? -1 : 1;
    return b.estimatedValue - a.estimatedValue;
  });

  return { orders, slices, totalValue, ungrouped };
}

/** Normaliza um mapa de percentuais para somar exatamente 100. */
export function normalizePcts(pcts: Record<string, number>): Record<string, number> {
  const total = Object.values(pcts).reduce((s, v) => s + v, 0);
  if (total === 0) return pcts;
  return Object.fromEntries(
    Object.entries(pcts).map(([k, v]) => [k, (v / total) * 100])
  );
}
