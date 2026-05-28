import type { Stock } from "@/types/stock";
import { sectorAllocation, totalPortfolioValue } from "./portfolio";

export interface PortfolioScoreBreakdown {
  /** Média ponderada (por valor) dos scores individuais — representa qualidade */
  base: number;
  /** Bônus de diversificação via HHI inverso (0–30 pts) */
  diversification: number;
  /** Penalidade quando um setor ultrapassa 40% da carteira */
  overweightPenalty: number;
  /** Score final 0–100 */
  total: number;
}

/**
 * Score 0–100 da carteira inteira.
 *
 * Fórmula:
 *   base              = Σ(stock.score × peso_valor) / total_valor
 *   diversification   = (1 − HHI) × 30          // HHI = Σ(peso_setor²)
 *   overweightPenalty = max(0, maxSectorPct − 40) × 0.3
 *   total             = clamp(base × 0.7 + diversification − overweightPenalty, 0, 100)
 */
export function portfolioScore(stocks: Stock[]): PortfolioScoreBreakdown {
  const owned = stocks.filter((s) => (s.quantity || 0) > 0 && s.price > 0);
  if (owned.length === 0) {
    return { base: 0, diversification: 0, overweightPenalty: 0, total: 0 };
  }

  const totalValue = totalPortfolioValue(owned);
  if (totalValue === 0) {
    return { base: 0, diversification: 0, overweightPenalty: 0, total: 0 };
  }

  // Média ponderada dos scores individuais
  const base = owned.reduce((acc, s) => {
    const weight = (s.quantity * s.price) / totalValue;
    return acc + s.score * weight;
  }, 0);

  // HHI setorial → bônus de diversificação
  const slices = sectorAllocation(owned);
  const hhi = slices.reduce((acc, s) => acc + (s.pct / 100) ** 2, 0);
  const diversification = (1 - hhi) * 30;

  // Penalidade por concentração excessiva
  const maxSectorPct = slices.length > 0 ? Math.max(...slices.map((s) => s.pct)) : 0;
  const overweightPenalty = Math.max(0, (maxSectorPct - 40) * 0.3);

  const total = Math.max(0, Math.min(100, base * 0.7 + diversification - overweightPenalty));

  return { base, diversification, overweightPenalty, total };
}

export function portfolioScoreLabel(score: number): string {
  if (score >= 70) return "Carteira Saudável";
  if (score >= 50) return "Em Desenvolvimento";
  return "Necessita Atenção";
}
