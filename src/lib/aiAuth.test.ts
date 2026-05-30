// src/lib/aiAuth.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  setAIAccessToken,
  aiAuthHeaders,
  throwIfPaywalled,
  PaywallRequiredError,
} from "./aiAuth";

describe("aiAuth", () => {
  beforeEach(() => setAIAccessToken(null));

  it("aiAuthHeaders vazio sem token", () => {
    expect(aiAuthHeaders()).toEqual({});
  });

  it("aiAuthHeaders inclui Bearer quando token setado", () => {
    setAIAccessToken("jwt-123");
    expect(aiAuthHeaders()).toEqual({ Authorization: "Bearer jwt-123" });
  });

  it("throwIfPaywalled ignora respostas != 402", async () => {
    const ok = new Response("{}", { status: 200 });
    await expect(throwIfPaywalled(ok, "compare")).resolves.toBeUndefined();
  });

  it("throwIfPaywalled lanca PaywallRequiredError no 402 com payload", async () => {
    const body = JSON.stringify({ currentUsage: 10, limit: 10, plan: "free" });
    const res = new Response(body, { status: 402 });
    await expect(throwIfPaywalled(res, "screener")).rejects.toBeInstanceOf(
      PaywallRequiredError
    );
    try {
      await throwIfPaywalled(new Response(body, { status: 402 }), "screener");
    } catch (e) {
      const err = e as PaywallRequiredError;
      expect(err.payload.feature).toBe("screener");
      expect(err.payload.currentUsage).toBe(10);
      expect(err.payload.limit).toBe(10);
      expect(err.payload.plan).toBe("free");
    }
  });
});
