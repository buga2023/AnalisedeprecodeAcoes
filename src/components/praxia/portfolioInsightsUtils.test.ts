import { describe, it, expect, beforeEach } from "vitest";
import {
  portfolioSignature,
  readInsightsCache,
  writeInsightsCache,
  sentimentColor,
  tipoColor,
} from "./portfolioInsightsUtils";
import { PraxiaTokens } from "./tokens";
import type { Stock, ScoreBreakdown } from "@/types/stock";
import type { AIResponse } from "@/lib/ai";

const emptyBreakdown: ScoreBreakdown = {
  priceScore: 0,
  profitabilityScore: 0,
  healthScore: 0,
  dividendScore: 0,
  valuationScore: 0,
};

function makeStock(ticker: string, quantity: number): Stock {
  return {
    ticker,
    price: 10,
    cost: 8,
    quantity,
    lpa: 1,
    vpa: 4,
    roe: 0.1,
    debtToEbitda: 1,
    change: 0,
    changePercent: 0,
    lastUpdated: "",
    score: 50,
    scoreBreakdown: emptyBreakdown,
    isFavorite: false,
    pl: 10,
    pvp: 1,
    dividendYield: 0.05,
    evEbitda: 5,
    netMargin: 0.1,
    ebitdaMargin: 0.2,
    sector: "Energia",
  };
}

const sampleResponse: AIResponse = {
  insights: [],
  resumo: "resumo de teste",
  sentimento: "otimista",
  fontes: [],
};

beforeEach(() => {
  localStorage.clear();
});

describe("portfolioSignature", () => {
  it("ordena os pares ticker:qty alfabeticamente", () => {
    const sig = portfolioSignature([makeStock("VALE3", 5), makeStock("PETR4", 10)]);
    expect(sig).toBe("PETR4:10|VALE3:5");
  });

  it("retorna string vazia para carteira vazia", () => {
    expect(portfolioSignature([])).toBe("");
  });
});

describe("readInsightsCache", () => {
  it("retorna null quando não há cache", () => {
    expect(readInsightsCache("sig")).toBeNull();
  });

  it("retorna o payload quando signature bate e está dentro do TTL", () => {
    writeInsightsCache("sig-a", sampleResponse);
    const out = readInsightsCache("sig-a");
    expect(out?.response.sentimento).toBe("otimista");
    expect(typeof out?.timestamp).toBe("number");
  });

  it("retorna null quando signature não bate (carteira mudou)", () => {
    writeInsightsCache("sig-a", sampleResponse);
    expect(readInsightsCache("sig-b")).toBeNull();
  });

  it("retorna null quando entrada está expirada (>6h)", () => {
    const entry = {
      timestamp: Date.now() - 7 * 60 * 60 * 1000,
      signature: "sig-a",
      response: sampleResponse,
    };
    localStorage.setItem("stocks-ai-portfolio-insights", JSON.stringify(entry));
    expect(readInsightsCache("sig-a")).toBeNull();
  });

  it("retorna null em JSON inválido (não quebra a UI)", () => {
    localStorage.setItem("stocks-ai-portfolio-insights", "{quebrado");
    expect(readInsightsCache("sig-a")).toBeNull();
  });
});

describe("sentimentColor", () => {
  it("mapeia otimista → up, pessimista → down, neutro → warn", () => {
    expect(sentimentColor("otimista")).toBe(PraxiaTokens.up);
    expect(sentimentColor("pessimista")).toBe(PraxiaTokens.down);
    expect(sentimentColor("neutro")).toBe(PraxiaTokens.warn);
  });
});

describe("tipoColor", () => {
  it("mapeia alta → up, baixa → down, alerta → warn, neutro → ink70", () => {
    expect(tipoColor("alta")).toBe(PraxiaTokens.up);
    expect(tipoColor("baixa")).toBe(PraxiaTokens.down);
    expect(tipoColor("alerta")).toBe(PraxiaTokens.warn);
    expect(tipoColor("neutro")).toBe(PraxiaTokens.ink70);
  });
});
