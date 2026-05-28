import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchStockQuote,
  fetchAvailableStocks,
  fetchStockHistory,
  fetchMultipleQuotes,
  searchStocks,
  TickerLookupError,
} from "./api";

function mockFetch(handler: (url: string) => Response) {
  return vi.fn((input: RequestInfo | URL) => Promise.resolve(handler(String(input))));
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchStockQuote", () => {
  it("retorna o primeiro resultado em sucesso", async () => {
    const payload = {
      results: [
        {
          symbol: "PETR4",
          shortName: "Petrobras",
          longName: "Petroleo Brasileiro SA",
          currency: "BRL",
          regularMarketPrice: 30,
          regularMarketChange: 1,
          regularMarketChangePercent: 3,
          regularMarketTime: new Date().toISOString(),
          earningsPerShare: 2,
          priceEarnings: 5,
        },
      ],
      requestedAt: "",
      took: "",
    };
    vi.stubGlobal(
      "fetch",
      mockFetch(
        () =>
          new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } })
      )
    );
    const out = await fetchStockQuote("PETR4");
    expect(out.symbol).toBe("PETR4");
  });

  it("lança TickerLookupError em 404 com sugestões", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(
        () =>
          new Response(JSON.stringify({ error: "não encontrado", suggestions: [{ stock: "PETR3" }] }), {
            status: 404,
          })
      )
    );
    await expect(fetchStockQuote("XXX9")).rejects.toBeInstanceOf(TickerLookupError);
  });

  it("lança erro genérico em 429", async () => {
    vi.stubGlobal("fetch", mockFetch(() => new Response("rate limited", { status: 429 })));
    await expect(fetchStockQuote("PETR4")).rejects.toThrow(/Limite/);
  });

  it("lança TickerLookupError quando results vazio", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(() => new Response(JSON.stringify({ results: [], requestedAt: "", took: "" }), { status: 200 }))
    );
    await expect(fetchStockQuote("PETR4")).rejects.toBeInstanceOf(TickerLookupError);
  });
});

describe("fetchAvailableStocks", () => {
  it("retorna BR stocks + fallback internacional", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(() => new Response(JSON.stringify({ stocks: ["PETR4"], indexes: [] }), { status: 200 }))
    );
    const out = await fetchAvailableStocks();
    expect(out.some((s) => s.ticker === "PETR4")).toBe(true);
    expect(out.some((s) => s.ticker === "AAPL")).toBe(true);
  });
});

describe("fetchStockHistory", () => {
  it("retorna historicalDataPrice", async () => {
    const points = [{ date: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 }];
    vi.stubGlobal(
      "fetch",
      mockFetch(
        () =>
          new Response(JSON.stringify({ results: [{ symbol: "PETR4", historicalDataPrice: points }] }), { status: 200 })
      )
    );
    const out = await fetchStockHistory("PETR4", "1d");
    expect(out).toEqual(points);
  });

  it("lança quando 404", async () => {
    vi.stubGlobal("fetch", mockFetch(() => new Response("", { status: 404 })));
    await expect(fetchStockHistory("PETR4", "1d")).rejects.toThrow(/não encontrado/);
  });

  it("lança quando ausentes os pontos", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(() => new Response(JSON.stringify({ results: [] }), { status: 200 }))
    );
    await expect(fetchStockHistory("PETR4", "5d")).rejects.toThrow();
  });
});

describe("fetchMultipleQuotes", () => {
  it("retorna [] quando tickers vazio", async () => {
    expect(await fetchMultipleQuotes([])).toEqual([]);
  });

  it("retorna lista quando ok", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(
        () =>
          new Response(
            JSON.stringify({
              results: [
                {
                  symbol: "PETR4",
                  shortName: "",
                  longName: "",
                  currency: "BRL",
                  regularMarketPrice: 1,
                  regularMarketChange: 0,
                  regularMarketChangePercent: 0,
                  regularMarketTime: "",
                  earningsPerShare: 0,
                  priceEarnings: 0,
                },
              ],
            }),
            { status: 200 }
          )
      )
    );
    const out = await fetchMultipleQuotes(["PETR4"]);
    expect(out).toHaveLength(1);
  });

  it("lança em 429", async () => {
    vi.stubGlobal("fetch", mockFetch(() => new Response("", { status: 429 })));
    await expect(fetchMultipleQuotes(["PETR4"])).rejects.toThrow(/Limite/);
  });
});

describe("searchStocks", () => {
  it("retorna [] em query vazia", async () => {
    expect(await searchStocks("")).toEqual([]);
  });

  it("retorna stocks do payload", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(() => new Response(JSON.stringify({ stocks: [{ stock: "PETR4", name: "Petrobras" }] }), { status: 200 }))
    );
    const out = await searchStocks("petr");
    expect(out).toHaveLength(1);
  });

  it("retorna [] em erro", async () => {
    vi.stubGlobal("fetch", mockFetch(() => new Response("", { status: 500 })));
    expect(await searchStocks("xxx")).toEqual([]);
  });

  it("retorna [] em fetch rejeitado", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("rede")));
    expect(await searchStocks("xxx")).toEqual([]);
  });
});

describe("TickerLookupError", () => {
  it("guarda status e suggestions", () => {
    const e = new TickerLookupError("x", 404, [{ stock: "PETR3" }]);
    expect(e.status).toBe(404);
    expect(e.suggestions).toEqual([{ stock: "PETR3" }]);
    expect(e.name).toBe("TickerLookupError");
  });
});
