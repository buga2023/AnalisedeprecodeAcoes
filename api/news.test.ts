import { describe, it, expect, beforeEach, vi } from "vitest";
import handler from "./news";
import { makeReq, makeRes } from "./test-helpers";

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// Handler aplica rate-limit (30/min) — IP único por request pra testes sequenciais.
let ipCounter = 0;
function reqWithUniqueIp(opts: Parameters<typeof makeReq>[0] = {}) {
  ipCounter += 1;
  return makeReq({
    ...opts,
    headers: { ...(opts.headers ?? {}), "x-forwarded-for": `10.0.3.${ipCounter}` },
  });
}

const sampleRSS = `<?xml version="1.0"?><rss><channel>
  <item>
    <title><![CDATA[Petrobras anuncia resultado]]></title>
    <link>https://exemplo.com/petrobras</link>
    <source url="x">Folha</source>
    <pubDate>Mon, 01 Jan 2025 00:00:00 GMT</pubDate>
  </item>
</channel></rss>`;

describe("api/news handler", () => {
  it("responde 204 em OPTIONS", async () => {
    const req = reqWithUniqueIp({ method: "OPTIONS" });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(204);
  });

  it("400 quando sem ticker/q/topic", async () => {
    const req = reqWithUniqueIp();
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(400);
  });

  it("retorna manchetes por ticker", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(sampleRSS, { status: 200 })));
    const req = reqWithUniqueIp({ query: { ticker: "PETR4" } });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(200);
    expect((res.mock.body as { items: { titulo: string }[] }).items[0].titulo).toMatch(/Petrobras/);
  });

  it("retorna manchetes por topic", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(sampleRSS, { status: 200 })));
    const req = reqWithUniqueIp({ query: { topic: "politica" } });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(200);
    expect((res.mock.body as { items: unknown[] }).items.length).toBeGreaterThan(0);
  });

  it("retorna [] em falha do fetch", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    const req = reqWithUniqueIp({ query: { q: "noticia qualquer" } });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(200);
    expect((res.mock.body as { items: unknown[] }).items).toEqual([]);
  });

  it('kind=regulatory monta query com "fato relevante" e marca payload', async () => {
    const seenUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (u: string) => {
        seenUrls.push(u);
        return new Response(sampleRSS, { status: 200 });
      })
    );
    const req = reqWithUniqueIp({ query: { ticker: "PETR4", kind: "regulatory" } });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(200);
    const body = res.mock.body as { kind: string; query: string };
    expect(body.kind).toBe("regulatory");
    expect(body.query).toMatch(/fato relevante/i);
    expect(seenUrls[0]).toMatch(/fato\+relevante|fato%20relevante/i);
  });

  it("topic=regulatorio sem ticker monta query macro de B3/CVM", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(sampleRSS, { status: 200 })));
    const req = reqWithUniqueIp({ query: { topic: "regulatorio" } });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(200);
    const body = res.mock.body as { kind: string; query: string };
    expect(body.kind).toBe("regulatory");
    expect(body.query).toMatch(/B3|Bovespa|CVM/);
  });
});
