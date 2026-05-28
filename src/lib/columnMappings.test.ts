import { describe, it, expect } from "vitest";
import { detectColumns } from "./columnMappings";

describe("detectColumns", () => {
  it("mapeia headers padrões pt-BR", () => {
    const { mapping, missing, unmatched } = detectColumns([
      "Ativo",
      "Preço Médio",
      "Quantidade",
      "DPA",
      "LPA",
      "VPA",
    ]);
    expect(mapping.ticker).toBe(0);
    expect(mapping.avgCost).toBe(1);
    expect(mapping.quantity).toBe(2);
    expect(mapping.dpa).toBe(3);
    expect(mapping.eps).toBe(4);
    expect(mapping.bvps).toBe(5);
    expect(missing).toEqual([]);
    expect(unmatched).toEqual([]);
  });

  it("é case e accent insensitive", () => {
    const { mapping } = detectColumns(["PAPEL", "preco medio", "QTD"]);
    expect(mapping.ticker).toBe(0);
    expect(mapping.avgCost).toBe(1);
    expect(mapping.quantity).toBe(2);
  });

  it("relata coluna obrigatória faltando", () => {
    const { missing } = detectColumns(["DPA", "LPA"]);
    expect(missing).toContain("Ticker");
    expect(missing).toContain("Preço Médio");
  });

  it("preserva headers desconhecidos em unmatched", () => {
    const { unmatched } = detectColumns(["Ativo", "Preço Médio", "Coluna Misteriosa"]);
    expect(unmatched).toContain("Coluna Misteriosa");
  });

  it("não sobrepõe um mapeamento já existente", () => {
    const { mapping } = detectColumns(["ticker", "papel"]);
    expect(mapping.ticker).toBe(0);
  });
});
