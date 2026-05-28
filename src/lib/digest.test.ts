import { describe, it, expect, beforeEach } from "vitest";
import { assembleDigestContext, digestContextToPromptJson } from "./digest";
import type { DividendEvent } from "./dividends";
import type { PriceAlert, Stock, Transaction } from "@/types/stock";

function stock(overrides: Partial<Stock> = {}): Stock {
  return {
    ticker: "PETR4",
    price: 36,
    cost: 30,
    quantity: 100,
    lpa: 5,
    vpa: 25,
    roe: 0.2,
    debtToEbitda: 1.2,
    change: 0.5,
    changePercent: 1.4,
    lastUpdated: "",
    score: 75,
    scoreBreakdown: { priceScore: 0, profitabilityScore: 0, healthScore: 0, dividendScore: 0, valuationScore: 0 },
    isFavorite: false,
    pl: 7,
    pvp: 1.4,
    dividendYield: 12,
    evEbitda: 4,
    netMargin: 0.18,
    ebitdaMargin: 0.4,
    ...overrides,
  };
}

// Datas de referência (sábado 30/05/2026; semana ANTERIOR = 18..24 mai 2026)
const NOW = new Date(Date.UTC(2026, 4, 30));
const WEEK_START = new Date(Date.UTC(2026, 4, 18));
const WEEK_END = new Date(Date.UTC(2026, 4, 24, 23, 59, 59, 999));

beforeEach(() => {
  localStorage.clear();
});

describe("assembleDigestContext", () => {
  it("retorna estrutura com isoWeek, patrimonioFim e arrays vazios quando carteira vazia", () => {
    const ctx = assembleDigestContext({
      stocks: [],
      transactions: [],
      dividendHistoryByTicker: {},
      triggeredAlerts: [],
      now: NOW,
    });
    expect(ctx.isoWeek).toMatch(/^\d{4}-W\d{2}$/);
    expect(ctx.patrimonioFim).toBe(0);
    expect(ctx.variacaoSemanaPct).toBeNull();
    expect(ctx.topMover).toBeNull();
    expect(ctx.dividendosRecebidos).toEqual([]);
    expect(ctx.transacoesDaSemana).toEqual([]);
    expect(ctx.alertasDisparados).toEqual([]);
    expect(ctx.noticiasMateriais).toEqual([]);
    expect(ctx.portfolioSnapshot).toEqual([]);
  });

  it("ignora stocks com quantity = 0", () => {
    const ctx = assembleDigestContext({
      stocks: [stock({ quantity: 0 })],
      transactions: [],
      dividendHistoryByTicker: {},
      triggeredAlerts: [],
      now: NOW,
    });
    expect(ctx.portfolioSnapshot).toHaveLength(0);
    expect(ctx.patrimonioFim).toBe(0);
  });

  it("calcula patrimonioFim somando price × quantity dos stocks com posição", () => {
    const ctx = assembleDigestContext({
      stocks: [stock({ price: 10, quantity: 50 }), stock({ ticker: "X", price: 20, quantity: 25 })],
      transactions: [],
      dividendHistoryByTicker: {},
      triggeredAlerts: [],
      now: NOW,
    });
    expect(ctx.patrimonioFim).toBe(500 + 500); // 1000
  });

  it("calcula variacaoSemanaPct quando priceAtWeekStart é fornecido para todos", () => {
    const ctx = assembleDigestContext({
      stocks: [stock({ price: 110, quantity: 10 })], // patrimônio fim = 1100
      transactions: [],
      dividendHistoryByTicker: {},
      triggeredAlerts: [],
      priceAtWeekStart: { PETR4: 100 }, // patrimônio início = 1000
      now: NOW,
    });
    expect(ctx.variacaoSemanaPct).toBe(10); // +10%
  });

  it("variacaoSemanaPct = null quando preço de início é inválido", () => {
    const ctx = assembleDigestContext({
      stocks: [stock({ price: 110, quantity: 10 })],
      transactions: [],
      dividendHistoryByTicker: {},
      triggeredAlerts: [],
      priceAtWeekStart: { PETR4: 0 }, // inválido (≤ 0)
      now: NOW,
    });
    expect(ctx.variacaoSemanaPct).toBeNull();
  });

  it("variacaoSemanaPct = null quando UM dos tickers da carteira não tem preço de início", () => {
    const ctx = assembleDigestContext({
      stocks: [stock({ ticker: "PETR4", price: 110, quantity: 10 }), stock({ ticker: "X", price: 50, quantity: 20 })],
      transactions: [],
      dividendHistoryByTicker: {},
      triggeredAlerts: [],
      priceAtWeekStart: { PETR4: 100 }, // X falta
      now: NOW,
    });
    expect(ctx.variacaoSemanaPct).toBeNull();
  });

  it("topMover prefere o maior impacto absoluto em R$", () => {
    const ctx = assembleDigestContext({
      stocks: [
        stock({ ticker: "A", change: 1, changePercent: 5, quantity: 10 }), // impacto R$10
        stock({ ticker: "B", change: -2, changePercent: -1, quantity: 100 }), // impacto R$-200 (mais forte)
      ],
      transactions: [],
      dividendHistoryByTicker: {},
      triggeredAlerts: [],
      now: NOW,
    });
    expect(ctx.topMover?.ticker).toBe("B");
    expect(ctx.topMover?.impactoR$).toBe(-200);
  });

  it("inclui dividendos pagos DENTRO da semana e ignora fora", () => {
    const history: DividendEvent[] = [
      { date: "2026-05-15", amount: 0.5 }, // ANTES da semana
      { date: "2026-05-20", amount: 0.7 }, // DENTRO
      { date: "2026-05-22", amount: 0.3 }, // DENTRO
      { date: "2026-05-28", amount: 0.4 }, // DEPOIS
    ];
    const ctx = assembleDigestContext({
      stocks: [stock({ quantity: 100 })],
      transactions: [],
      dividendHistoryByTicker: { PETR4: history },
      triggeredAlerts: [],
      now: NOW,
    });
    expect(ctx.dividendosRecebidos).toHaveLength(2);
    expect(ctx.totalDividendosSemana).toBe(0.7 * 100 + 0.3 * 100);
  });

  it("inclui transações da semana e ignora fora", () => {
    const tx: Transaction[] = [
      {
        id: "1",
        ticker: "PETR4",
        type: "buy",
        orderType: "Mercado",
        shares: 10,
        price: 36,
        total: 360,
        fee: 0,
        timestamp: "2026-05-20T10:00:00Z", // DENTRO
      },
      {
        id: "2",
        ticker: "X",
        type: "sell",
        orderType: "Mercado",
        shares: 5,
        price: 10,
        total: 50,
        fee: 0,
        timestamp: "2026-04-30T10:00:00Z", // FORA
      },
    ];
    const ctx = assembleDigestContext({
      stocks: [stock()],
      transactions: tx,
      dividendHistoryByTicker: {},
      triggeredAlerts: [],
      now: NOW,
      weekStart: WEEK_START,
      weekEnd: WEEK_END,
    });
    expect(ctx.transacoesDaSemana).toHaveLength(1);
    expect(ctx.transacoesDaSemana[0].ticker).toBe("PETR4");
  });

  it("inclui alertas disparados DENTRO da semana", () => {
    const alerts: PriceAlert[] = [
      {
        id: "a1",
        ticker: "PETR4",
        type: "price-above",
        value: 35,
        createdAt: "2026-05-01T00:00:00Z",
        triggeredAt: "2026-05-21T08:00:00Z", // DENTRO
        triggerPrice: 36,
      },
      {
        id: "a2",
        ticker: "X",
        type: "price-below",
        value: 10,
        createdAt: "2026-05-01T00:00:00Z",
        triggeredAt: "2026-04-30T00:00:00Z", // FORA
      },
    ];
    const ctx = assembleDigestContext({
      stocks: [stock()],
      transactions: [],
      dividendHistoryByTicker: {},
      triggeredAlerts: alerts,
      now: NOW,
      weekStart: WEEK_START,
      weekEnd: WEEK_END,
    });
    expect(ctx.alertasDisparados).toHaveLength(1);
    expect(ctx.alertasDisparados[0].ticker).toBe("PETR4");
  });

  it("portfolioSnapshot calcula peso percentual de cada ticker", () => {
    const ctx = assembleDigestContext({
      stocks: [
        stock({ ticker: "A", price: 100, quantity: 10 }), // 1000 → 50%
        stock({ ticker: "B", price: 50, quantity: 20 }), // 1000 → 50%
      ],
      transactions: [],
      dividendHistoryByTicker: {},
      triggeredAlerts: [],
      now: NOW,
    });
    expect(ctx.portfolioSnapshot).toHaveLength(2);
    expect(ctx.portfolioSnapshot[0].weight).toBe(50);
    expect(ctx.portfolioSnapshot[1].weight).toBe(50);
  });

  it("isoWeek aponta para a semana ANTERIOR a `now`", () => {
    // NOW = 2026-05-30 (sábado) → semana W22 (25..31) é a atual, W21 (18..24) é a anterior
    const ctx = assembleDigestContext({
      stocks: [],
      transactions: [],
      dividendHistoryByTicker: {},
      triggeredAlerts: [],
      now: NOW,
    });
    expect(ctx.isoWeek).toBe("2026-W21");
  });
});

describe("digestContextToPromptJson", () => {
  it("retorna JSON parsável", () => {
    const ctx = assembleDigestContext({
      stocks: [],
      transactions: [],
      dividendHistoryByTicker: {},
      triggeredAlerts: [],
      now: NOW,
    });
    const json = digestContextToPromptJson(ctx);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("trunca arrays grandes pra economizar tokens", () => {
    const manyTx: Transaction[] = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      ticker: "PETR4",
      type: "buy",
      orderType: "Mercado",
      shares: 1,
      price: 36,
      total: 36,
      fee: 0,
      timestamp: "2026-05-20T10:00:00Z",
    }));
    const ctx = assembleDigestContext({
      stocks: [stock()],
      transactions: manyTx,
      dividendHistoryByTicker: {},
      triggeredAlerts: [],
      now: NOW,
      weekStart: WEEK_START,
      weekEnd: WEEK_END,
    });
    const parsed = JSON.parse(digestContextToPromptJson(ctx));
    expect(parsed.transacoesDaSemana.length).toBeLessThanOrEqual(8);
  });
});
