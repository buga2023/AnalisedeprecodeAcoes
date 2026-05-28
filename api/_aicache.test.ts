import { describe, it, expect, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

async function loadModule() {
  return import("./_aicache");
}

describe("cacheKey", () => {
  it("retorna mesma chave para entrada igual", async () => {
    const { cacheKey } = await loadModule();
    const input = {
      provider: "groq",
      messages: [{ role: "user", content: "x" }],
      temperature: 0.7,
      max_tokens: 2048,
    };
    expect(cacheKey(input)).toBe(cacheKey(input));
  });

  it("retorna chaves diferentes para inputs diferentes", async () => {
    const { cacheKey } = await loadModule();
    const a = cacheKey({ provider: "groq", messages: [], temperature: 0.7, max_tokens: 100 });
    const b = cacheKey({ provider: "groq", messages: [], temperature: 0.7, max_tokens: 200 });
    expect(a).not.toBe(b);
  });

  it("retorna sha1 (40 chars hex)", async () => {
    const { cacheKey } = await loadModule();
    const k = cacheKey({ provider: "groq", messages: [], temperature: 0, max_tokens: 1 });
    expect(k).toMatch(/^[a-f0-9]{40}$/);
  });
});

describe("getCached / setCached", () => {
  it("retorna null quando não cacheado", async () => {
    const { getCached } = await loadModule();
    expect(getCached("ausente")).toBeNull();
  });

  it("retorna valor após setCached", async () => {
    const { setCached, getCached } = await loadModule();
    setCached("k1", { ok: true });
    expect(getCached("k1")).toEqual({ ok: true });
  });

  it("expira após TTL", async () => {
    const { setCached, getCached } = await loadModule();
    const realNow = Date.now;
    try {
      setCached("k2", { x: 1 });
      // Mock Date.now para 11 minutos no futuro (TTL é 10 min)
      const futureNow = Date.now() + 11 * 60 * 1000;
      Date.now = () => futureNow;
      expect(getCached("k2")).toBeNull();
    } finally {
      Date.now = realNow;
    }
  });
});
