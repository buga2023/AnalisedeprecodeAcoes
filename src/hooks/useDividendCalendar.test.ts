import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useDividendCalendar } from "./useDividendCalendar";
import * as dividends from "@/lib/dividends";
import type { DividendEvent } from "@/lib/dividends";

const STOCK_PETR = { ticker: "PETR4", quantity: 100 };
const STOCK_ITUB = { ticker: "ITUB4", quantity: 50 };

function makeHistory(amount: number, datesIso: string[]): DividendEvent[] {
  return datesIso.map((d) => ({ date: d, amount }));
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useDividendCalendar", () => {
  it("retorna 12 buckets zerados quando não há ações com posição", () => {
    const { result } = renderHook(() => useDividendCalendar([]));
    expect(result.current.buckets).toHaveLength(12);
    expect(result.current.buckets.every((b) => b.amount === 0)).toBe(true);
    expect(result.current.byTicker).toEqual({});
    expect(result.current.rawHistoryByTicker).toEqual({});
    expect(result.current.annualTotal).toBe(0);
    expect(result.current.loading).toBe(false);
  });

  it("ignora stocks com quantity <= 0 na signature", () => {
    const { result } = renderHook(() =>
      useDividendCalendar([{ ticker: "X", quantity: 0 }, { ticker: "Y", quantity: -1 }])
    );
    expect(result.current.buckets.every((b) => b.amount === 0)).toBe(true);
    expect(result.current.byTicker).toEqual({});
  });

  it("busca histórico, calcula buckets e expõe rawHistoryByTicker", async () => {
    const spy = vi
      .spyOn(dividends, "fetchDividendHistory")
      .mockImplementation(async (ticker) => {
        if (ticker === "PETR4") {
          return makeHistory(0.5, [
            "2024-09-15",
            "2024-10-15",
            "2024-11-15",
            "2024-12-15",
          ]);
        }
        return [];
      });

    const { result } = renderHook(() => useDividendCalendar([STOCK_PETR]));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(spy).toHaveBeenCalledWith("PETR4");
    expect(result.current.byTicker.PETR4).toHaveLength(12);
    // Cadência mensal × 0,5 DPA × 100 quantidade = 50 por mês
    expect(result.current.annualTotal).toBe(50 * 12);
    expect(result.current.rawHistoryByTicker.PETR4).toHaveLength(4);
  });

  it("usa cache localStorage em re-render subsequente com mesmos tickers", async () => {
    const spy = vi
      .spyOn(dividends, "fetchDividendHistory")
      .mockResolvedValue(makeHistory(0.5, ["2024-09-15", "2024-10-15"]));

    const { result, rerender } = renderHook(
      ({ stocks }: { stocks: typeof STOCK_PETR[] }) => useDividendCalendar(stocks),
      { initialProps: { stocks: [STOCK_PETR] } }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(spy).toHaveBeenCalledTimes(1);

    // mesmo array (signature igual) → effect não dispara de novo
    rerender({ stocks: [STOCK_PETR] });
    // chamar com mesma signature não dispara fetch novo
    expect(spy).toHaveBeenCalledTimes(1);

    // Trocar quantity → signature muda → busca de novo (mas pega do cache localStorage)
    rerender({ stocks: [{ ticker: "PETR4", quantity: 200 }] });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(spy).toHaveBeenCalledTimes(1); // cache hit
    // Quantity dobrou → annualTotal dobra também
    expect(result.current.annualTotal).toBeGreaterThan(0);
  });

  it("refetch() ignora cache e força nova busca", async () => {
    const spy = vi
      .spyOn(dividends, "fetchDividendHistory")
      .mockResolvedValue(makeHistory(0.5, ["2024-09-15", "2024-10-15"]));

    const { result } = renderHook(() => useDividendCalendar([STOCK_PETR]));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(spy).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refetch();
    });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("agrega projeções de múltiplos tickers no mesmo bucket", async () => {
    vi.spyOn(dividends, "fetchDividendHistory").mockImplementation(
      async (ticker) => {
        if (ticker === "PETR4") {
          return makeHistory(0.5, ["2024-09-15", "2024-10-15", "2024-11-15", "2024-12-15"]);
        }
        if (ticker === "ITUB4") {
          return makeHistory(0.4, ["2024-09-15", "2024-10-15", "2024-11-15", "2024-12-15"]);
        }
        return [];
      }
    );

    const { result } = renderHook(() => useDividendCalendar([STOCK_PETR, STOCK_ITUB]));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(Object.keys(result.current.byTicker).sort()).toEqual(["ITUB4", "PETR4"]);
    // PETR4: 0,5 × 100 × 12 = 600 ; ITUB4: 0,4 × 50 × 12 = 240 ; total 840.
    expect(result.current.annualTotal).toBe(840);
  });

  it("ignora cache corrompido no localStorage e re-busca", async () => {
    localStorage.setItem("praxia-dividend-history:PETR4", "isso não é JSON");
    const spy = vi
      .spyOn(dividends, "fetchDividendHistory")
      .mockResolvedValue(makeHistory(0.5, ["2024-10-15"]));

    const { result } = renderHook(() => useDividendCalendar([STOCK_PETR]));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(spy).toHaveBeenCalled();
  });

  it("ignora cache expirado (> 7 dias)", async () => {
    const oldTimestamp = Date.now() - 8 * 24 * 60 * 60 * 1000;
    localStorage.setItem(
      "praxia-dividend-history:PETR4",
      JSON.stringify({ data: makeHistory(0.5, ["2024-10-15"]), cachedAt: oldTimestamp })
    );
    const spy = vi
      .spyOn(dividends, "fetchDividendHistory")
      .mockResolvedValue(makeHistory(0.7, ["2024-12-15"]));

    const { result } = renderHook(() => useDividendCalendar([STOCK_PETR]));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(spy).toHaveBeenCalled();
    // Usou os dados frescos (0,7), não o cache expirado (0,5)
    expect(result.current.rawHistoryByTicker.PETR4?.[0].amount).toBe(0.7);
  });
});
