import { describe, it, expect } from "vitest";
import { calculateFIIScore, getFIIScoreLabel, estimateMonthlyYield } from "./fiiScore";

describe("calculateFIIScore — DY (40 pts)", () => {
  it("DY > 12% → 40 pts", () => {
    const { total } = calculateFIIScore({ dividendYield: 0.13, pvp: 0 });
    // dyScore=40 + pvpScore=0 + segScore=8 + liq=8 = 56
    expect(total).toBe(56);
  });

  it("DY > 8% e ≤ 12% → 28 pts", () => {
    const { breakdown } = calculateFIIScore({ dividendYield: 0.09, pvp: 0 });
    expect(breakdown.dyScore).toBe(28);
  });

  it("DY > 6% e ≤ 8% → 18 pts", () => {
    const { breakdown } = calculateFIIScore({ dividendYield: 0.07, pvp: 0 });
    expect(breakdown.dyScore).toBe(18);
  });

  it("DY ≤ 4% → 0 pts", () => {
    const { breakdown } = calculateFIIScore({ dividendYield: 0.03, pvp: 0 });
    expect(breakdown.dyScore).toBe(0);
  });
});

describe("calculateFIIScore — P/VP (30 pts)", () => {
  it("P/VP < 0.90 → 30 pts", () => {
    const { breakdown } = calculateFIIScore({ dividendYield: 0, pvp: 0.85 });
    expect(breakdown.pvpScore).toBe(30);
  });

  it("P/VP < 1.0 → 22 pts", () => {
    const { breakdown } = calculateFIIScore({ dividendYield: 0, pvp: 0.95 });
    expect(breakdown.pvpScore).toBe(22);
  });

  it("P/VP < 1.15 → 14 pts", () => {
    const { breakdown } = calculateFIIScore({ dividendYield: 0, pvp: 1.10 });
    expect(breakdown.pvpScore).toBe(14);
  });

  it("P/VP ≥ 1.30 → 0 pts", () => {
    const { breakdown } = calculateFIIScore({ dividendYield: 0, pvp: 1.40 });
    expect(breakdown.pvpScore).toBe(0);
  });

  it("P/VP = 0 (sem dado) → 0 pts", () => {
    const { breakdown } = calculateFIIScore({ dividendYield: 0, pvp: 0 });
    expect(breakdown.pvpScore).toBe(0);
  });
});

describe("calculateFIIScore — segmento (15 pts)", () => {
  it("Logística → 15 pts", () => {
    const { breakdown } = calculateFIIScore({ dividendYield: 0, pvp: 0, segment: "Logística" });
    expect(breakdown.segmentScore).toBe(15);
  });

  it("Lajes Corp. → 15 pts", () => {
    const { breakdown } = calculateFIIScore({ dividendYield: 0, pvp: 0, segment: "Lajes Corp." });
    expect(breakdown.segmentScore).toBe(15);
  });

  it("Shopping → 15 pts", () => {
    const { breakdown } = calculateFIIScore({ dividendYield: 0, pvp: 0, segment: "Shopping" });
    expect(breakdown.segmentScore).toBe(15);
  });

  it("Recebíveis → 10 pts", () => {
    const { breakdown } = calculateFIIScore({ dividendYield: 0, pvp: 0, segment: "Recebíveis" });
    expect(breakdown.segmentScore).toBe(10);
  });

  it("segmento desconhecido → 8 pts neutro", () => {
    const { breakdown } = calculateFIIScore({ dividendYield: 0, pvp: 0, segment: "FII" });
    expect(breakdown.segmentScore).toBe(8);
  });

  it("sem segmento → 8 pts neutro", () => {
    const { breakdown } = calculateFIIScore({ dividendYield: 0, pvp: 0 });
    expect(breakdown.segmentScore).toBe(8);
  });
});

describe("calculateFIIScore — liquidez heurística (15 pts)", () => {
  it("sempre 8 pts (heurística neutra)", () => {
    const { breakdown } = calculateFIIScore({ dividendYield: 0, pvp: 0 });
    expect(breakdown.liquidityScore).toBe(8);
  });
});

describe("calculateFIIScore — total e stockBreakdown", () => {
  it("score máximo = 100 (cap)", () => {
    const { total } = calculateFIIScore({ dividendYield: 0.15, pvp: 0.80, segment: "Logística" });
    // 40+30+15+8 = 93
    expect(total).toBe(93);
    expect(total).toBeLessThanOrEqual(100);
  });

  it("stockBreakdown tem priceScore = pvpScore", () => {
    const { stockBreakdown } = calculateFIIScore({ dividendYield: 0.10, pvp: 0.95, segment: "Shopping" });
    expect(stockBreakdown.priceScore).toBe(22); // pvpScore
    expect(stockBreakdown.dividendScore).toBe(stockBreakdown.profitabilityScore);
  });
});

describe("getFIIScoreLabel", () => {
  it("≥ 80 → Atrativo", () => expect(getFIIScoreLabel(85)).toBe("Atrativo"));
  it("≥ 55 e < 80 → Observação", () => expect(getFIIScoreLabel(60)).toBe("Observação"));
  it("< 55 → Avaliar", () => expect(getFIIScoreLabel(40)).toBe("Avaliar"));
});

describe("estimateMonthlyYield", () => {
  it("calcula rendimento mensal por cota corretamente", () => {
    // DY anual = 12% sobre preço R$100 → R$12/ano → R$1/mês
    expect(estimateMonthlyYield(0.12, 100)).toBeCloseTo(1);
  });

  it("retorna 0 para preço ou DY zerado", () => {
    expect(estimateMonthlyYield(0, 100)).toBe(0);
    expect(estimateMonthlyYield(0.10, 0)).toBe(0);
  });
});
