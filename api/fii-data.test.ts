import { describe, it, expect } from "vitest";
import { parseFIIFields } from "./fii-data";

describe("parseFIIFields", () => {
  it("extrai vacância com vírgula decimal", () => {
    expect(parseFIIFields("Taxa de Vacância 7,20 % outras infos").vacancyRate).toBeCloseTo(7.2);
  });
  it("extrai vacância inteira", () => {
    expect(parseFIIFields("Vacância Física 0% no período").vacancyRate).toBe(0);
  });
  it("extrai dividend yield", () => {
    expect(parseFIIFields("Dividend Yield 9,80 % ao ano").dividendYield).toBeCloseTo(9.8);
  });
  it("retorna vazio quando não há campos", () => {
    expect(parseFIIFields("Conteúdo irrelevante")).toEqual({});
  });
  it("ignora percentuais absurdos (>100)", () => {
    expect(parseFIIFields("Vacância 250%").vacancyRate).toBeUndefined();
  });
});
