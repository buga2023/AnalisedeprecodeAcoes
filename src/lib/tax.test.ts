import { describe, it, expect } from "vitest";
import { computeMonthlyTax, availableYears } from "./tax";
import type { Transaction } from "@/types/stock";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function tx(
  overrides: Partial<Transaction> & { ticker: string; type: "buy" | "sell"; shares: number; price: number; timestamp: string }
): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    orderType: "Mercado",
    total: overrides.shares * overrides.price,
    fee: 0,
    ...overrides,
  };
}

// ─── availableYears ───────────────────────────────────────────────────────────

describe("availableYears", () => {
  it("retorna vazio quando não há vendas", () => {
    const txs = [tx({ ticker: "PETR4", type: "buy", shares: 10, price: 30, timestamp: "2024-03-01" })];
    expect(availableYears(txs)).toEqual([]);
  });

  it("retorna anos com vendas, mais recente primeiro", () => {
    const txs = [
      tx({ ticker: "PETR4", type: "buy", shares: 10, price: 30, timestamp: "2023-01-10" }),
      tx({ ticker: "PETR4", type: "sell", shares: 5, price: 35, timestamp: "2023-06-15" }),
      tx({ ticker: "VALE3", type: "buy", shares: 5, price: 70, timestamp: "2024-01-10" }),
      tx({ ticker: "VALE3", type: "sell", shares: 5, price: 80, timestamp: "2024-03-20" }),
    ];
    expect(availableYears(txs)).toEqual([2024, 2023]);
  });
});

// ─── computeMonthlyTax — caso vazio ──────────────────────────────────────────

describe("computeMonthlyTax — vazio", () => {
  it("retorna resultado zerado sem transações", () => {
    const r = computeMonthlyTax([]);
    expect(r.months).toHaveLength(0);
    expect(r.totalTaxDue).toBe(0);
    expect(r.swingCarryForward).toBe(0);
  });

  it("ignora transações somente de compra", () => {
    const txs = [tx({ ticker: "PETR4", type: "buy", shares: 10, price: 30, timestamp: "2024-01-15" })];
    const r = computeMonthlyTax(txs);
    expect(r.months).toHaveLength(0);
    expect(r.totalTaxDue).toBe(0);
  });
});

// ─── computeMonthlyTax — isenção swing < R$20k ───────────────────────────────

describe("computeMonthlyTax — isenção swing", () => {
  it("isenta venda swing com total < R$20k", () => {
    const txs = [
      tx({ ticker: "PETR4", type: "buy", shares: 100, price: 30, timestamp: "2024-01-10" }),
      tx({ ticker: "PETR4", type: "sell", shares: 100, price: 35, timestamp: "2024-01-25" }),
    ];
    const r = computeMonthlyTax(txs, 2024);
    expect(r.months).toHaveLength(1);
    const m = r.months[0];
    expect(m.totalSalesBRL).toBe(3500); // 100 × 35
    expect(m.isExemptSwing).toBe(true);
    expect(m.swingTaxDue).toBe(0);
    expect(m.totalTaxDue).toBe(0);
  });

  it("tributa 15% quando venda ≥ R$20k", () => {
    // Compra 1000 ações a R$20, vende a R$25 → lucro R$5000, vendas R$25000 ≥ 20k
    const txs = [
      tx({ ticker: "PETR4", type: "buy", shares: 1000, price: 20, timestamp: "2024-01-10" }),
      tx({ ticker: "PETR4", type: "sell", shares: 1000, price: 25, timestamp: "2024-01-25" }),
    ];
    const r = computeMonthlyTax(txs, 2024);
    const m = r.months[0];
    expect(m.totalSalesBRL).toBe(25000);
    expect(m.isExemptSwing).toBe(false);
    expect(m.swingProfit).toBe(5000);
    // 15% de 5000 = 750
    expect(m.swingTaxDue).toBeCloseTo(750);
    expect(m.totalTaxDue).toBeCloseTo(750);
  });
});

// ─── computeMonthlyTax — custo médio ─────────────────────────────────────────

describe("computeMonthlyTax — custo médio ponderado", () => {
  it("calcula custo médio corretamente em duas compras", () => {
    // Compra 100 a R$20 e 100 a R$30 → custo médio R$25
    // Vende 200 a R$30 → lucro (30-25) × 200 = R$1000; vendas 6000 < 20k → isento
    const txs = [
      tx({ ticker: "ITUB4", type: "buy", shares: 100, price: 20, timestamp: "2024-02-01" }),
      tx({ ticker: "ITUB4", type: "buy", shares: 100, price: 30, timestamp: "2024-02-05" }),
      tx({ ticker: "ITUB4", type: "sell", shares: 200, price: 30, timestamp: "2024-02-20" }),
    ];
    const r = computeMonthlyTax(txs, 2024);
    const m = r.months[0];
    // Custo médio = (100*20 + 100*30) / 200 = 25
    // Lucro = (30 - 25) * 200 = 1000
    expect(m.swingProfit).toBeCloseTo(1000);
    expect(m.isExemptSwing).toBe(true); // 6000 < 20000
    expect(m.totalTaxDue).toBe(0);
  });

  it("venda parcial mantém custo médio para o restante", () => {
    // Compra 200 a R$20, vende 100 a R$30 no mês 1; vende 100 a R$40 no mês 2
    const txs = [
      tx({ ticker: "VALE3", type: "buy", shares: 200, price: 20, timestamp: "2024-01-05" }),
      tx({ ticker: "VALE3", type: "sell", shares: 100, price: 30, timestamp: "2024-01-20" }),
      tx({ ticker: "VALE3", type: "sell", shares: 100, price: 40, timestamp: "2024-02-20" }),
    ];
    const r = computeMonthlyTax(txs, 2024);
    expect(r.months).toHaveLength(2);
    const jan = r.months.find((m) => m.month === 1)!;
    const fev = r.months.find((m) => m.month === 2)!;
    // Jan: lucro (30-20)*100 = 1000
    expect(jan.swingProfit).toBeCloseTo(1000);
    // Fev: custo médio ainda R$20 → lucro (40-20)*100 = 2000
    expect(fev.swingProfit).toBeCloseTo(2000);
  });
});

// ─── computeMonthlyTax — carryforward ────────────────────────────────────────

describe("computeMonthlyTax — carryforward de prejuízo", () => {
  it("acumula prejuízo e compensa no mês seguinte", () => {
    const txs = [
      // Mês 1: compra 1000 a R$30, vende a R$25 → prejuízo R$5000 (vendas 25k, acima do limite)
      tx({ ticker: "PETR4", type: "buy", shares: 1000, price: 30, timestamp: "2024-01-05" }),
      tx({ ticker: "PETR4", type: "sell", shares: 1000, price: 25, timestamp: "2024-01-20" }),
      // Mês 2: compra 1000 a R$20, vende a R$30 → lucro R$10000 (vendas 30k)
      tx({ ticker: "VALE3", type: "buy", shares: 1000, price: 20, timestamp: "2024-02-01" }),
      tx({ ticker: "VALE3", type: "sell", shares: 1000, price: 30, timestamp: "2024-02-20" }),
    ];
    const r = computeMonthlyTax(txs, 2024);
    const jan = r.months.find((m) => m.month === 1)!;
    const fev = r.months.find((m) => m.month === 2)!;

    // Janeiro: prejuízo R$5000; isento porque vendas = 25k ≥ 20k mas lucro negativo → sem IR
    expect(jan.swingLossThisMonth).toBeCloseTo(5000);
    expect(jan.swingTaxDue).toBe(0);

    // Fevereiro: lucro R$10000, mas R$5000 de carryforward → base tributável R$5000 → IR 15% = R$750
    expect(fev.swingCarryForwardUsed).toBeCloseTo(5000);
    expect(fev.taxableSwing).toBeCloseTo(5000);
    expect(fev.swingTaxDue).toBeCloseTo(750);
  });

  it("carryforward restante fica acumulado", () => {
    const txs = [
      // Prejuízo de R$30000 em vendas acima de 20k
      tx({ ticker: "PETR4", type: "buy", shares: 2000, price: 30, timestamp: "2024-01-05" }),
      tx({ ticker: "PETR4", type: "sell", shares: 2000, price: 15, timestamp: "2024-01-20" }),
      // Lucro de R$5000 no mês seguinte (vendas > 20k)
      tx({ ticker: "VALE3", type: "buy", shares: 1000, price: 20, timestamp: "2024-02-01" }),
      tx({ ticker: "VALE3", type: "sell", shares: 1000, price: 25, timestamp: "2024-02-20" }),
    ];
    const r = computeMonthlyTax(txs, 2024);
    // Prejuízo de 30000, lucro de 5000 → offset 5000 → carryforward restante = 25000
    expect(r.swingCarryForward).toBeCloseTo(25000);
  });
});

// ─── computeMonthlyTax — day trade ───────────────────────────────────────────

describe("computeMonthlyTax — day trade", () => {
  it("detecta day trade automaticamente (compra e venda no mesmo dia)", () => {
    const day = "2024-03-15T10:00:00Z";
    const txs = [
      tx({ ticker: "PETR4", type: "buy", shares: 100, price: 30, timestamp: day }),
      tx({ ticker: "PETR4", type: "sell", shares: 100, price: 33, timestamp: "2024-03-15T14:00:00Z" }),
    ];
    const r = computeMonthlyTax(txs, 2024);
    const m = r.months[0];
    // Day trade: 20% sobre R$300 de lucro = R$60
    expect(m.dayTradeProfit).toBeCloseTo(300);
    expect(m.dayTradeTaxDue).toBeCloseTo(60);
    expect(m.swingProfit).toBe(0);
    expect(m.swingTaxDue).toBe(0);
  });

  it("usa flag dayTrade explícito mesmo sem mesmo dia", () => {
    const txs = [
      tx({ ticker: "ITUB4", type: "buy", shares: 200, price: 25, timestamp: "2024-03-10" }),
      tx({ ticker: "ITUB4", type: "sell", shares: 200, price: 28, dayTrade: true, timestamp: "2024-03-11" }),
    ];
    const r = computeMonthlyTax(txs, 2024);
    const m = r.months[0];
    // Lucro = (28-25)*200 = 600; day trade 20% = 120
    expect(m.dayTradeProfit).toBeCloseTo(600);
    expect(m.dayTradeTaxDue).toBeCloseTo(120);
  });
});

// ─── computeMonthlyTax — FIIs ─────────────────────────────────────────────────

describe("computeMonthlyTax — FIIs (20% sem isenção)", () => {
  it("aplica 20% sobre ganho de capital de FII (sem isenção por volume)", () => {
    // Venda de R$5000 de KNRI11 com lucro R$500 → 20% = R$100 (não isento)
    const txs = [
      tx({ ticker: "KNRI11", type: "buy", shares: 100, price: 45, timestamp: "2024-04-01" }),
      tx({ ticker: "KNRI11", type: "sell", shares: 100, price: 50, timestamp: "2024-04-20" }),
    ];
    const r = computeMonthlyTax(txs, 2024);
    const m = r.months[0];
    // Vendas = 5000, lucro = 500
    expect(m.fiiProfit).toBeCloseTo(500);
    expect(m.fiiTaxDue).toBeCloseTo(100); // 20% × 500
    expect(m.swingTaxDue).toBe(0);
    expect(m.swingProfit).toBe(0);
  });

  it("FII prejuízo vira carryforward separado", () => {
    const txs = [
      tx({ ticker: "HGLG11", type: "buy", shares: 100, price: 150, timestamp: "2024-05-01" }),
      tx({ ticker: "HGLG11", type: "sell", shares: 100, price: 130, timestamp: "2024-05-20" }),
    ];
    const r = computeMonthlyTax(txs, 2024);
    // Prejuízo de R$2000
    expect(r.fiiCarryForward).toBeCloseTo(2000);
    expect(r.months[0].fiiTaxDue).toBe(0);
  });
});

// ─── computeMonthlyTax — DARF mínimo ─────────────────────────────────────────

describe("computeMonthlyTax — DARF mínimo R$10", () => {
  it("zera IR quando valor < R$10", () => {
    // Lucro muito pequeno: vendas 25k, lucro R$50 → 15% = R$7.50 < R$10 → não emite DARF
    const txs = [
      tx({ ticker: "BBAS3", type: "buy", shares: 1000, price: 24.95, timestamp: "2024-06-01" }),
      tx({ ticker: "BBAS3", type: "sell", shares: 1000, price: 25, timestamp: "2024-06-20" }),
    ];
    const r = computeMonthlyTax(txs, 2024);
    const m = r.months[0];
    // Vendas = 25000, lucro = 50, IR 15% = 7.50 < 10 → 0
    expect(m.totalTaxDue).toBe(0);
  });
});

// ─── computeMonthlyTax — filterYear ──────────────────────────────────────────

describe("computeMonthlyTax — filterYear", () => {
  it("retorna somente meses do ano filtrado", () => {
    const txs = [
      tx({ ticker: "PETR4", type: "buy", shares: 100, price: 30, timestamp: "2023-01-10" }),
      tx({ ticker: "PETR4", type: "sell", shares: 100, price: 35, timestamp: "2023-06-15" }),
      tx({ ticker: "VALE3", type: "buy", shares: 100, price: 70, timestamp: "2024-01-10" }),
      tx({ ticker: "VALE3", type: "sell", shares: 100, price: 80, timestamp: "2024-03-20" }),
    ];
    const r2023 = computeMonthlyTax(txs, 2023);
    const r2024 = computeMonthlyTax(txs, 2024);
    expect(r2023.months.every((m) => m.year === 2023)).toBe(true);
    expect(r2024.months.every((m) => m.year === 2024)).toBe(true);
    expect(r2023.months).toHaveLength(1);
    expect(r2024.months).toHaveLength(1);
  });

  it("carryforward é calculado sobre TODAS as transações mesmo com filtro de ano", () => {
    const txs = [
      // Prejuízo em 2023 (vendas > 20k)
      tx({ ticker: "PETR4", type: "buy", shares: 2000, price: 30, timestamp: "2023-03-01" }),
      tx({ ticker: "PETR4", type: "sell", shares: 2000, price: 20, timestamp: "2023-03-20" }),
      // Lucro em 2024 (vendas > 20k)
      tx({ ticker: "VALE3", type: "buy", shares: 1000, price: 50, timestamp: "2024-01-10" }),
      tx({ ticker: "VALE3", type: "sell", shares: 1000, price: 70, timestamp: "2024-01-25" }),
    ];
    const r = computeMonthlyTax(txs, 2024);
    const jan = r.months.find((m) => m.year === 2024 && m.month === 1)!;
    // Lucro de R$20000 compensado por carryforward de R$20000 → base R$0 → IR R$0
    expect(jan.swingCarryForwardUsed).toBeCloseTo(20000);
    expect(jan.swingTaxDue).toBe(0);
  });
});
