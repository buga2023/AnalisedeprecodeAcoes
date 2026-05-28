import { describe, it, expect, beforeEach, vi } from "vitest";
import handler from "./market";
import { makeReq, makeRes } from "./test-helpers";

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("api/market handler", () => {
  it("responde 204 em OPTIONS", async () => {
    const req = makeReq({ method: "OPTIONS" });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(204);
  });

  it("monta payload com dados Yahoo quando >=2 símbolos retornam", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            chart: {
              result: [
                { meta: { regularMarketPrice: 5.1, previousClose: 5.0 } },
              ],
            },
          }),
          { status: 200 }
        )
      )
    );
    const req = makeReq();
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(200);
    const body = res.mock.body as Record<string, { bid: string; pctChange: string }>;
    expect(body.USDBRL?.bid).toBeDefined();
  });

  it("cai no fallback AwesomeAPI quando Yahoo falha", async () => {
    let firstCalled = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const u = String(input);
        if (!firstCalled && u.includes("query1.finance.yahoo.com")) {
          firstCalled = true;
          return new Response("", { status: 500 });
        }
        if (u.includes("economia.awesomeapi.com.br")) {
          return new Response(
            JSON.stringify({ USDBRL: { bid: "5.10", pctChange: "0.5" } }),
            { status: 200 }
          );
        }
        return new Response("", { status: 500 });
      })
    );
    const req = makeReq();
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(200);
  });
});
