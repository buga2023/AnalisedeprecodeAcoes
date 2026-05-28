import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchFundamentalsFromAI,
  mergeAIFundamentalsIntoStock,
  quartersFromAI,
  type FundamentalsResponse,
} from "./fundamentals";
import type { Stock } from "@/types/stock";

const aiResponse: FundamentalsResponse = {
  ticker: "PETR4",
  empresa: "Petrobras",
  geradoEm: "2025-01-01T00:00:00.000Z",
  estimadoPorIA: true,
  fontes: ["Release oficial"],
  aviso: "Estimado por IA",
  fundamentais: {
    pl: { value: 5, unit: "ratio", confianca: "alta", referencia: "Release 3T24" },
    dividendYield: { value: 0.08, unit: "pct", confianca: "alta", referencia: "Release 3T24" },
    roe: { value: 0.18, unit: "pct", confianca: "alta", referencia: "Release 3T24" },
    margemSeguranca: { value: 0.25, unit: "pct", confianca: "media", referencia: "Calculo" },
  },
  trimestres: [
    {
      periodo: "3T24",
      receita: 100,
      lucroLiquido: 20,
      ebitda: 50,
      margem: 0.2,
      comentario: "ok",
      tipo: "real",
      referencia: "Release 3T24",
    },
  ],
};

function baseStock(overrides: Partial<Stock> = {}): Stock {
  return {
    ticker: "PETR4",
    price: 30,
    cost: 0,
    quantity: 0,
    lpa: 0,
    vpa: 0,
    roe: 0,
    debtToEbitda: 0,
    change: 0,
    changePercent: 0,
    lastUpdated: "",
    score: 0,
    scoreBreakdown: { priceScore: 0, profitabilityScore: 0, healthScore: 0, dividendScore: 0, valuationScore: 0 },
    isFavorite: false,
    pl: 0,
    pvp: 0,
    dividendYield: 0,
    evEbitda: 0,
    netMargin: 0,
    ebitdaMargin: 0,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("fetchFundamentalsFromAI", () => {
  it("retorna null em status não-ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    expect(await fetchFundamentalsFromAI("PETR4")).toBeNull();
  });

  it("retorna o payload em sucesso e cacheia", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => aiResponse });
    vi.stubGlobal("fetch", fetchMock);
    const out = await fetchFundamentalsFromAI("PETR4", 30);
    expect(out?.ticker).toBe("PETR4");
    // cacheado: segunda chamada não bate em fetch
    const out2 = await fetchFundamentalsFromAI("PETR4", 30);
    expect(out2?.ticker).toBe("PETR4");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retorna null quando fetch lança", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("rede")));
    expect(await fetchFundamentalsFromAI("ZZZZ4")).toBeNull();
  });

  it("retorna null quando payload sem fundamentais", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ticker: "PETR4" }) })
    );
    expect(await fetchFundamentalsFromAI("PETR4")).toBeNull();
  });
});

describe("mergeAIFundamentalsIntoStock", () => {
  it("preenche apenas campos zerados e marca aiEstimated", () => {
    const merged = mergeAIFundamentalsIntoStock(baseStock(), aiResponse);
    expect(merged.pl).toBe(5);
    expect(merged.dividendYield).toBe(0.08);
    expect(merged.roe).toBe(0.18);
    expect(merged.marginOfSafety).toBeCloseTo(25); // 0.25 → 25%
    expect(merged.aiEstimated?.fields).toEqual(
      expect.arrayContaining(["pl", "dividendYield", "roe", "marginOfSafety"])
    );
  });

  it("não sobrescreve campos já preenchidos", () => {
    const stock = baseStock({ pl: 99, dividendYield: 0.5 });
    const merged = mergeAIFundamentalsIntoStock(stock, aiResponse);
    expect(merged.pl).toBe(99);
    expect(merged.dividendYield).toBe(0.5);
    expect(merged.roe).toBe(0.18);
  });

  it("não marca aiEstimated quando nada foi preenchido", () => {
    const stock = baseStock({ pl: 5, dividendYield: 0.08, roe: 0.18, marginOfSafety: 1 });
    const merged = mergeAIFundamentalsIntoStock(stock, aiResponse);
    expect(merged.aiEstimated).toBeUndefined();
  });
});

describe("quartersFromAI", () => {
  it("mapeia trimestres da IA para Relatorio", () => {
    const list = quartersFromAI(aiResponse);
    expect(list).toHaveLength(1);
    expect(list[0].ticker).toBe("PETR4");
    expect(list[0].resultado).toBe("positivo");
    expect(list[0].aiEstimated).toBe(true);
    expect(list[0].periodo).toBe("3T24");
  });

  it("trata trimestres ausentes", () => {
    expect(quartersFromAI({ ...aiResponse, trimestres: [] })).toEqual([]);
  });

  it("marca resultado negativo quando lucro < 0", () => {
    const out = quartersFromAI({
      ...aiResponse,
      trimestres: [{ ...aiResponse.trimestres[0], lucroLiquido: -5 }],
    });
    expect(out[0].resultado).toBe("negativo");
  });
});
