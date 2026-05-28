import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useBatchValuation } from "./useBatchValuation";

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

const csv = "Ativo,Preço Médio,Quantidade,DPA,LPA,VPA\nPETR4,30,100,3,2,10\nVALE3,60,50,2,5,20\n";

describe("useBatchValuation", () => {
  it("começa sem rows nem pendingData", () => {
    const { result } = renderHook(() => useBatchValuation());
    expect(result.current.rows).toEqual([]);
    expect(result.current.pendingData).toBeNull();
  });

  it("startImport popula pendingData", async () => {
    const file = new File([csv], "carteira.csv", { type: "text/csv" });
    const { result } = renderHook(() => useBatchValuation());
    await act(async () => {
      await result.current.startImport(file);
    });
    expect(result.current.pendingData).not.toBeNull();
    expect(result.current.pendingData?.fileName).toBe("carteira.csv");
    expect(result.current.pendingData?.rows).toHaveLength(2);
  });

  it("processBatch chama API e popula rows", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            results: [
              { symbol: "PETR4", regularMarketPrice: 40 },
              { symbol: "VALE3", regularMarketPrice: 70 },
            ],
          }),
          { status: 200 }
        )
      )
    );
    const file = new File([csv], "carteira.csv", { type: "text/csv" });
    const { result } = renderHook(() => useBatchValuation());
    await act(async () => {
      await result.current.startImport(file);
    });
    const mapping = result.current.pendingData!.initialMapping as Record<string, number>;
    await act(async () => {
      await result.current.processBatch(mapping as Parameters<typeof result.current.processBatch>[0]);
    });
    await waitFor(() => expect(result.current.rows.length).toBe(2), { timeout: 3000 });
    expect(result.current.rows[0].currentPrice).toBe(40);
  });

  it("updateGrowthRate recalcula com novo growth", async () => {
    const { result } = renderHook(() => useBatchValuation());
    expect(result.current.growthRate).toBe(7);
    act(() => result.current.updateGrowthRate(10));
    expect(result.current.growthRate).toBe(10);
  });

  it("clearBatch limpa tudo", () => {
    const { result } = renderHook(() => useBatchValuation());
    act(() => result.current.clearBatch());
    expect(result.current.rows).toEqual([]);
    expect(result.current.pendingData).toBeNull();
    // useEffect reescreve "[]" após o removeItem (rows mudou de [] para []),
    // mas o conteúdo continua sem dados.
    const stored = localStorage.getItem("stocks-ai-batch-valuation");
    expect(stored === null || stored === "[]").toBe(true);
  });

  it("cancelImport zera pendingData", async () => {
    const file = new File([csv], "carteira.csv", { type: "text/csv" });
    const { result } = renderHook(() => useBatchValuation());
    await act(async () => {
      await result.current.startImport(file);
    });
    expect(result.current.pendingData).not.toBeNull();
    act(() => result.current.cancelImport());
    expect(result.current.pendingData).toBeNull();
  });
});
