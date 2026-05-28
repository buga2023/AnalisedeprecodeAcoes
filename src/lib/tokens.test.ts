import { describe, it, expect } from "vitest";
import { fmt, genSeries, smoothPath, PraxiaTokens, ACCENT_OPTIONS } from "@/components/praxia/tokens";

describe("fmt.brl", () => {
  it("formata como R$ pt-BR com 2 decimais", () => {
    const out = fmt.brl(1234.5);
    expect(out).toMatch(/R\$/);
    expect(out).toMatch(/1\.234,50/);
  });
});

describe("fmt.num", () => {
  it("formata milhares pt-BR", () => {
    expect(fmt.num(1234567)).toMatch(/1\.234\.567/);
  });
});

describe("fmt.pct", () => {
  it("prefixa + para positivo", () => {
    expect(fmt.pct(3.456)).toBe("+3.46%");
  });
  it("não prefixa + para negativo", () => {
    expect(fmt.pct(-1.2)).toBe("-1.20%");
  });
});

describe("fmt.compact", () => {
  it("usa B/M/K conforme grandeza", () => {
    expect(fmt.compact(1.5e9)).toBe("1.5B");
    expect(fmt.compact(2.5e6)).toBe("2.5M");
    expect(fmt.compact(3.5e3)).toBe("3.5K");
    expect(fmt.compact(99)).toBe("99");
  });
});

describe("genSeries", () => {
  it("retorna array com tamanho esperado", () => {
    expect(genSeries(1, 50)).toHaveLength(50);
  });
  it("é determinístico para mesmo seed", () => {
    expect(genSeries(42, 10)).toEqual(genSeries(42, 10));
  });
  it("difere para seeds diferentes", () => {
    expect(genSeries(1, 10)).not.toEqual(genSeries(2, 10));
  });
});

describe("smoothPath", () => {
  it("retorna '' com menos de 2 pontos", () => {
    expect(smoothPath([1], 100, 50)).toBe("");
  });
  it("gera path SVG começando com M", () => {
    const path = smoothPath([1, 2, 3, 4], 100, 50);
    expect(path.startsWith("M ")).toBe(true);
    expect(path).toContain(" C ");
  });
});

describe("PraxiaTokens", () => {
  it("exporta tokens essenciais", () => {
    expect(PraxiaTokens.accent).toBeDefined();
    expect(PraxiaTokens.bg).toBeDefined();
    expect(PraxiaTokens.ink).toBeDefined();
  });
});

describe("ACCENT_OPTIONS", () => {
  it("tem 5 opções", () => {
    expect(ACCENT_OPTIONS).toHaveLength(5);
  });
});
