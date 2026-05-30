import { describe, it, expect } from "vitest";
import { mapQuoteToStock } from "./stockMapper";
import type { BrapiQuoteResult } from "@/lib/api";

function baseQuote(overrides: Partial<BrapiQuoteResult>): BrapiQuoteResult {
  return {
    symbol: "PETR4", shortName: "PETROLEO BRASILEIRO", longName: "PETROLEO BRASILEIRO S.A.",
    currency: "BRL", regularMarketPrice: 30, regularMarketChange: 0, regularMarketChangePercent: 0,
    regularMarketTime: "2026-05-29T12:00:00Z", earningsPerShare: 3, priceEarnings: 10,
    bookValue: 20, dividendYield: 0.08, ...overrides,
  } as BrapiQuoteResult;
}

describe("mapQuoteToStock — FIIs", () => {
  it("marca FII, segmento e score FII > 0", () => {
    const fii = mapQuoteToStock(baseQuote({
      symbol: "HGLG11", shortName: "CSHG LOGISTICA FDO INV IMOB", longName: "CSHG LOGISTICA FDO INV IMOB",
      bookValue: 160, regularMarketPrice: 150, dividendYield: 0.09,
    }));
    expect(fii.assetType).toBe("fii");
    expect(fii.sector).toBe("Logística");
    expect(fii.score).toBeGreaterThan(0);
  });
  it("unit de ação (SANB11) continua sendo stock", () => {
    expect(mapQuoteToStock(baseQuote({ symbol: "SANB11", shortName: "BANCO SANTANDER BRASIL", longName: "BANCO SANTANDER BRASIL SA" })).assetType).toBe("stock");
  });
  it("ação comum é stock", () => {
    expect(mapQuoteToStock(baseQuote({})).assetType).toBe("stock");
  });
});
