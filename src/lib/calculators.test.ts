import { describe, it, expect } from "vitest";
import {
  calculateGrahamValue,
  calculateBazinCeiling,
  calculateGrahamVI,
  calculateGrahamGrowth,
  calculateMargin,
  getSignal,
  calculateFullValuation,
  calculateROI,
  calculateROIC,
  calculateMarginOfSafety,
  getValuationStatus,
  calculateStockScore,
  getScoreLabel,
} from "./calculators";

describe("calculateGrahamValue", () => {
  it("retorna sqrt(22.5 * LPA * VPA) com inputs positivos", () => {
    expect(calculateGrahamValue(2, 10)).toBeCloseTo(Math.sqrt(450), 5);
  });
  it("retorna 0 quando LPA ou VPA é zero/negativo", () => {
    expect(calculateGrahamValue(0, 10)).toBe(0);
    expect(calculateGrahamValue(2, 0)).toBe(0);
    expect(calculateGrahamValue(-1, 10)).toBe(0);
  });
});

describe("calculateBazinCeiling", () => {
  it("retorna DPA / 0.06", () => {
    expect(calculateBazinCeiling(3)).toBeCloseTo(50, 5);
  });
  it("retorna null quando DPA é null/<=0", () => {
    expect(calculateBazinCeiling(null)).toBeNull();
    expect(calculateBazinCeiling(0)).toBeNull();
    expect(calculateBazinCeiling(-2)).toBeNull();
  });
});

describe("calculateGrahamVI", () => {
  it("retorna VI quando inputs válidos", () => {
    expect(calculateGrahamVI(2, 10)).toBeCloseTo(Math.sqrt(450), 5);
  });
  it("retorna null quando algum input é null/<=0", () => {
    expect(calculateGrahamVI(null, 10)).toBeNull();
    expect(calculateGrahamVI(2, null)).toBeNull();
    expect(calculateGrahamVI(0, 10)).toBeNull();
    expect(calculateGrahamVI(2, -1)).toBeNull();
  });
});

describe("calculateGrahamGrowth", () => {
  it("usa fórmula LPA × (8.5 + 2g) com growth padrão 7", () => {
    expect(calculateGrahamGrowth(2)).toBeCloseTo(2 * (8.5 + 14), 5);
  });
  it("aceita growth customizado", () => {
    expect(calculateGrahamGrowth(2, 5)).toBeCloseTo(2 * 18.5, 5);
  });
  it("retorna null quando LPA inválido", () => {
    expect(calculateGrahamGrowth(null)).toBeNull();
    expect(calculateGrahamGrowth(0)).toBeNull();
    expect(calculateGrahamGrowth(-1)).toBeNull();
  });
});

describe("calculateMargin", () => {
  it("retorna margem percentual quando inputs válidos", () => {
    expect(calculateMargin(100, 80)).toBeCloseTo(20, 5);
    expect(calculateMargin(100, 120)).toBeCloseTo(-20, 5);
  });
  it("retorna null quando fairValue=0 ou inputs null", () => {
    expect(calculateMargin(null, 100)).toBeNull();
    expect(calculateMargin(100, null)).toBeNull();
    expect(calculateMargin(0, 100)).toBeNull();
  });
});

describe("getSignal", () => {
  it("retorna Comprar para margem > 0", () => {
    expect(getSignal(15)).toBe("Comprar");
  });
  it("retorna Caro para margem <= 0", () => {
    expect(getSignal(-3)).toBe("Caro");
    expect(getSignal(0)).toBe("Caro");
  });
  it("retorna Sem dados quando margem null", () => {
    expect(getSignal(null)).toBe("Sem dados");
  });
});

describe("calculateFullValuation", () => {
  const row = { ticker: "PETR4", avgCost: 30, dpa: 3, eps: 2, bvps: 10, quantity: 100 };

  it("calcula bazin, graham e graham growth com preço presente", () => {
    const v = calculateFullValuation(row, 45);
    expect(v.bazinCeiling).toBeCloseTo(50, 5);
    expect(v.bazinSignal).toBe("Comprar");
    expect(v.grahamVI).toBeCloseTo(Math.sqrt(450), 5);
    expect(v.grahamGrowth).toBeCloseTo(2 * 22.5, 5);
    expect(v.roi).toBeCloseTo(50, 5); // (45-30)/30 * 100
    expect(v.patrimony).toBeCloseTo(4500, 5);
    expect(v.fetchStatus).toBe("success");
  });

  it("marca fetchStatus loading quando preço null", () => {
    const v = calculateFullValuation(row, null);
    expect(v.fetchStatus).toBe("loading");
    expect(v.roi).toBeNull();
    expect(v.patrimony).toBeNull();
    expect(v.bazinMargin).toBeNull();
  });

  it("respeita growth customizado", () => {
    const v = calculateFullValuation(row, 45, 10);
    expect(v.grahamGrowth).toBeCloseTo(2 * (8.5 + 20), 5);
  });
});

describe("calculateROI", () => {
  it("retorna fração de variação", () => {
    expect(calculateROI(120, 100)).toBeCloseTo(0.2, 5);
    expect(calculateROI(80, 100)).toBeCloseTo(-0.2, 5);
  });
  it("retorna 0 quando custo <= 0", () => {
    expect(calculateROI(120, 0)).toBe(0);
    expect(calculateROI(120, -5)).toBe(0);
  });
});

describe("calculateROIC", () => {
  it("retorna 0 quando EBITDA não positivo", () => {
    expect(calculateROIC(0, 100, 1)).toBe(0);
    expect(calculateROIC(-5, 100, 1)).toBe(0);
  });
  it("retorna 0 quando divida e D/E zerados", () => {
    expect(calculateROIC(100, 0, 0)).toBe(0);
  });
  it("normaliza debtToEquity em percentual (>5 = %)", () => {
    const r = calculateROIC(100, 1000, 75); // D/E vem como 75 → vira 0.75
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThanOrEqual(1);
  });
  it("clampa o resultado em [-1, 1]", () => {
    const r = calculateROIC(1e9, 1, 0.001);
    expect(r).toBeLessThanOrEqual(1);
    expect(r).toBeGreaterThanOrEqual(-1);
  });
  it("calcula valor coerente em cenário típico", () => {
    const r = calculateROIC(100, 200, 1); // ebit=75, nopat=49.5; equity=200, IC=400 → 0.12375
    expect(r).toBeCloseTo(0.12375, 4);
  });
});

describe("calculateMarginOfSafety", () => {
  it("retorna percentual quando VI > preço", () => {
    expect(calculateMarginOfSafety(80, 100)).toBeCloseTo(20, 5);
  });
  it("retorna 0 quando VI <= 0", () => {
    expect(calculateMarginOfSafety(80, 0)).toBe(0);
  });
});

describe("getValuationStatus", () => {
  it("retorna Subvalorizada com >10% de desconto", () => {
    expect(getValuationStatus(80, 100)).toBe("Subvalorizada");
  });
  it("retorna Sobrevalorizada com >10% de ágio", () => {
    expect(getValuationStatus(120, 100)).toBe("Sobrevalorizada");
  });
  it("retorna Justo no range +-10%", () => {
    expect(getValuationStatus(105, 100)).toBe("Justo");
  });
  it("retorna Justo quando VI <= 0", () => {
    expect(getValuationStatus(100, 0)).toBe("Justo");
  });
});

describe("calculateStockScore", () => {
  it("retorna 100 no cenário ideal", () => {
    const { total, breakdown } = calculateStockScore({
      price: 10,
      grahamValue: 30,
      roe: 0.25,
      debtToEbitda: 1.0,
      dividendYield: 0.08,
      pl: 8,
      evEbitda: 5,
    });
    expect(total).toBe(100);
    expect(breakdown.priceScore).toBe(25);
    expect(breakdown.profitabilityScore).toBe(20);
    expect(breakdown.healthScore).toBe(20);
    expect(breakdown.dividendScore).toBe(20);
    expect(breakdown.valuationScore).toBe(15);
  });

  it("zera price/profit/health/div quando indicadores fracos", () => {
    const { breakdown } = calculateStockScore({
      price: 100,
      grahamValue: 30,
      roe: 0.05,
      debtToEbitda: 5,
      dividendYield: 0.01,
      pl: 50,
      evEbitda: 30,
    });
    expect(breakdown.priceScore).toBe(0);
    expect(breakdown.profitabilityScore).toBe(0);
    expect(breakdown.healthScore).toBe(0);
    expect(breakdown.dividendScore).toBe(0);
    expect(breakdown.valuationScore).toBe(0);
  });

  it("aplica tiers intermediários (ROE 15-20% → 15pts, DY 4-6% → 10pts)", () => {
    const { breakdown } = calculateStockScore({
      price: 50,
      grahamValue: 40,
      roe: 0.16,
      debtToEbitda: 1.8,
      dividendYield: 0.05,
      pl: 15,
      evEbitda: 8,
    });
    expect(breakdown.profitabilityScore).toBe(15);
    expect(breakdown.healthScore).toBe(15);
    expect(breakdown.dividendScore).toBe(10);
    expect(breakdown.valuationScore).toBe(5 + 4);
  });

  it("aplica tier de menor pontuação (ROE 10-15% → 10pts, P/L 20-30 → 2pts, EV/EBITDA 12-20 → 1pt)", () => {
    const { breakdown } = calculateStockScore({
      price: 50,
      grahamValue: 0,
      roe: 0.12,
      debtToEbitda: 2.5,
      dividendYield: 0.03,
      pl: 25,
      evEbitda: 15,
    });
    expect(breakdown.priceScore).toBe(0);
    expect(breakdown.profitabilityScore).toBe(10);
    expect(breakdown.healthScore).toBe(10);
    expect(breakdown.dividendScore).toBe(0);
    expect(breakdown.valuationScore).toBe(2 + 1);
  });
});

describe("getScoreLabel", () => {
  it("retorna Compra Forte acima de 80", () => {
    expect(getScoreLabel(85)).toBe("Compra Forte");
  });
  it("retorna Observação entre 50 e 80", () => {
    expect(getScoreLabel(75)).toBe("Observação");
    expect(getScoreLabel(50)).toBe("Observação");
  });
  it("retorna Risco Elevado abaixo de 50", () => {
    expect(getScoreLabel(40)).toBe("Risco Elevado");
  });
});
