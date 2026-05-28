import { describe, it, expect, beforeEach, vi } from "vitest";
import handler from "./world-news";
import { makeReq, makeRes } from "./test-helpers";

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("api/world-news handler", () => {
  it("responde 204 em OPTIONS", async () => {
    const req = makeReq({ method: "OPTIONS" });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(204);
  });

  it("retorna payload com topics (vazio quando upstreams falham)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    const req = makeReq({ query: { refresh: "1" } });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(200);
    const body = res.mock.body as { topics: unknown[]; refreshIntervalMs: number };
    expect(Array.isArray(body.topics)).toBe(true);
    expect(body.refreshIntervalMs).toBeGreaterThan(0);
  });
});
