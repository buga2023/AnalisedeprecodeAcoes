import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useMarketQuotes } from "./useMarketQuotes";

beforeEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("useMarketQuotes", () => {
  it("mapeia payload do backend em quotes", async () => {
    const payload = {
      USDBRL: { bid: "5.10", pctChange: "0.2" },
      EURBRL: { bid: "5.50", pctChange: "0.1" },
      BRLUSD: { bid: "0.19", pctChange: "-0.1" },
      BTCBRL: { bid: "300000", pctChange: "1.5" },
      ETHBRL: { bid: "20000", pctChange: "0.5" },
      XAUUSD: { bid: "2000", pctChange: "0.5" },
      XAGUSD: { bid: "23", pctChange: "-0.2" },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }))
    );
    const { result } = renderHook(() => useMarketQuotes());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });
    expect(result.current.quotes.length).toBeGreaterThan(0);
    const usd = result.current.quotes.find((q) => q.code === "USD");
    expect(usd?.price).toBeCloseTo(5.1);
  });

  it("setta error em 429", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 429 })));
    const { result } = renderHook(() => useMarketQuotes());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });
    expect(result.current.error).toMatch(/Limite/);
  });

  it("setta error em outras falhas", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    const { result } = renderHook(() => useMarketQuotes());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });
    expect(result.current.error).toBeTruthy();
  });
});
