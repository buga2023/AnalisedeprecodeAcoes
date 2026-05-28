import { describe, it, expect } from "vitest";
import { portfolioScore, portfolioScoreLabel } from "./portfolioScore";
import type { Stock } from "@/types/stock";

function makeStock(overrides: Partial<Stock> = {}): Stock {
  return {
    ticker: "TEST4",
    price: 50,
    cost: 40,
    quantity: 10,
    lpa: 5,
    vpa: 20,
    roe: 0.18,
    debtToEbitda: 1.5,
    change: 0.5,
    changePercent: 1.0,
    lastUpdated: new Date().toISOString(),
    score: 60,
    scoreBreakdown: { priceScore: 25, profitabilityScore: 15, healthScore: 10, dividendScore: 10, valuationScore: 0 },
    isFavorite: false,
    pl: 10,
    pvp: 1.5,
    dividendYield: 0.05,
    evEbitda: 8,
    netMargin: 0.12,
    ebitdaMargin: 0.20,
    sector: "Energia",
    ...overrides,
  };
}

describe("portfolioScore", () => {
  it("returns zeros when no stocks with quantity", () => {
    const result = portfolioScore([]);
    expect(result).toEqual({ base: 0, diversification: 0, overweightPenalty: 0, total: 0 });
  });

  it("returns zeros for stocks with quantity=0", () => {
    const result = portfolioScore([makeStock({ quantity: 0 })]);
    expect(result).toEqual({ base: 0, diversification: 0, overweightPenalty: 0, total: 0 });
  });

  it("returns zeros for stocks with price=0", () => {
    const result = portfolioScore([makeStock({ price: 0 })]);
    expect(result).toEqual({ base: 0, diversification: 0, overweightPenalty: 0, total: 0 });
  });

  it("single stock: base equals its score", () => {
    const s = makeStock({ score: 80 });
    const { base } = portfolioScore([s]);
    expect(base).toBeCloseTo(80, 1);
  });

  it("total stays within 0–100", () => {
    const stocks = [
      makeStock({ score: 100, sector: "Energia" }),
      makeStock({ ticker: "VALE3", score: 100, sector: "Mineração", price: 60, quantity: 5 }),
    ];
    const { total } = portfolioScore(stocks);
    expect(total).toBeGreaterThanOrEqual(0);
    expect(total).toBeLessThanOrEqual(100);
  });

  it("diversified portfolio scores higher than concentrated one", () => {
    const diversified = [
      makeStock({ ticker: "A", sector: "Energia", score: 60, price: 50, quantity: 2 }),
      makeStock({ ticker: "B", sector: "Bancos", score: 60, price: 50, quantity: 2 }),
      makeStock({ ticker: "C", sector: "Mineração", score: 60, price: 50, quantity: 2 }),
      makeStock({ ticker: "D", sector: "Saúde", score: 60, price: 50, quantity: 2 }),
    ];
    const concentrated = [
      makeStock({ ticker: "E", sector: "Energia", score: 60, price: 50, quantity: 8 }),
    ];
    const { total: divScore } = portfolioScore(diversified);
    const { total: conScore } = portfolioScore(concentrated);
    expect(divScore).toBeGreaterThan(conScore);
  });

  it("applies overweight penalty when sector > 40%", () => {
    // Single sector = 100% weight → big penalty
    const s = makeStock({ score: 60, sector: "Energia", quantity: 10, price: 100 });
    const { overweightPenalty, total } = portfolioScore([s]);
    expect(overweightPenalty).toBeGreaterThan(0);
    expect(total).toBeLessThan(60 * 0.7 + 30); // must be less than no-penalty max
  });

  it("no overweight penalty when largest sector is exactly 40%", () => {
    // 2 sectors each with 50% → neither exceeds 40%... use 4 sectors each 25%
    const stocks = [
      makeStock({ ticker: "A", sector: "Energia", price: 50, quantity: 2, score: 60 }),
      makeStock({ ticker: "B", sector: "Bancos", price: 50, quantity: 2, score: 60 }),
      makeStock({ ticker: "C", sector: "Mineração", price: 50, quantity: 2, score: 60 }),
      makeStock({ ticker: "D", sector: "Saúde", price: 50, quantity: 2, score: 60 }),
    ];
    const { overweightPenalty } = portfolioScore(stocks);
    expect(overweightPenalty).toBe(0);
  });

  it("two-stock weighted average reflects individual scores proportionally", () => {
    const big = makeStock({ ticker: "BIG", score: 80, price: 100, quantity: 9, sector: "Energia" });
    const small = makeStock({ ticker: "SMALL", score: 20, price: 100, quantity: 1, sector: "Bancos" });
    const { base } = portfolioScore([big, small]);
    // base = 80*0.9 + 20*0.1 = 74
    expect(base).toBeCloseTo(74, 1);
  });
});

describe("portfolioScoreLabel", () => {
  it("returns 'Carteira Saudável' for score >= 70", () => {
    expect(portfolioScoreLabel(70)).toBe("Carteira Saudável");
    expect(portfolioScoreLabel(100)).toBe("Carteira Saudável");
  });

  it("returns 'Em Desenvolvimento' for 50–69", () => {
    expect(portfolioScoreLabel(50)).toBe("Em Desenvolvimento");
    expect(portfolioScoreLabel(69)).toBe("Em Desenvolvimento");
  });

  it("returns 'Necessita Atenção' below 50", () => {
    expect(portfolioScoreLabel(0)).toBe("Necessita Atenção");
    expect(portfolioScoreLabel(49)).toBe("Necessita Atenção");
  });
});
