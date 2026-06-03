import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeRes } from "./test-helpers";
import type { VercelRequest } from "@vercel/node";

// Mock _llm no topo — intercepta todos os imports desse módulo em todos os testes.
vi.mock("./_llm", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./_llm")>();
  return {
    ...mod,
    callLLM: vi.fn(),
    getProviderApiKey: vi.fn(() => "test-key"),
    defaultProvider: vi.fn(() => "groq" as const),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

let ipCounter = 10000;
function makeReq(opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): VercelRequest {
  ipCounter++;
  return {
    method: opts.method ?? "POST",
    query: {},
    body: opts.body ?? {},
    headers: { "x-forwarded-for": `192.168.${ipCounter % 255}.${(ipCounter >> 8) % 255}`, ...(opts.headers ?? {}) },
  } as unknown as VercelRequest;
}

const MOCK_RESPONSE = {
  filters: { minROE: 15, maxPL: 12, minDY: 6, maxDebtToEbitda: 3, sectors: ["Energia"], sortBy: "score" },
  suggestedTickers: ["PETR4", "TAEE11", "EGIE3"],
  label: "DY > 6% · ROE > 15%",
  rationale: "Ações com dividendos consistentes e rentabilidade acima da média.",
};

async function loadHandler() {
  const { callLLM } = await import("./_llm");
  vi.mocked(callLLM).mockResolvedValue({
    content: JSON.stringify(MOCK_RESPONSE),
    provider: "groq",
  });
  const mod = await import("./screen");
  return mod.default;
}

// ─── Validações básicas (sem precisar de LLM) ─────────────────────────────────

describe("api/screen handler — validações básicas", () => {
  it("responde 204 em OPTIONS (preflight CORS)", async () => {
    const handler = await loadHandler();
    const req = makeReq({ method: "OPTIONS" });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(204);
  });

  it("responde 405 em GET", async () => {
    const handler = await loadHandler();
    const req = makeReq({ method: "GET" });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(405);
  });

  it("responde 400 quando query ausente", async () => {
    const handler = await loadHandler();
    const req = makeReq({ body: {} });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(400);
  });

  it("responde 400 quando query tem menos de 3 caracteres", async () => {
    const handler = await loadHandler();
    const req = makeReq({ body: { query: "ab" } });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(400);
  });

  it("responde 400 quando query ultrapassa 500 caracteres", async () => {
    const handler = await loadHandler();
    const req = makeReq({ body: { query: "a".repeat(501) } });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(400);
  });
});

// ─── Integração LLM (mock via vi.mock) ───────────────────────────────────────

describe("api/screen handler — integração LLM (mock)", () => {
  it("retorna 200 com estrutura correta quando LLM responde com JSON válido", async () => {
    const handler = await loadHandler();
    const req = makeReq({ body: { query: "ações com dividendos acima de 6%" } });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(200);
    const body = res.mock.body as typeof MOCK_RESPONSE;
    expect(body.label).toBe("DY > 6% · ROE > 15%");
    expect(Array.isArray(body.suggestedTickers)).toBe(true);
    expect(body.suggestedTickers).toContain("PETR4");
  });

  it("sanitiza tickers — remove formatos inválidos da resposta da IA", async () => {
    const { callLLM } = await import("./_llm");
    vi.mocked(callLLM).mockResolvedValue({
      content: JSON.stringify({
        ...MOCK_RESPONSE,
        suggestedTickers: ["PETR4", "INVALID_TICKER", "123ABC", "VALE3", "bova11"],
      }),
      provider: "groq",
    });
    const mod = await import("./screen");
    const handler = mod.default;

    const req = makeReq({ body: { query: "ações de dividendos sólidos" } });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(200);
    const body = res.mock.body as typeof MOCK_RESPONSE;
    expect(body.suggestedTickers).toContain("PETR4");
    expect(body.suggestedTickers).toContain("VALE3");
    expect(body.suggestedTickers).not.toContain("INVALID_TICKER");
    expect(body.suggestedTickers).not.toContain("123ABC");
    // "bova11" não passa no regex /^[A-Z]{4}\d{1,2}$/ (lowercase)
    expect(body.suggestedTickers).not.toContain("bova11");
  });

  it("retorna 503 quando getProviderApiKey retorna null", async () => {
    const { getProviderApiKey } = await import("./_llm");
    vi.mocked(getProviderApiKey).mockReturnValue(null);
    const mod = await import("./screen");
    const handler = mod.default;

    const req = makeReq({ body: { query: "ações de crescimento" } });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(503);
  });

  it("retorna 502 quando LLM retorna JSON inválido", async () => {
    const { callLLM } = await import("./_llm");
    vi.mocked(callLLM).mockResolvedValue({
      content: "não é json válido aqui",
      provider: "groq",
    });
    const mod = await import("./screen");
    const handler = mod.default;

    const req = makeReq({ body: { query: "blue chips brasileiras" } });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(502);
  });

  it("aceita profile no body sem erros e retorna 200", async () => {
    const handler = await loadHandler();
    const req = makeReq({
      body: {
        query: "ações conservadoras com bom DY",
        profile: { risk: "low", horizon: "long" },
      },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(200);
  });

  it("resposta inclui label e rationale da IA", async () => {
    const handler = await loadHandler();
    const req = makeReq({ body: { query: "ações com fundamentos sólidos" } });
    const res = makeRes();
    await handler(req, res);
    const body = res.mock.body as typeof MOCK_RESPONSE;
    expect(typeof body.label).toBe("string");
    expect(typeof body.rationale).toBe("string");
    expect(body.label.length).toBeGreaterThan(0);
  });
});

// ─── Rate limit ───────────────────────────────────────────────────────────────

describe("api/screen handler — rate limit", () => {
  it("responde 429 após esgotar limite de burst com mesmo IP", async () => {
    const handler = await loadHandler();
    const sameIp = "10.55.66.77";
    const responses: number[] = [];
    for (let i = 0; i < 5; i++) {
      const req = makeReq({
        body: { query: `busca numero ${i} para rate limit` },
        headers: { "x-forwarded-for": sameIp },
      });
      const res = makeRes();
      await handler(req, res);
      responses.push(res.mock.statusCode);
    }
    expect(responses).toContain(429);
  });

  it("IPs distintos não bloqueiam uns aos outros", async () => {
    const handler = await loadHandler();
    const responses: number[] = [];
    for (let i = 0; i < 5; i++) {
      const req = makeReq({
        body: { query: "busca com ips distintos" },
        headers: { "x-forwarded-for": `10.${i}.0.1` },
      });
      const res = makeRes();
      await handler(req, res);
      responses.push(res.mock.statusCode);
    }
    // Nenhum deve ser 429 (IPs diferentes)
    expect(responses.every((s) => s !== 429)).toBe(true);
  });
});
