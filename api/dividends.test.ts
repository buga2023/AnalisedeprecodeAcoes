import { describe, it, expect, beforeEach, vi } from "vitest";
import handler from "./dividends";
import { makeReq, makeRes } from "./test-helpers";

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

// Handler aplica rate-limit (30/min) — sem IP distinto, testes sequenciais
// caem em 429 antes da lógica. Mesma estratégia de `api/ai.test.ts` e
// `api/fundamentals.test.ts`.
let ipCounter = 0;
function reqWithUniqueIp(opts: Parameters<typeof makeReq>[0] = {}) {
  ipCounter += 1;
  return makeReq({
    ...opts,
    headers: { ...(opts.headers ?? {}), "x-forwarded-for": `10.0.1.${ipCounter}` },
  });
}

function yahooDividendsPayload(events: { ts: number; amount: number }[]) {
  const dividends: Record<string, { amount: number; date: number }> = {};
  for (const e of events) {
    dividends[String(e.ts)] = { amount: e.amount, date: e.ts };
  }
  return {
    chart: {
      result: [{ events: { dividends } }],
      error: null,
    },
  };
}

describe("api/dividends handler", () => {
  it("responde 204 em OPTIONS", async () => {
    const req = reqWithUniqueIp({ method: "OPTIONS" });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(204);
  });

  it("400 quando sem ticker", async () => {
    const req = reqWithUniqueIp();
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(400);
  });

  it("retorna histórico ordenado por data crescente", async () => {
    // Timestamps em UTC seconds; as datas esperadas conferidas via
    // `new Date(ts * 1000).toISOString().slice(0,10)` em Node.
    const payload = yahooDividendsPayload([
      { ts: 1700000000, amount: 0.5 }, // 2023-11-14
      { ts: 1640476800, amount: 0.3 }, // 2021-12-26
      { ts: 1680000000, amount: 0.4 }, // 2023-03-28
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }))
    );

    const req = reqWithUniqueIp({ query: { ticker: "PETR4" } });
    const res = makeRes();
    await handler(req, res);

    expect(res.mock.statusCode).toBe(200);
    const body = res.mock.body as { ticker: string; history: { date: string; amount: number }[] };
    expect(body.ticker).toBe("PETR4");
    expect(body.history).toHaveLength(3);
    expect(body.history.map((d) => d.date)).toEqual(["2021-12-26", "2023-03-28", "2023-11-14"]);
    expect(body.history[0].amount).toBe(0.3);
  });

  it("retorna histórico vazio quando Yahoo não tem dividends", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ chart: { result: [{ events: {} }] } }), { status: 200 })
      )
    );

    const req = reqWithUniqueIp({ query: { ticker: "MGLU3" } });
    const res = makeRes();
    await handler(req, res);

    expect(res.mock.statusCode).toBe(200);
    const body = res.mock.body as { history: unknown[] };
    expect(body.history).toEqual([]);
  });

  it("tenta sufixo .SA antes do ticker puro", async () => {
    const seenUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        seenUrls.push(url);
        return new Response(JSON.stringify(yahooDividendsPayload([{ ts: 1700000000, amount: 1 }])), {
          status: 200,
        });
      })
    );

    const req = reqWithUniqueIp({ query: { ticker: "petr4" } });
    const res = makeRes();
    await handler(req, res);

    expect(res.mock.statusCode).toBe(200);
    expect(seenUrls[0]).toMatch(/PETR4\.SA/);
  });

  it("não adiciona .SA quando ticker já tem ponto", async () => {
    const seenUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        seenUrls.push(url);
        return new Response(JSON.stringify(yahooDividendsPayload([])), { status: 200 });
      })
    );

    const req = reqWithUniqueIp({ query: { ticker: "BRK-B" } });
    const res = makeRes();
    await handler(req, res);

    expect(seenUrls.every((u) => !u.includes(".SA"))).toBe(true);
  });

  it("falha silenciosa: 500 do Yahoo vira history vazio", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("err", { status: 500 })));

    const req = reqWithUniqueIp({ query: { ticker: "PETR4" } });
    const res = makeRes();
    await handler(req, res);

    expect(res.mock.statusCode).toBe(200);
    const body = res.mock.body as { history: unknown[] };
    expect(body.history).toEqual([]);
  });

  it("falha silenciosa: 429 também devolve history vazio (não 500)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("rate", { status: 429 })));

    const req = reqWithUniqueIp({ query: { ticker: "PETR4" } });
    const res = makeRes();
    await handler(req, res);

    expect(res.mock.statusCode).toBe(200);
    expect((res.mock.body as { history: unknown[] }).history).toEqual([]);
  });

  it("normaliza ticker pra maiúsculas e trim", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(yahooDividendsPayload([])), { status: 200 }))
    );

    const req = reqWithUniqueIp({ query: { ticker: "  petr4  " } });
    const res = makeRes();
    await handler(req, res);

    expect((res.mock.body as { ticker: string }).ticker).toBe("PETR4");
  });
});
