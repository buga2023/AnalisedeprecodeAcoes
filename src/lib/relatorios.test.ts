import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchRelatorios } from "./relatorios";

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function ok(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
    text: async () => "",
  });
}

function fail(status: number) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({}),
    text: async () => "",
  });
}

describe("fetchRelatorios", () => {
  it("retorna trimestres ordenados por dataFim desc", async () => {
    vi.stubGlobal(
      "fetch",
      ok({
        results: [
          {
            symbol: "PETR4",
            incomeStatementHistoryQuarterly: {
              incomeStatementHistory: [
                { endDate: "2024-06-30", netIncome: 10, totalRevenue: 100 },
                { endDate: "2024-09-30", netIncome: 20, totalRevenue: 110 },
              ],
            },
          },
        ],
      })
    );
    const out = await fetchRelatorios("PETR4");
    expect(out).toHaveLength(2);
    expect(new Date(out[0].dataFim).getTime()).toBeGreaterThan(new Date(out[1].dataFim).getTime());
    expect(out[0].resultado).toBe("positivo");
    expect(out[0].periodo).toMatch(/T\d{2}/);
  });

  it("usa TTM quando trimestres ausentes mas financialData presente", async () => {
    vi.stubGlobal(
      "fetch",
      ok({
        results: [
          {
            symbol: "PETR4",
            earningsPerShare: 5,
            financialData: { totalRevenue: 1000, netIncomeToCommon: 100, profitMargins: 0.1 },
          },
        ],
      })
    );
    const out = await fetchRelatorios("PETR4");
    expect(out).toHaveLength(1);
    expect(out[0].periodo).toBe("Últimos 12 meses");
  });

  it("lança quando status é 401/403/429", async () => {
    vi.stubGlobal("fetch", fail(401));
    await expect(fetchRelatorios("PETR4")).rejects.toThrow();
  });

  it("lança quando results vazio", async () => {
    vi.stubGlobal("fetch", ok({ results: [] }));
    await expect(fetchRelatorios("PETR4")).rejects.toThrow();
  });

  it("propaga AbortError", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        controller.abort();
        const err = new DOMException("aborted", "AbortError");
        return Promise.reject(err);
      })
    );
    await expect(fetchRelatorios("PETR4", controller.signal)).rejects.toThrow();
  });
});
