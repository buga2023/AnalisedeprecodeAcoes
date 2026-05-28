import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeReq } from "./test-helpers";

beforeEach(() => {
  vi.resetModules();
});

async function loadModule() {
  return import("./_ratelimit");
}

describe("checkRateLimit", () => {
  it("permite primeira requisição", async () => {
    const { checkRateLimit } = await loadModule();
    const r = checkRateLimit(makeReq({ headers: { "x-forwarded-for": "1.1.1.1" } }), {
      windowMs: 60_000,
      max: 5,
    });
    expect(r.allowed).toBe(true);
  });

  it("bloqueia ao estourar max na janela", async () => {
    const { checkRateLimit } = await loadModule();
    const req = makeReq({ headers: { "x-forwarded-for": "2.2.2.2" } });
    const opts = { windowMs: 60_000, max: 2, burstMax: 100, burstWindowMs: 5_000 };
    expect(checkRateLimit(req, opts).allowed).toBe(true);
    expect(checkRateLimit(req, opts).allowed).toBe(true);
    const blocked = checkRateLimit(req, opts);
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe("window");
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(1);
  });

  it("bloqueia em burst (3 req rapidas)", async () => {
    const { checkRateLimit } = await loadModule();
    const req = makeReq({ headers: { "x-forwarded-for": "3.3.3.3" } });
    const opts = { windowMs: 60_000, max: 100, burstMax: 2, burstWindowMs: 5_000 };
    expect(checkRateLimit(req, opts).allowed).toBe(true);
    expect(checkRateLimit(req, opts).allowed).toBe(true);
    const blocked = checkRateLimit(req, opts);
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe("burst");
  });

  it("usa x-real-ip quando ausente x-forwarded-for", async () => {
    const { checkRateLimit } = await loadModule();
    const r = checkRateLimit(makeReq({ headers: { "x-real-ip": "5.5.5.5" } }), {
      windowMs: 60_000,
      max: 1,
      burstMax: 100,
    });
    expect(r.allowed).toBe(true);
  });

  it("usa 'unknown' quando sem IP detectável", async () => {
    const { checkRateLimit } = await loadModule();
    const r = checkRateLimit(makeReq(), { windowMs: 60_000, max: 1 });
    expect(r.allowed).toBe(true);
  });
});
