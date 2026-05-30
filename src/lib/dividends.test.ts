import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { detectCadence, fetchDividendHistory, projectDividends, dividendYieldFromHistory } from "./dividends";
import type { DividendEvent } from "./dividends";

beforeEach(() => {
  vi.unstubAllGlobals();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("detectCadence", () => {
  it("retorna 'unknown' para histórico vazio ou com 1 evento", () => {
    expect(detectCadence([])).toBe("unknown");
    expect(detectCadence([{ date: "2024-01-01", amount: 1 }])).toBe("unknown");
  });

  it("detecta cadência mensal (FII pagando todo mês)", () => {
    const history: DividendEvent[] = [
      { date: "2024-01-15", amount: 0.7 },
      { date: "2024-02-15", amount: 0.7 },
      { date: "2024-03-15", amount: 0.7 },
      { date: "2024-04-15", amount: 0.7 },
    ];
    expect(detectCadence(history)).toBe("monthly");
  });

  it("detecta cadência trimestral", () => {
    const history: DividendEvent[] = [
      { date: "2023-04-15", amount: 1 },
      { date: "2023-07-15", amount: 1 },
      { date: "2023-10-15", amount: 1 },
      { date: "2024-01-15", amount: 1 },
    ];
    expect(detectCadence(history)).toBe("quarterly");
  });

  it("detecta cadência semestral", () => {
    const history: DividendEvent[] = [
      { date: "2022-06-01", amount: 2 },
      { date: "2022-12-01", amount: 2 },
      { date: "2023-06-01", amount: 2 },
      { date: "2023-12-01", amount: 2 },
    ];
    expect(detectCadence(history)).toBe("semiannual");
  });

  it("detecta cadência anual", () => {
    const history: DividendEvent[] = [
      { date: "2020-05-10", amount: 3 },
      { date: "2021-05-10", amount: 3 },
      { date: "2022-05-10", amount: 3 },
      { date: "2023-05-10", amount: 3 },
    ];
    expect(detectCadence(history)).toBe("annual");
  });

  it("retorna 'irregular' quando intervalos não batem nenhuma faixa", () => {
    // Intervalos em dias: 40, 150, 200, 100 → mediana 125 (entre quarterly e semiannual).
    const history: DividendEvent[] = [
      { date: "2024-01-01", amount: 1 },
      { date: "2024-02-10", amount: 1 },
      { date: "2024-07-09", amount: 1 },
      { date: "2025-01-25", amount: 1 },
      { date: "2025-05-05", amount: 1 },
    ];
    expect(detectCadence(history)).toBe("irregular");
  });

  it("mediana é robusta a outlier (dividendo extraordinário no meio)", () => {
    // 4 pagamentos trimestrais + 1 extraordinário 5 dias depois do segundo.
    const history: DividendEvent[] = [
      { date: "2023-04-15", amount: 1 },
      { date: "2023-07-15", amount: 1 },
      { date: "2023-07-20", amount: 0.5 }, // outlier de 5 dias
      { date: "2023-10-15", amount: 1 },
      { date: "2024-01-15", amount: 1 },
    ];
    expect(detectCadence(history)).toBe("quarterly");
  });
});

describe("projectDividends", () => {
  const fixedNow = new Date(Date.UTC(2025, 0, 15)); // 2025-01-15

  it("retorna 12 buckets em ordem cronológica começando no mês atual", () => {
    const result = projectDividends({ ticker: "X", quantity: 100 }, [], fixedNow);
    expect(result).toHaveLength(12);
    expect(result[0].month).toBe("2025-01");
    expect(result[11].month).toBe("2025-12");
    expect(result.every((b) => b.amount === 0)).toBe(true);
  });

  it("zera tudo quando quantity é 0", () => {
    const history: DividendEvent[] = [
      { date: "2024-11-15", amount: 1 },
      { date: "2024-12-15", amount: 1 },
    ];
    const result = projectDividends({ ticker: "FII11", quantity: 0 }, history, fixedNow);
    expect(result.every((b) => b.amount === 0)).toBe(true);
  });

  it("cadência mensal: projeta DPA × quantity nos 12 meses", () => {
    const history: DividendEvent[] = [
      { date: "2024-09-15", amount: 0.7 },
      { date: "2024-10-15", amount: 0.7 },
      { date: "2024-11-15", amount: 0.7 },
      { date: "2024-12-15", amount: 0.7 },
    ];
    const result = projectDividends({ ticker: "FII11", quantity: 100 }, history, fixedNow);
    // DPA estimado = 0.7; 100 cotas → 70 por mês em 12 meses.
    expect(result.filter((b) => b.amount === 70)).toHaveLength(12);
  });

  it("cadência trimestral: paga em 3 dos 12 buckets, alinhado com o último pagamento", () => {
    // Último pagamento em 2024-10-15 → próximos pagamentos esperados em
    // 2025-01-15, 2025-04-15, 2025-07-15, 2025-10-15 (4 meses dentro da janela 2025-01..2025-12).
    const history: DividendEvent[] = [
      { date: "2024-01-15", amount: 1 },
      { date: "2024-04-15", amount: 1 },
      { date: "2024-07-15", amount: 1 },
      { date: "2024-10-15", amount: 1 },
    ];
    const result = projectDividends({ ticker: "BBAS3", quantity: 50 }, history, fixedNow);
    const paid = result.filter((b) => b.amount > 0);
    expect(paid).toHaveLength(4);
    expect(paid.map((b) => b.month)).toEqual(["2025-01", "2025-04", "2025-07", "2025-10"]);
    // DPA estimado = 1; 50 cotas → 50 por bucket pago.
    expect(paid.every((b) => b.amount === 50)).toBe(true);
  });

  it("cadência semestral: 2 pagamentos no horizonte de 12 meses", () => {
    const history: DividendEvent[] = [
      { date: "2023-06-01", amount: 2 },
      { date: "2023-12-01", amount: 2 },
      { date: "2024-06-01", amount: 2 },
      { date: "2024-12-01", amount: 2 },
    ];
    const result = projectDividends({ ticker: "ABEV3", quantity: 200 }, history, fixedNow);
    const paid = result.filter((b) => b.amount > 0);
    expect(paid.map((b) => b.month)).toEqual(["2025-06", "2025-12"]);
    expect(paid.every((b) => b.amount === 400)).toBe(true);
  });

  it("cadência anual: 1 pagamento no horizonte", () => {
    const history: DividendEvent[] = [
      { date: "2020-05-10", amount: 3 },
      { date: "2021-05-10", amount: 3 },
      { date: "2022-05-10", amount: 3 },
      { date: "2023-05-10", amount: 3 },
      { date: "2024-05-10", amount: 3 },
    ];
    const result = projectDividends({ ticker: "ITSA4", quantity: 10 }, history, fixedNow);
    const paid = result.filter((b) => b.amount > 0);
    expect(paid).toHaveLength(1);
    expect(paid[0].month).toBe("2025-05");
    expect(paid[0].amount).toBe(30);
  });

  it("cadência irregular: distribui total anual uniformemente nos 12 meses", () => {
    // Mesma série do teste de detectCadence acima — mediana 125 → irregular.
    // Pagamentos dentro do último ano (cutoff = 2024-05-05): 2024-07-09, 2025-01-25, 2025-05-05 = 3.
    // Total anual = 3; quantity 12 → 3 × 12 / 12 = 3 por mês.
    const history: DividendEvent[] = [
      { date: "2024-01-01", amount: 1 },
      { date: "2024-02-10", amount: 1 },
      { date: "2024-07-09", amount: 1 },
      { date: "2025-01-25", amount: 1 },
      { date: "2025-05-05", amount: 1 },
    ];
    const result = projectDividends({ ticker: "X", quantity: 12 }, history, fixedNow);
    expect(result.every((b) => b.amount === 3)).toBe(true);
  });
});

describe("fetchDividendHistory", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { location: { origin: "http://localhost:5173" } });
  });

  it("retorna o array de history quando o proxy responde 200", async () => {
    const payload = {
      ticker: "PETR4",
      history: [
        { date: "2024-01-01", amount: 0.5 },
        { date: "2024-04-01", amount: 0.6 },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }))
    );

    const out = await fetchDividendHistory("petr4");
    expect(out).toHaveLength(2);
    expect(out[0].amount).toBe(0.5);
  });

  it("retorna [] quando o proxy devolve status != 200", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("err", { status: 500 })));
    const out = await fetchDividendHistory("PETR4");
    expect(out).toEqual([]);
  });

  it("retorna [] quando o JSON é malformado", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not json", { status: 200 })));
    const out = await fetchDividendHistory("PETR4");
    expect(out).toEqual([]);
  });

  it("filtra eventos com shape inválido", async () => {
    const payload = {
      history: [
        { date: "2024-01-01", amount: 1 },
        { date: "2024-02-01" }, // sem amount
        { amount: 2 }, // sem date
        null,
        { date: "2024-04-01", amount: 0.5 },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }))
    );

    const out = await fetchDividendHistory("X");
    expect(out).toHaveLength(2);
    expect(out.map((e) => e.amount)).toEqual([1, 0.5]);
  });
});

describe("dividendYieldFromHistory", () => {
  it("soma últimos 12 meses ÷ preço × 100", () => {
    const hist = [
      { date: "2025-09-10", amount: 1 },
      { date: "2025-12-10", amount: 1 },
      { date: "2026-03-10", amount: 1 },
      { date: "2026-05-10", amount: 1 },
    ];
    // último = 2026-05-10; janela 12m pega os 4 → soma 4; preço 100 → 4%
    expect(dividendYieldFromHistory(hist, 100)).toBeCloseTo(4);
  });
  it("retorna 0 sem histórico ou preço inválido", () => {
    expect(dividendYieldFromHistory([], 100)).toBe(0);
    expect(dividendYieldFromHistory([{ date: "2026-05-10", amount: 1 }], 0)).toBe(0);
  });
});
