import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ValuationRow } from "@/types/stock";

const { writeFile } = vi.hoisted(() => ({ writeFile: vi.fn() }));

vi.mock("xlsx", async () => {
  const actual = await vi.importActual<typeof import("xlsx")>("xlsx");
  return {
    ...actual,
    writeFile,
  };
});

import { exportResults } from "./exportResults";

function row(overrides: Partial<ValuationRow> = {}): ValuationRow {
  return {
    ticker: "PETR4",
    avgCost: 30,
    dpa: 3,
    eps: 2,
    bvps: 10,
    quantity: 100,
    currentPrice: 40,
    bazinCeiling: 50,
    bazinSignal: "Comprar",
    bazinMargin: 20,
    grahamVI: 21,
    grahamSignal: "Caro",
    grahamMargin: -90,
    grahamGrowth: 45,
    grahamGrowthSignal: "Comprar",
    grahamGrowthMargin: 11,
    roi: 33,
    patrimony: 4000,
    fetchStatus: "success",
    ...overrides,
  };
}

beforeEach(() => {
  writeFile.mockClear();
});

describe("exportResults", () => {
  it("invoca XLSX.writeFile com um nome derivado da data", () => {
    exportResults([row()]);
    expect(writeFile).toHaveBeenCalledOnce();
    const fileName = writeFile.mock.calls[0][1];
    expect(String(fileName)).toMatch(/^analise-carteira-\d{4}-\d{2}-\d{2}\.xlsx$/);
  });

  it("ajusta sinal geral COMPRAR quando 2+ sinais são Comprar", () => {
    const r = row({ bazinSignal: "Comprar", grahamSignal: "Comprar", grahamGrowthSignal: "Caro" });
    expect(() => exportResults([r])).not.toThrow();
    expect(writeFile).toHaveBeenCalledOnce();
  });

  it("não quebra com row mínimo (campos null)", () => {
    const r = row({
      currentPrice: null,
      bazinCeiling: null,
      bazinMargin: null,
      grahamVI: null,
      grahamMargin: null,
      grahamGrowth: null,
      grahamGrowthMargin: null,
      roi: null,
      patrimony: null,
    });
    expect(() => exportResults([r])).not.toThrow();
    expect(writeFile).toHaveBeenCalled();
  });
});
