import { describe, it, expect } from "vitest";
import { buildJustificativaTemplate } from "./justificativaTemplate";
import type { Stock, InvestorProfile } from "@/types/stock";

const profile: InvestorProfile = { risk: "mid", horizon: "long", interests: ["div"], completedAt: "2026-01-01T00:00:00Z" };

function base(overrides: Partial<Stock>): Stock {
  return {
    ticker: "PETR4", price: 30, cost: 0, quantity: 0, lpa: 3, vpa: 20, roe: 0.15,
    debtToEbitda: 1, change: 0, changePercent: 0, lastUpdated: "", score: 70,
    scoreBreakdown: { priceScore: 0, profitabilityScore: 0, healthScore: 0, dividendScore: 0, valuationScore: 0 },
    isFavorite: false, pl: 10, pvp: 1.5, dividendYield: 0.05, evEbitda: 6, netMargin: 0.1, ebitdaMargin: 0.2,
    ...overrides,
  };
}

describe("buildJustificativaTemplate", () => {
  it("FII não menciona Graham — usa DY, P/VP e segmento", () => {
    const fii = base({ ticker: "HGLG11", assetType: "fii", sector: "Logística", pvp: 0.98, dividendYield: 0.085, score: 91 });
    const txt = buildJustificativaTemplate(fii, profile);
    expect(txt).not.toMatch(/Graham\s+R\$|abaixo do Graham|valor justo de Graham/i);
    expect(txt).toContain("FII de Logística");
    expect(txt).toContain("DY 8.5%");
    expect(txt).toContain("P/VP 0.98");
    expect(txt).toContain("91/100");
    expect(txt).toMatch(/próximo do valor patrimonial/i);
  });

  it("ação comum continua citando Graham (regressão)", () => {
    const acao = base({ ticker: "PETR4", price: 30, lpa: 3, vpa: 20 });
    const txt = buildJustificativaTemplate(acao, profile);
    expect(txt).toMatch(/Graham/);
  });
});
