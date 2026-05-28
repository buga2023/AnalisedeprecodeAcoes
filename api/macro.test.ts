import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeReq, makeRes } from "./test-helpers";

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

async function loadHandler() {
  const mod = await import("./macro");
  return mod.default;
}

describe("api/macro handler", () => {
  it("responde 204 em OPTIONS", async () => {
    const handler = await loadHandler();
    const req = makeReq({ method: "OPTIONS" });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(204);
  });

  it("retorna estrutura base mesmo com upstreams falhando", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    const handler = await loadHandler();
    const req = makeReq();
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(200);
    const body = res.mock.body as { selicMeta: { valor: number | null }; resumoParaPrompt: string };
    expect(body.selicMeta).toBeDefined();
    expect(typeof body.resumoParaPrompt).toBe("string");
  });

  it("parseia valores quando SGS retorna dados", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const u = String(input);
        if (u.includes("bcb.gov.br")) {
          return new Response(JSON.stringify([{ data: "01/01/2025", valor: "10,75" }]), { status: 200 });
        }
        if (u.includes("yahoo.com")) {
          return new Response(
            JSON.stringify({ chart: { result: [{ meta: { regularMarketPrice: 130000, previousClose: 129000 } }] } }),
            { status: 200 }
          );
        }
        return new Response("{}", { status: 200 });
      })
    );
    const handler = await loadHandler();
    const req = makeReq();
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(200);
    const body = res.mock.body as { selicMeta: { valor: number | null }; resumoParaPrompt: string };
    expect(body.selicMeta.valor).toBeCloseTo(10.75);
    expect(body.resumoParaPrompt).toContain("SELIC");
  });
});
