import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useRelatorios } from "./useRelatorios";

const okPayload = (symbol: string, lucro = 10) =>
  new Response(
    JSON.stringify({
      results: [
        {
          symbol,
          incomeStatementHistoryQuarterly: {
            incomeStatementHistory: [
              { endDate: "2024-06-30", netIncome: lucro, totalRevenue: 100 },
            ],
          },
        },
      ],
    }),
    { status: 200 }
  );

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("useRelatorios", () => {
  it("retorna [] quando tickers vazio", () => {
    const { result } = renderHook(() => useRelatorios([]));
    expect(result.current.relatorios).toEqual([]);
  });

  it("popula relatorios após fetch e cacheia", async () => {
    const fetchMock = vi.fn(async () => okPayload("PETR4", 20));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useRelatorios(["PETR4"]));
    await waitFor(() => expect(result.current.relatorios.length).toBeGreaterThan(0), { timeout: 3000 });
    expect(result.current.relatorios[0].ticker).toBe("PETR4");

    // segunda renderização com mesmo ticker usa cache (não chama fetch)
    fetchMock.mockClear();
    const { result: r2 } = renderHook(() => useRelatorios(["PETR4"]));
    await waitFor(() => expect(r2.current.relatorios.length).toBeGreaterThan(0));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("setta error quando fetchRelatorios lança", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 }))
    );
    const { result } = renderHook(() => useRelatorios(["XXXX4"]));
    await waitFor(() => expect(result.current.error).toBeTruthy(), { timeout: 3000 });
  });
});
