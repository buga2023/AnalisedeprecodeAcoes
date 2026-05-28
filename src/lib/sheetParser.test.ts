import { describe, it, expect } from "vitest";
import { normalizeTicker, parseBRNumber, parseSheet } from "./sheetParser";

describe("normalizeTicker", () => {
  it("uppercaseia e remove espaços", () => {
    expect(normalizeTicker("  petr4 ")).toBe("PETR4");
  });
  it("remove sufixo F (fracionário) quando length > 4", () => {
    expect(normalizeTicker("PETR4F")).toBe("PETR4");
  });
  it("preserva tickers curtos terminados em F", () => {
    expect(normalizeTicker("BFRE")).toBe("BFRE");
  });
  it("retorna '' quando vazio", () => {
    expect(normalizeTicker("")).toBe("");
  });
});

describe("parseBRNumber", () => {
  it("parseia formato com . como milhar e , como decimal", () => {
    expect(parseBRNumber("1.234,56")).toBeCloseTo(1234.56);
  });
  it("parseia formato com apenas virgula decimal", () => {
    expect(parseBRNumber("38,50")).toBeCloseTo(38.5);
  });
  it("ignora R$ e espaços", () => {
    expect(parseBRNumber("R$ 1.000,00")).toBeCloseTo(1000);
  });
  it("retorna null para vazio", () => {
    expect(parseBRNumber("")).toBeNull();
  });
  it("retorna null para string não numérica", () => {
    expect(parseBRNumber("abc")).toBeNull();
  });
  it("parseia número simples", () => {
    expect(parseBRNumber("42")).toBe(42);
  });
});

describe("parseSheet", () => {
  it("rejeita formatos não suportados", async () => {
    const file = new File(["x"], "data.txt", { type: "text/plain" });
    await expect(parseSheet(file)).rejects.toThrow(/n[aã]o suportado/i);
  });

  it("parseia CSV com header e linhas", async () => {
    const csv = "Ativo,Preço\nPETR4,30\nVALE3,60\n";
    const file = new File([csv], "carteira.csv", { type: "text/csv" });
    const out = await parseSheet(file);
    expect(out.headers).toEqual(["Ativo", "Preço"]);
    expect(out.totalRows).toBe(2);
    expect(out.rows[0].Ativo).toBe("PETR4");
  });

  it("filtra linhas de total no CSV", async () => {
    const csv = "Ativo,Preço\nPETR4,30\nTotal,100\n";
    const file = new File([csv], "carteira.csv", { type: "text/csv" });
    const out = await parseSheet(file);
    expect(out.totalRows).toBe(1);
  });
});
