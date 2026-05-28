import { describe, it, expect, beforeEach, vi } from "vitest";
import handler from "./fundamentals";
import { makeReq, makeRes } from "./test-helpers";

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("api/fundamentals handler", () => {
  it("responde 204 em OPTIONS", async () => {
    const req = makeReq({ method: "OPTIONS" });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(204);
  });

  it("400 quando ticker ausente", async () => {
    const req = makeReq();
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
    const req = makeReq({ query: { ticker: "PETR4", price: "30" } });
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
    const req = makeReq({ query: { ticker: "PETR4" } });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(502);
  });

  it("500 quando provider sem chave", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "");
    const req = makeReq({ query: { ticker: "PETR4" } });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(500);
  });
});
