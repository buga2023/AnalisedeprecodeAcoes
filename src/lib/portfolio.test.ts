import { describe, it, expect } from "vitest";
import {
  totalPortfolioValue,
  totalCostBasis,
  todayChangeValue,
  sectorAllocation,
  dominantSector,
} from "./portfolio";
import type { Stock } from "@/types/stock";

function s(overrides: Partial<Stock> = {}): Stock {
  return {
    ticker: "PETR4",
    price: 30,
    cost: 25,
    quantity: 100,
    lpa: 2,
    vpa: 10,
    roe: 0.15,
    debtToEbitda: 1,
    change: 1,
    changePercent: 1,
    lastUpdated: new Date().toISOString(),
    score: 70,
    scoreBreakdown: { priceScore: 25, profitabilityScore: 15, healthScore: 15, dividendScore: 10, valuationScore: 5 },
    isFavorite: false,
    pl: 8,
    pvp: 1.2,
    dividendYield: 0.05,
    evEbitda: 5,
    netMargin: 0.1,
    ebitdaMargin: 0.2,
    sector: "Energia",
    ...overrides,
  };
}

describe("totalPortfolioValue", () => {
  it("soma price * quantity de todas as posições", () => {
    const stocks = [s({ price: 10, quantity: 100 }), s({ price: 20, quantity: 50 })];
    expect(totalPortfolioValue(stocks)).toBe(2000);
  });
  it("retorna 0 com carteira vazia", () => {
    expect(totalPortfolioValue([])).toBe(0);
  });
  it("trata quantity ausente/0 como 0", () => {
    expect(totalPortfolioValue([s({ price: 10, quantity: 0 })])).toBe(0);
  });
});

describe("totalCostBasis", () => {
  it("soma cost * quantity", () => {
    const stocks = [s({ cost: 5, quantity: 100 }), s({ cost: 10, quantity: 50 })];
    expect(totalCostBasis(stocks)).toBe(1000);
  });
});

describe("todayChangeValue", () => {
  it("soma change * quantity", () => {
    const stocks = [s({ change: 0.5, quantity: 100 }), s({ change: -0.2, quantity: 50 })];
    expect(todayChangeValue(stocks)).toBeCloseTo(50 - 10);
  });
});

describe("sectorAllocation", () => {
  it("retorna lista vazia quando portfolio é zero", () => {
    expect(sectorAllocation([])).toEqual([]);
  });

  it("agrupa por setor e ordena por valor desc", () => {
    const stocks = [
      s({ ticker: "ITUB4", sector: "Bancos", price: 30, quantity: 100 }),
      s({ ticker: "PETR4", sector: "Energia", price: 30, quantity: 200 }),
      s({ ticker: "BBDC4", sector: "Bancos", price: 20, quantity: 100 }),
    ];
    const slices = sectorAllocation(stocks);
    expect(slices[0].label).toBe("Energia");
    expect(slices[0].value).toBe(6000);
    expect(slices[1].label).toBe("Bancos");
    expect(slices[1].value).toBe(5000);
  });

  it("agrupa fatias <4% em 'Outros'", () => {
    const stocks = [
      s({ ticker: "A", sector: "Energia", price: 100, quantity: 100 }),
      s({ ticker: "B", sector: "Tech", price: 1, quantity: 1 }),
    ];
    const slices = sectorAllocation(stocks);
    const labels = slices.map((s) => s.label);
    expect(labels).toContain("Outros");
  });

  it("usa 'Outros' como label quando sector é '—' ou ausente", () => {
    const stocks = [s({ sector: "—", price: 50, quantity: 100 })];
    expect(sectorAllocation(stocks)[0].label).toBe("Outros");
  });
});

describe("dominantSector", () => {
  it("retorna setor que ultrapassa o threshold", () => {
    const stocks = [
      s({ sector: "Tech", price: 100, quantity: 100 }),
      s({ sector: "Bancos", price: 50, quantity: 10 }),
    ];
    const dominant = dominantSector(stocks, 30);
    expect(dominant?.label).toBe("Tech");
  });

  it("retorna null quando nenhum setor ultrapassa", () => {
    const stocks = [
      s({ ticker: "A", sector: "Tech", price: 100, quantity: 50 }),
      s({ ticker: "B", sector: "Bancos", price: 100, quantity: 50 }),
      s({ ticker: "C", sector: "Energia", price: 100, quantity: 50 }),
    ];
    expect(dominantSector(stocks, 50)).toBeNull();
  });
});
