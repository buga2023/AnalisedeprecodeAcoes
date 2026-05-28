import { describe, it, expect, beforeEach, vi } from "vitest";
import handler from "./fundamentals";
import { makeReq, makeRes } from "./test-helpers";

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// Cada request precisa de IP único: o handler aplica rate-limit (10/min + burst
// 3/5s) e sem distinct IPs os testes em sequência caem em 429 antes de chegar
// na lógica que queremos testar. Mesma estratégia de `api/ai.test.ts`.
let ipCounter = 0;
function reqWithUniqueIp(opts: Parameters<typeof makeReq>[0] = {}) {
  ipCounter += 1;
  return makeReq({
    ...opts,
    headers: { ...(opts.headers ?? {}), "x-forwarded-for": `10.0.0.${ipCounter}` },
  });
}

describe("api/fundamentals handler", () => {
  it("responde 204 em OPTIONS", async () => {
    const req = reqWithUniqueIp({ method: "OPTIONS" });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(204);
  });

  it("400 quando ticker ausente", async () => {
    const req = reqWithUniqueIp();
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(400);
  });

  it("retorna payload IA + geradoEm em sucesso", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "k");
    const aiBody = {
      ticker: "PETR4",
      empresa: "Petrobras",
      fundamentais: { pl: { value: 5, unit: "ratio", confianca: "alta", referencia: "x" } },
      trimestres: [],
      fontes: ["x"],
      aviso: "",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: JSON.stringify(aiBody) } }] }),
          { status: 200 }
        )
      )
    );
    const req = reqWithUniqueIp({ query: { ticker: "PETR4", price: "30" } });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(200);
    const body = res.mock.body as { estimadoPorIA: boolean; geradoEm: string };
    expect(body.estimadoPorIA).toBe(true);
    expect(body.geradoEm).toBeTruthy();
  });

  it("502 quando IA retorna JSON inválido", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "k");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: "não é json" } }] }),
          { status: 200 }
        )
      )
    );
    const req = reqWithUniqueIp({ query: { ticker: "PETR4" } });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(502);
  });

  it("500 quando provider sem chave", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "");
    const req = reqWithUniqueIp({ query: { ticker: "PETR4" } });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(500);
  });
});
