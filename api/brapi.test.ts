import { describe, it, expect, beforeEach, vi } from "vitest";
import handler from "./brapi";
import { makeReq, makeRes } from "./test-helpers";

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("api/brapi handler", () => {
  it("responde 204 em OPTIONS", async () => {
    const req = makeReq({ method: "OPTIONS" });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(204);
  });

  it("retorna 404 quando endpoint não mapeado", async () => {
    const req = makeReq({ query: { endpoint: "/unknown" } });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(404);
  });

  it("/available retorna lista BR padrão", async () => {
    const req = makeReq({ query: { endpoint: "/available" } });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(200);
    expect((res.mock.body as { stocks: string[] }).stocks).toContain("PETR4");
  });

  it("/search retorna [] quando q vazio", async () => {
    const req = makeReq({ query: { endpoint: "/search" } });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(200);
    expect((res.mock.body as { stocks: unknown[] }).stocks).toEqual([]);
  });

  it("/search retorna sugestões quando Yahoo responde", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            quotes: [
              { symbol: "PETR4.SA", shortname: "Petrobras", quoteType: "EQUITY", region: "Brazil" },
            ],
          }),
          { status: 200 }
        )
      )
    );
    const req = makeReq({ query: { endpoint: "/search", q: "petr" } });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(200);
    expect((res.mock.body as { stocks: { stock: string }[] }).stocks[0].stock).toBe("PETR4");
  });

  it("/quote: 400 quando ticker vazio", async () => {
    const req = makeReq({ query: { endpoint: "/quote/" } });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(400);
  });

  it("/quote: 404 quando Yahoo retorna nada e search vazia", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 404 }))
    );
    const req = makeReq({ query: { endpoint: "/quote/ZZZZ9" } });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(404);
    expect((res.mock.body as { source: string }).source).toBe("Yahoo Finance");
  });

  it("/quote: sucesso com chart válido", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const u = String(input);
        if (u.includes("v8/finance/chart")) {
          return new Response(
            JSON.stringify({
              chart: {
                result: [
                  {
                    meta: {
                      regularMarketPrice: 30,
                      previousClose: 29,
                      shortName: "Petrobras",
                      longName: "Petroleo BR SA",
                      currency: "BRL",
                      regularMarketTime: 1700000000,
                    },
                    timestamp: [1700000000],
                    indicators: { quote: [{ open: [29], high: [31], low: [28], close: [30], volume: [1000] }] },
                  },
                ],
              },
            }),
            { status: 200 }
          );
        }
        return new Response("{}", { status: 200 });
      })
    );
    const req = makeReq({ query: { endpoint: "/quote/PETR4" } });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(200);
    expect((res.mock.body as { results: { symbol: string }[] }).results[0].symbol).toBe("PETR4");
  });
});
