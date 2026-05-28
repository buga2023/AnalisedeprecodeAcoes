import { describe, it, expect, beforeEach, vi } from "vitest";
import handler from "./scrape";
import { makeReq, makeRes } from "./test-helpers";

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("api/scrape handler", () => {
  it("responde 204 em OPTIONS (via applyCors)", async () => {
    const req = makeReq({ method: "OPTIONS" });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(204);
  });

  it("400 quando ticker inválido", async () => {
    const req = makeReq({ query: { ticker: "12" } });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(400);
  });

  it("retorna aviso quando todas as fontes falham", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    const req = makeReq({ query: { ticker: "PETR4" } });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(200);
    expect((res.mock.body as { aviso?: string }).aviso).toMatch(/scraping/);
  });

  it("retorna conteúdo quando fonte responde com texto suficiente", async () => {
    const html = "<html><body>" + "x ".repeat(300) + "Petrobras dados RI</body></html>";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(html, { status: 200, headers: { "Content-Type": "text/html" } }))
    );
    const req = makeReq({ query: { ticker: "PETR4" } });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(200);
    expect((res.mock.body as { conteudo: string }).conteudo).toMatch(/Petrobras/);
  });
});
