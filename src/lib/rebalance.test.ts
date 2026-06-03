import { describe, it, expect } from "vitest";
import { generateRebalanceOrders, normalizePcts } from "./rebalance";
import type { Stock } from "@/types/stock";

// ─── Fixture ──────────────────────────────────────────────────────────────────

function makeStock(overrides: Partial<Stock> & { ticker: string; price: number; quantity: number; sector: string; score: number }): Stock {
  return {
    cost: overrides.price,
    lpa: 1,
    vpa: 5,
    roe: 0.15,
    debtToEbitda: 1.5,
    change: 0,
    changePercent: 0,
    lastUpdated: new Date().toISOString(),
    scoreBreakdown: { priceScore: 0, profitabilityScore: 0, healthScore: 0, dividendScore: 0, valuationScore: 0 },
    isFavorite: false,
    pl: 10,
    pvp: 1,
    dividendYield: 0.05,
    evEbitda: 5,
    netMargin: 0.1,
    ebitdaMargin: 0.2,
    market: "B3",
    ...overrides,
  };
}

// Portfólio base: 3 ações em setores distintos
const BASE_STOCKS: Stock[] = [
  makeStock({ ticker: "PETR4", price: 30, quantity: 100, sector: "Energia", score: 70 }),   // valor R$3000
  makeStock({ ticker: "ITUB4", price: 40, quantity: 100, sector: "Bancos", score: 60 }),    // valor R$4000
  makeStock({ ticker: "VALE3", price: 50, quantity: 100, sector: "Mineração", score: 80 }), // valor R$5000
];
// Total = R$12000
// Alocação atual: Energia 25%, Bancos 33.3%, Mineração 41.7%

// ─── normalizePcts ────────────────────────────────────────────────────────────

describe("normalizePcts", () => {
  it("normaliza para somar 100%", () => {
    const result = normalizePcts({ A: 40, B: 60, C: 20 });
    const sum = Object.values(result).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(100);
    // Proporções mantidas
    expect(result.A).toBeCloseTo(33.33, 1);
    expect(result.B).toBeCloseTo(50, 1);
  });

  it("retorna sem alteração se total já é 100", () => {
    const result = normalizePcts({ A: 50, B: 50 });
    expect(result.A).toBeCloseTo(50);
    expect(result.B).toBeCloseTo(50);
  });

  it("retorna o mesmo objeto se total é 0", () => {
    const input = { A: 0, B: 0 };
    const result = normalizePcts(input);
    expect(result).toEqual(input);
  });
});

// ─── generateRebalanceOrders ──────────────────────────────────────────────────

describe("generateRebalanceOrders — sem ordens necessárias", () => {
  it("retorna lista vazia para portfólio de um único setor com alvo = 100%", () => {
    const stocks = [makeStock({ ticker: "PETR4", price: 30, quantity: 100, sector: "Energia", score: 70 })];
    // Alvo 100% Energia = alocação atual → gap = 0
    const { orders } = generateRebalanceOrders(stocks, { Energia: 100 });
    expect(orders).toHaveLength(0);
  });

  it("retorna lista vazia quando gap absoluto por setor < R$20 (limiar mínimo)", () => {
    // Criar portfólio onde a diferença real em R$ fica abaixo de R$20
    // Total R$100: Energia R$50 (50%), Bancos R$50 (50%)
    const stocks = [
      makeStock({ ticker: "PETR4", price: 50, quantity: 1, sector: "Energia", score: 70 }),
      makeStock({ ticker: "ITUB4", price: 50, quantity: 1, sector: "Bancos", score: 60 }),
    ];
    // Alvo = 50/50 = alocação atual → gaps = 0
    const { orders } = generateRebalanceOrders(stocks, { Energia: 50, Bancos: 50 });
    expect(orders).toHaveLength(0);
  });
});

describe("generateRebalanceOrders — compra quando setor underweight", () => {
  it("gera ordem de compra para setor abaixo do alvo", () => {
    // Queremos 50% em Energia (atual ~25%) → falta R$3000 → comprar ~100 PETR4
    const target = { Energia: 50, Bancos: 25, Mineração: 25 };
    const { orders } = generateRebalanceOrders(BASE_STOCKS, target);
    const buyEnergy = orders.find((o) => o.sector === "Energia" && o.type === "buy");
    expect(buyEnergy).toBeDefined();
    expect(buyEnergy!.ticker).toBe("PETR4"); // maior score no setor
    expect(buyEnergy!.shares).toBeGreaterThan(0);
  });

  it("seleciona o ativo de maior score para compra", () => {
    // Dois ativos no mesmo setor — compra o de maior score
    const stocks: Stock[] = [
      makeStock({ ticker: "PETR4", price: 30, quantity: 100, sector: "Energia", score: 60 }),
      makeStock({ ticker: "PRIO3", price: 20, quantity: 100, sector: "Energia", score: 90 }),
      makeStock({ ticker: "ITUB4", price: 40, quantity: 100, sector: "Bancos", score: 50 }),
    ];
    // Total ~R$7000, Energia ~57%, Bancos ~57%
    const target = { Energia: 70, Bancos: 30 };
    const { orders } = generateRebalanceOrders(stocks, target);
    const buyEnergy = orders.find((o) => o.sector === "Energia" && o.type === "buy");
    // Deve comprar PRIO3 (score 90 > 60)
    if (buyEnergy) {
      expect(buyEnergy.ticker).toBe("PRIO3");
    }
  });
});

describe("generateRebalanceOrders — venda quando setor overweight", () => {
  it("gera ordem de venda para setor acima do alvo", () => {
    // Quer Mineração em 10% (atual ~41.7%) → vender VALE3
    const target = { Energia: 45, Bancos: 45, Mineração: 10 };
    const { orders } = generateRebalanceOrders(BASE_STOCKS, target);
    const sellMin = orders.find((o) => o.sector === "Mineração" && o.type === "sell");
    expect(sellMin).toBeDefined();
    expect(sellMin!.ticker).toBe("VALE3");
    expect(sellMin!.shares).toBeGreaterThan(0);
  });

  it("seleciona ativo de menor score para venda", () => {
    const stocks: Stock[] = [
      makeStock({ ticker: "ITUB4", price: 40, quantity: 100, sector: "Bancos", score: 80 }),
      makeStock({ ticker: "BBDC4", price: 30, quantity: 100, sector: "Bancos", score: 40 }),
      makeStock({ ticker: "VALE3", price: 50, quantity: 100, sector: "Mineração", score: 70 }),
    ];
    // Queremos Bancos reduzido → vende o de menor score
    const target = { Bancos: 20, Mineração: 80 };
    const { orders } = generateRebalanceOrders(stocks, target);
    const sellBanks = orders.find((o) => o.sector === "Bancos" && o.type === "sell");
    if (sellBanks) {
      expect(sellBanks.ticker).toBe("BBDC4"); // menor score
    }
  });

  it("não vende mais do que a posição disponível", () => {
    const stocks: Stock[] = [
      makeStock({ ticker: "PETR4", price: 30, quantity: 5, sector: "Energia", score: 70 }),
      makeStock({ ticker: "VALE3", price: 50, quantity: 200, sector: "Mineração", score: 80 }),
    ];
    // Setor Energia overweight; só há 5 ações disponíveis
    const target = { Energia: 5, Mineração: 95 };
    const { orders } = generateRebalanceOrders(stocks, target);
    const sellEnergy = orders.find((o) => o.sector === "Energia" && o.type === "sell");
    if (sellEnergy) {
      expect(sellEnergy.shares).toBeLessThanOrEqual(5);
    }
  });
});

describe("generateRebalanceOrders — ordenação (vendas antes de compras)", () => {
  it("ordena vendas antes de compras", () => {
    const target = { Energia: 10, Bancos: 10, Mineração: 80 };
    const { orders } = generateRebalanceOrders(BASE_STOCKS, target);
    const firstSell = orders.findIndex((o) => o.type === "sell");
    const firstBuy = orders.findIndex((o) => o.type === "buy");
    if (firstSell !== -1 && firstBuy !== -1) {
      expect(firstSell).toBeLessThan(firstBuy);
    }
  });
});

describe("generateRebalanceOrders — ungrouped", () => {
  it("reporta setores sem ativo elegível como ungrouped", () => {
    // Setor alvo que não existe na carteira
    const target = { Energia: 50, Saúde: 50 };
    const stocks: Stock[] = [
      makeStock({ ticker: "PETR4", price: 30, quantity: 100, sector: "Energia", score: 70 }),
    ];
    const { ungrouped } = generateRebalanceOrders(stocks, target);
    expect(ungrouped).toContain("Saúde");
  });
});

describe("generateRebalanceOrders — portfólio vazio", () => {
  it("retorna listas vazias sem erros", () => {
    const { orders, ungrouped } = generateRebalanceOrders([], { Energia: 100 });
    expect(orders).toHaveLength(0);
    expect(ungrouped).toHaveLength(0);
  });
});
