import { describe, it, expect } from "vitest";
import {
  PRAXIA_SYSTEM_PROMPT,
  describeProfileLine,
  describePortfolioLine,
} from "./praxiaPrompt";
import type { Stock } from "@/types/stock";

function stock(overrides: Partial<Stock> = {}): Stock {
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
    changePercent: 3,
    lastUpdated: "",
    score: 75,
    scoreBreakdown: { priceScore: 0, profitabilityScore: 0, healthScore: 0, dividendScore: 0, valuationScore: 0 },
    isFavorite: false,
    pl: 5,
    pvp: 1,
    dividendYield: 0.05,
    evEbitda: 5,
    netMargin: 0.1,
    ebitdaMargin: 0.2,
    ...overrides,
  };
}

describe("PRAXIA_SYSTEM_PROMPT", () => {
  it("contém regras chave (perfil, fontes, sem emojis)", () => {
    expect(PRAXIA_SYSTEM_PROMPT).toMatch(/Pra/);
    expect(PRAXIA_SYSTEM_PROMPT).toMatch(/PERFIL/);
    expect(PRAXIA_SYSTEM_PROMPT).toMatch(/FONTES/);
    expect(PRAXIA_SYSTEM_PROMPT).toMatch(/NUNCA use emojis/);
  });
});

describe("describeProfileLine", () => {
  it("retorna marcador 'nao definido' quando profile null", () => {
    expect(describeProfileLine(null)).toMatch(/nao definido/);
  });

  it("descreve perfil mid/long/div", () => {
    const out = describeProfileLine({
      risk: "mid",
      horizon: "long",
      interests: ["div"],
      completedAt: "",
    });
    expect(out).toContain("moderado");
    expect(out).toContain("longo");
    expect(out).toContain("dividendos");
  });

  it("descreve perfil low/short/gro+esg", () => {
    const out = describeProfileLine({
      risk: "low",
      horizon: "short",
      interests: ["gro", "esg"],
      completedAt: "",
    });
    expect(out).toContain("conservador");
    expect(out).toContain("curto");
    expect(out).toContain("crescimento");
    expect(out).toContain("ESG");
  });

  it("descreve perfil high/mid/tec", () => {
    const out = describeProfileLine({
      risk: "high",
      horizon: "mid",
      interests: ["tec"],
      completedAt: "",
    });
    expect(out).toContain("arrojado");
    expect(out).toContain("medio");
    expect(out).toContain("tecnologia");
  });

  it("retorna 'nao informado' quando interests vazio", () => {
    const out = describeProfileLine({
      risk: "mid",
      horizon: "mid",
      interests: [],
      completedAt: "",
    });
    expect(out).toContain("nao informado");
  });
});

describe("describePortfolioLine", () => {
  it("retorna marcador 'CARTEIRA ATUAL: vazia.' para lista vazia", () => {
    expect(describePortfolioLine([])).toBe("CARTEIRA ATUAL: vazia.");
  });

  it("lista tickers com qty/preco/var/score", () => {
    const out = describePortfolioLine([stock({ ticker: "PETR4", quantity: 100, price: 30, changePercent: 1.23, score: 75 })]);
    expect(out).toContain("PETR4");
    expect(out).toContain("qty=100");
    expect(out).toContain("R$30.00");
    expect(out).toContain("+1.23%");
    expect(out).toContain("75/100");
  });

  it("prefixo - para variação negativa", () => {
    const out = describePortfolioLine([stock({ changePercent: -2.5 })]);
    expect(out).toContain("-2.50%");
  });
});
