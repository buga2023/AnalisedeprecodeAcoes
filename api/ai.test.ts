import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeReq, makeRes } from "./test-helpers";

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

let ipCounter = 0;
async function loadHandler() {
  const mod = await import("./ai");
  return mod.default;
}
function reqWithUniqueIp(opts: Parameters<typeof makeReq>[0] = {}) {
  ipCounter += 1;
  return makeReq({
    ...opts,
    headers: { ...(opts.headers ?? {}), "x-forwarded-for": `10.0.0.${ipCounter}` },
  });
}

describe("api/ai handler", () => {
  it("responde 204 em OPTIONS (via applyCors)", async () => {
    const handler = await loadHandler();
    const req = reqWithUniqueIp({ method: "OPTIONS" });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(204);
    expect(res.mock.ended).toBe(true);
  });

  it("responde 405 em método não-POST", async () => {
    const handler = await loadHandler();
    const req = reqWithUniqueIp({ method: "GET" });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(405);
  });

  it("responde 503 quando GROQ_API_KEY ausente", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "");
    const handler = await loadHandler();
    const req = reqWithUniqueIp({
      method: "POST",
      body: { messages: [{ role: "user", content: "hi" }] },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(503);
    expect((res.mock.body as { error: string }).error).toMatch(/GROQ_API_KEY/);
  });

  it("responde 400 quando messages está ausente", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "k");
    const handler = await loadHandler();
    const req = reqWithUniqueIp({ method: "POST", body: {} });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(400);
  });

  it("encaminha para groq quando chave presente", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "k");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 })
      )
    );
    const handler = await loadHandler();
    const req = reqWithUniqueIp({
      method: "POST",
      body: { messages: [{ role: "user", content: "x" }] },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(200);
    expect((res.mock.body as { provider: string }).provider).toBe("groq");
  });

  it("openrouter: é o provider default e encaminha quando chave presente", async () => {
    // Sem AI_PROVIDER setado → default resolve para openrouter.
    vi.stubEnv("OPENROUTER_API_KEY", "k");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 })
      )
    );
    const handler = await loadHandler();
    const req = reqWithUniqueIp({
      method: "POST",
      body: { messages: [{ role: "user", content: "x" }] },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(200);
    expect((res.mock.body as { provider: string }).provider).toBe("openrouter");
  });

  it("balanceia em 429: 1º provider da rodada estoura → cai pro próximo", async () => {
    // Groq + OpenRouter com chave → pool [groq, openrouter]. Rodada começa no
    // groq; groq devolve 429 (quota) → fallback para openrouter (200).
    vi.stubEnv("GROQ_API_KEY", "k");
    vi.stubEnv("OPENROUTER_API_KEY", "k");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes("api.groq.com")) {
          return new Response(JSON.stringify({ error: { message: "rate limit" } }), { status: 429 });
        }
        return new Response(JSON.stringify({ choices: [{ message: { content: "via openrouter" } }] }), { status: 200 });
      })
    );
    const handler = await loadHandler();
    const req = reqWithUniqueIp({ method: "POST", body: { messages: [{ role: "user", content: "x" }] } });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(200);
    expect((res.mock.body as { provider: string }).provider).toBe("openrouter");
    expect((res.mock.body as { content: string }).content).toBe("via openrouter");
  });

  it("round-robin: chamadas consecutivas vão a providers diferentes", async () => {
    vi.stubEnv("GROQ_API_KEY", "k");
    vi.stubEnv("GEMINI_API_KEY", "k");
    vi.stubEnv("OPENROUTER_API_KEY", "k");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes("generativelanguage.googleapis.com")) {
          return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "g" }] } }] }), { status: 200 });
        }
        // groq e openrouter são OpenAI-compatible.
        return new Response(JSON.stringify({ choices: [{ message: { content: "c" } }] }), { status: 200 });
      })
    );
    const handler = await loadHandler();
    // Mensagens distintas pra não bater no cache (queremos 2 chamadas reais).
    const r1 = reqWithUniqueIp({ method: "POST", body: { messages: [{ role: "user", content: "um" }] } });
    const res1 = makeRes();
    await handler(r1, res1);
    const r2 = reqWithUniqueIp({ method: "POST", body: { messages: [{ role: "user", content: "dois" }] } });
    const res2 = makeRes();
    await handler(r2, res2);
    const p1 = (res1.mock.body as { provider: string }).provider;
    const p2 = (res2.mock.body as { provider: string }).provider;
    expect(p1).toBe("groq");      // rodada 1 começa no groq
    expect(p2).toBe("gemini");    // rodada 2 avança pro gemini
    expect(p1).not.toBe(p2);
  });

  it("openrouter: rodízio dos 3 modelos free — o primário gira a cada chamada", async () => {
    // Só OpenRouter com chave → pool de providers fica [openrouter], isolando o
    // rodízio de MODELOS. models[0] (o primário enviado ao OpenRouter) deve girar.
    vi.stubEnv("OPENROUTER_API_KEY", "k");
    const seenPrimary: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes("openrouter.ai")) {
          const body = JSON.parse(String(init?.body ?? "{}")) as { models?: string[] };
          seenPrimary.push(body.models?.[0] ?? "");
        }
        return new Response(JSON.stringify({ choices: [{ message: { content: "c" } }] }), { status: 200 });
      })
    );
    const handler = await loadHandler();
    for (const content of ["a", "b", "c"]) {
      const req = reqWithUniqueIp({ method: "POST", body: { messages: [{ role: "user", content }] } });
      await handler(req, makeRes());
    }
    expect(seenPrimary).toEqual([
      "deepseek/deepseek-v4-flash:free",
      "qwen/qwen3-next-80b-a3b-instruct:free",
      "openai/gpt-oss-120b:free",
    ]);
  });

  it("retorna 401 quando upstream responde com 401", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "k");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { message: "bad key" } }), { status: 401 })
      )
    );
    const handler = await loadHandler();
    const req = reqWithUniqueIp({
      method: "POST",
      body: { messages: [{ role: "user", content: "x" }] },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(401);
  });

  it("openai: encaminha quando chave presente", async () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "k");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "out" } }] }), { status: 200 })
      )
    );
    const handler = await loadHandler();
    const req = reqWithUniqueIp({
      method: "POST",
      body: { provider: "openai", messages: [{ role: "user", content: "x" }] },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(200);
    expect((res.mock.body as { provider: string }).provider).toBe("openai");
  });

  it("anthropic: encaminha quando chave presente", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "k");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ content: [{ text: "out" }] }), { status: 200 })
      )
    );
    const handler = await loadHandler();
    const req = reqWithUniqueIp({
      method: "POST",
      body: {
        provider: "anthropic",
        messages: [{ role: "system", content: "s" }, { role: "user", content: "u" }],
      },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(200);
    expect((res.mock.body as { provider: string }).provider).toBe("anthropic");
  });

  it("gemini: encaminha quando chave presente", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ candidates: [{ content: { parts: [{ text: "out" }] } }] }),
          { status: 200 }
        )
      )
    );
    const handler = await loadHandler();
    const req = reqWithUniqueIp({
      method: "POST",
      body: { provider: "gemini", messages: [{ role: "user", content: "x" }] },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(200);
    expect((res.mock.body as { provider: string }).provider).toBe("gemini");
  });

  it("retorna do cache em segunda chamada idêntica", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "k");
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "cacheable" } }] }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const handler = await loadHandler();
    const body = { messages: [{ role: "user", content: "idêntico" }] };
    const req1 = reqWithUniqueIp({ method: "POST", body });
    const res1 = makeRes();
    await handler(req1, res1);
    const req2 = reqWithUniqueIp({ method: "POST", body });
    const res2 = makeRes();
    await handler(req2, res2);
    expect(res2.mock.headers["X-Cache"]).toBe("HIT");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aplica burst limit (3 req em 5s do mesmo IP retorna 429 na 4ª)", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "k");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "x" } }] }), { status: 200 })
      )
    );
    const handler = await loadHandler();
    const headers = { "x-forwarded-for": "192.168.1.99" };
    // 3 requisições com payloads únicos (pra evitar cache hit) com mesmo IP
    for (let i = 0; i < 3; i++) {
      const req = makeReq({ method: "POST", headers, body: { messages: [{ role: "user", content: `q${i}` }] } });
      const res = makeRes();
      await handler(req, res);
      expect(res.mock.statusCode).toBe(200);
    }
    const req4 = makeReq({ method: "POST", headers, body: { messages: [{ role: "user", content: "q4" }] } });
    const res4 = makeRes();
    await handler(req4, res4);
    expect(res4.mock.statusCode).toBe(429);
  });
});
