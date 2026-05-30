import { describe, it, expect } from "vitest";
import { buildJustificativaTemplate } from "@/lib/justificativaTemplate";
import type { InvestorProfile, Stock } from "@/types/stock";

/**
 * Unit — template deterministico da justificativa per-stock.
 * Cobre os ramos de riskTerm, interpretarMos (4 faixas) e o fallback
 * sem Graham. Numeros conferidos contra calculateGrahamValue =
 * sqrt(22.5 * lpa * vpa).
 */

function makeStock(overrides: Partial<Stock> = {}): Stock {
  return {
    ticker: "PETR4",
    price: 50,
    cost: 40,
    quantity: 10,
    lpa: 5,
    vpa: 20, // graham = sqrt(22.5*5*20) = sqrt(2250) ≈ 47.43
    roe: 0.18,
    debtToEbitda: 1.5,
    change: 0.5,
    changePercent: 1.0,
    lastUpdated: new Date(0).toISOString(),
    score: 72,
    scoreBreakdown: {
      priceScore: 25,
      profitabilityScore: 15,
      healthScore: 10,
      dividendScore: 10,
      valuationScore: 12,
    },
    isFavorite: false,
    pl: 10,
    pvp: 1.5,
    dividendYield: 0.05,
    evEbitda: 8,
    netMargin: 0.12,
    ebitdaMargin: 0.2,
    ...overrides,
  };
}

const profile = (risk: InvestorProfile["risk"]): InvestorProfile => ({
  risk,
  horizon: "long",
  interests: [],
  completedAt: new Date(0).toISOString(),
});

describe("buildJustificativaTemplate", () => {
  it("traduz cada nivel de risco", () => {
    const stock = makeStock();
    expect(buildJustificativaTemplate(stock, profile("low"))).toContain("perfil conservador");
    expect(buildJustificativaTemplate(stock, profile("high"))).toContain("perfil arrojado");
    expect(buildJustificativaTemplate(stock, profile("mid"))).toContain("perfil moderado");
    expect(buildJustificativaTemplate(stock, null)).toContain("ainda nao definido");
  });

  it("inclui ticker, Graham, score e label", () => {
    const out = buildJustificativaTemplate(makeStock(), profile("mid"));
    expect(out).toContain("PETR4");
    expect(out).toContain("R$ 47.43");
    expect(out).toContain("Score 72/100");
    expect(out).toContain("Observação");
  });

  it("margem confortavel (MoS >= 30%) com direcao 'abaixo'", () => {
    // price 30 vs graham 47.43 → MoS ≈ +36.8%
    const out = buildJustificativaTemplate(makeStock({ price: 30 }), profile("mid"));
    expect(out).toContain("abaixo do Graham");
    expect(out).toContain("margem de seguranca confortavel");
    expect(out).toContain("MoS +");
  });

  it("margem moderada (10–30%) varia o texto por perfil", () => {
    // price 40 vs graham 47.43 → MoS ≈ +15.7%
    const conservador = buildJustificativaTemplate(makeStock({ price: 40 }), profile("low"));
    expect(conservador).toContain("exige atencao para perfil conservador");

    const arrojado = buildJustificativaTemplate(makeStock({ price: 40 }), profile("high"));
    expect(arrojado).toContain("perfil arrojado");
  });

  it("preco proximo do valor intrinseco (-5% a 10%)", () => {
    // price 46 vs graham 47.43 → MoS ≈ +3.0%
    const out = buildJustificativaTemplate(makeStock({ price: 46 }), profile("mid"));
    expect(out).toContain("proximo do valor intrinseco");
  });

  it("sem margem: preco acima do Graham (MoS < -5%)", () => {
    // price 60 vs graham 47.43 → MoS ≈ -26.5%
    const out = buildJustificativaTemplate(makeStock({ price: 60 }), profile("mid"));
    expect(out).toContain("acima do Graham");
    expect(out).toContain("ausencia de margem de seguranca");
    expect(out).toContain("MoS -");
  });

  it("fallback gracioso quando LPA/VPA nao permitem Graham", () => {
    const out = buildJustificativaTemplate(makeStock({ lpa: 0, vpa: 0, score: 45 }), profile("low"));
    expect(out).toContain("Sem dados suficientes");
    expect(out).toContain("Risco Elevado");
    expect(out).not.toContain("R$ 0.00");
  });
});
