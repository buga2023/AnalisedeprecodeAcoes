import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useStockSearch } from "./useStockSearch";

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("useStockSearch", () => {
  it("começa sem resultados", () => {
    const { result } = renderHook(() => useStockSearch());
    expect(result.current.results).toEqual([]);
  });

  it("query vazia limpa resultados", () => {
    const { result } = renderHook(() => useStockSearch());
    act(() => result.current.search(""));
    expect(result.current.results).toEqual([]);
  });

  it("retorna resultados mapeados após debounce", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            stocks: [
              { stock: "PETR4.SA", name: "Petrobras", type: "EQUITY", region: "Brazil" },
              { stock: "AAPL", name: "Apple", type: "EQUITY", region: "United States" },
              { stock: "BTC-USD", name: "Bitcoin", type: "CRYPTO" },
            ],
          }),
          { status: 200 }
        )
      )
    );
    const { result } = renderHook(() => useStockSearch());
    act(() => result.current.search("petr"));
    await waitFor(() => expect(result.current.results.length).toBeGreaterThan(0), { timeout: 2000 });
    const markets = result.current.results.map((r) => r.market);
    expect(markets).toContain("BR");
  });

  it("clearResults zera lista", () => {
    const { result } = renderHook(() => useStockSearch());
    act(() => result.current.clearResults());
    expect(result.current.results).toEqual([]);
  });
});
