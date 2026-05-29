import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import handler from "./fundamentals-history";
import { makeReq, makeRes } from "./test-helpers";

/**
 * Unit — historico trimestral de fundamentos (Yahoo quoteSummary v10).
 * Rate-limit 30/min/IP → IPs unicos por teste.
 */

let ipCounter = 0;
function reqWithUniqueIp(opts: Parameters<typeof makeReq>[0] = {}) {
  ipCounter += 1;
  return makeReq({
    ...opts,
    headers: { ...(opts.headers ?? {}), "x-forwarded-for": `10.5.0.${ipCounter % 250}` },
  });
}

const ts = (y: number, m: number, d: number) => Math.floor(Date.UTC(y, m - 1, d) / 1000);

function income(endDate: number, netIncome: number, revenue: number, ebit: number) {
  return {
    endDate: { raw: endDate },
    netIncome: { raw: netIncome },
    totalRevenue: { raw: revenue },
    ebit: { raw: ebit },
  };
}
function balance(endDate: number, equity: number, shortDebt: number, longDebt: number) {
  return {
    endDate: { raw: endDate },
    totalStockholderEquity: { raw: equity },
    shortLongTermDebt: { raw: shortDebt },
    longTermDebt: { raw: longDebt },
  };
}

function yahooPayload() {
  const q1 = ts(2024, 3, 31);
  const q2 = ts(2024, 6, 30);
  const q3 = ts(2024, 9, 30);
  const q4 = ts(2024, 12, 31);
  return {
    quoteSummary: {
      error: null,
      result: [
        {
          // Ordem descendente de proposito — o handler reordena crescente.
          incomeStatementHistoryQuarterly: {
            incomeStatementHistory: [
              income(q4, 130, 1300, 230),
              income(q3, 120, 1200, 220),
              income(q2, 110, 1100, 210),
              income(q1, 100, 1000, 200),
            ],
          },
          balanceSheetHistoryQuarterly: {
            balanceSheetStatements: [
              balance(q4, 2500, 500, 1500), // totalDebt 2000
              balance(q3, 2000, 0, 0),
              balance(q2, 2000, 0, 0),
              balance(q1, 2000, 0, 0),
            ],
          },
          summaryDetail: {
            dividendYield: { raw: 0.06 },
            trailingPE: { raw: 8 },
          },
        },
      ],
    },
  };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api/fundamentals-history", () => {
  it("responde a preflight OPTIONS", async () => {
    const res = makeRes();
    await handler(reqWithUniqueIp({ method: "OPTIONS" }), res);
    expect(res.mock.ended).toBe(true);
    expect([200, 204]).toContain(res.mock.statusCode);
  });

  it("400 quando sem ticker", async () => {
    const res = makeRes();
    await handler(reqWithUniqueIp(), res);
    expect(res.mock.statusCode).toBe(400);
  });

  it("400 quando ticker tem formato invalido", async () => {
    const res = makeRes();
    await handler(reqWithUniqueIp({ query: { ticker: "PETR456" } }), res);
    expect(res.mock.statusCode).toBe(400);
    expect((res.mock.body as { error: string }).error).toContain("invalido");
  });

  it("200 com quarters vazios quando Yahoo nao retorna dados", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 404 })));
    const res = makeRes();
    await handler(reqWithUniqueIp({ query: { ticker: "XPTO3" } }), res);
    expect(res.mock.statusCode).toBe(200);
    const body = res.mock.body as { quarters: unknown[]; note?: string };
    expect(body.quarters).toEqual([]);
    expect(body.note).toBeDefined();
  });

  it("tenta sufixo .SA antes do ticker puro", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(url);
        return new Response(JSON.stringify(yahooPayload()), { status: 200 });
      })
    );
    const res = makeRes();
    await handler(reqWithUniqueIp({ query: { ticker: "petr4" } }), res);
    expect(res.mock.statusCode).toBe(200);
    expect(urls[0]).toContain("PETR4.SA");
  });

  it("constroi quarters ordenados com metricas derivadas reais", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(yahooPayload()), { status: 200 }))
    );
    const res = makeRes();
    await handler(reqWithUniqueIp({ query: { ticker: "PETR4" } }), res);

    expect(res.mock.statusCode).toBe(200);
    const body = res.mock.body as {
      ticker: string;
      quarters: {
        periodo: string;
        dataFim: string;
        roe?: number;
        netMargin?: number;
        debtToEbitda?: number;
        dy?: number;
        pl?: number;
      }[];
    };

    expect(body.ticker).toBe("PETR4");
    expect(body.quarters.map((q) => q.periodo)).toEqual(["1T24", "2T24", "3T24", "4T24"]);

    const first = body.quarters[0];
    expect(first.roe).toBeCloseTo(0.2, 5); // 100*4/2000
    expect(first.netMargin).toBeCloseTo(0.1, 5); // 100/1000
    expect(first.debtToEbitda).toBeUndefined(); // sem divida no 1T

    const last = body.quarters[3];
    expect(last.roe).toBeCloseTo(0.208, 3); // 130*4/2500
    expect(last.netMargin).toBeCloseTo(0.1, 5); // 130/1300
    // debt/EBITDA TTM: totalDebt 2000 / (200+210+220+230) = 2000/860
    expect(last.debtToEbitda).toBeCloseTo(2000 / 860, 4);
    // DY/PL atuais anexados so ao ultimo trimestre.
    expect(last.dy).toBe(0.06);
    expect(last.pl).toBe(8);
  });
});
