import { describe, it, expect } from "vitest";
import { calculateFIIScore } from "./fiiScore";

describe("calculateFIIScore", () => {
  it("FII ideal pontua ~100", () => {
    const { total, breakdown } = calculateFIIScore({ dividendYield: 10, pvp: 0.9, vacancyRate: 3, segment: "Logística" });
    expect(total).toBe(100);
    expect(breakdown.dividendScore).toBe(40);
    expect(breakdown.valuationScore).toBe(30);
    expect(breakdown.healthScore).toBe(15);
    expect(breakdown.profitabilityScore).toBe(15);
    expect(breakdown.priceScore).toBe(0);
  });
  it("vacância alta derruba o score", () => {
    const { total } = calculateFIIScore({ dividendYield: 10, pvp: 0.9, vacancyRate: 20, segment: "Logística" });
    expect(total).toBe(85);
  });
  it("ágio ao VP (P/VP>1,15) derruba valuation", () => {
    const { breakdown } = calculateFIIScore({ dividendYield: 10, pvp: 1.3, vacancyRate: 3, segment: "Logística" });
    expect(breakdown.valuationScore).toBe(4);
  });
  it("sem vacância renormaliza sobre as dims disponíveis", () => {
    const { total } = calculateFIIScore({ dividendYield: 10, pvp: 0.9, segment: "Logística" });
    expect(total).toBe(100);
  });
  it("segmento desconhecido é neutro, não zera", () => {
    const { breakdown } = calculateFIIScore({ dividendYield: 5, pvp: 1.0, segment: "—" });
    expect(breakdown.profitabilityScore).toBe(8);
  });
  it("DY e P/VP ausentes (<=0) são omitidos da renormalização", () => {
    const { total } = calculateFIIScore({ dividendYield: 0, pvp: 0, segment: "Logística" });
    expect(total).toBe(100);
  });
});
