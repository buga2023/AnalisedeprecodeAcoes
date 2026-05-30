import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchFundamentalHistory,
  deriveQuartersFromRelatorios,
  mergeQuarters,
  hasMeaningfulHistory,
} from "@/lib/fundamentalsHistory";
import type { FundamentalQuarter, Relatorio } from "@/types/stock";

/**
 * Unit — cliente e helpers de historico de fundamentos.
 * `fetchFundamentalHistory` usa window.location.origin (jsdom) + fetch (stub).
 */

function quarter(overrides: Partial<FundamentalQuarter> = {}): FundamentalQuarter {
  return { periodo: "1T25", dataFim: "2025-03-31", ...overrides };
}

function relatorio(overrides: Partial<Relatorio> = {}): Relatorio {
  return {
    ticker: "PETR4",
    periodo: "1T25",
    dataFim: "2025-03-31",
    lucroLiquido: 100,
    receita: 1000,
    resultado: "positivo",
    ...overrides,
  };
}

describe("fetchFundamentalHistory", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normaliza ticker pra maiusculas na query e devolve o payload", async () => {
    let seenUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        seenUrl = url;
        return new Response(
          JSON.stringify({ ticker: "PETR4", quarters: [quarter()], source: "Yahoo Finance", generatedAt: "x" }),
          { status: 200 }
        );
      })
    );
    const res = await fetchFundamentalHistory("petr4");
    expect(seenUrl).toContain("ticker=PETR4");
    expect(res.quarters).toHaveLength(1);
    expect(res.ticker).toBe("PETR4");
  });

  it("HTTP nao-ok degrada para resposta vazia com error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 503 })));
    const res = await fetchFundamentalHistory("VALE3");
    expect(res.quarters).toEqual([]);
    expect(res.error).toBe("HTTP 503");
    expect(res.ticker).toBe("VALE3");
  });
});

describe("deriveQuartersFromRelatorios", () => {
  it("ordena por dataFim crescente e filtra sem dataFim", () => {
    const out = deriveQuartersFromRelatorios([
      relatorio({ dataFim: "2025-06-30", periodo: "2T25" }),
      relatorio({ dataFim: "", periodo: "?" }),
      relatorio({ dataFim: "2025-03-31", periodo: "1T25" }),
    ]);
    expect(out.map((q) => q.dataFim)).toEqual(["2025-03-31", "2025-06-30"]);
  });

  it("usa margem reportada quando presente", () => {
    const [q] = deriveQuartersFromRelatorios([relatorio({ margem: 0.25 })]);
    expect(q.netMargin).toBe(0.25);
  });

  it("deriva margem de lucro/receita quando margem ausente", () => {
    const [q] = deriveQuartersFromRelatorios([relatorio({ lucroLiquido: 200, receita: 1000, margem: undefined })]);
    expect(q.netMargin).toBeCloseTo(0.2, 5);
  });

  it("netMargin undefined quando receita <= 0", () => {
    const [q] = deriveQuartersFromRelatorios([relatorio({ receita: 0, margem: undefined })]);
    expect(q.netMargin).toBeUndefined();
    expect(q.revenue).toBeUndefined();
  });
});

describe("mergeQuarters", () => {
  it("retorna o outro lado quando um esta vazio", () => {
    const reports = [quarter()];
    expect(mergeQuarters([], reports)).toBe(reports);
    const yahoo = [quarter()];
    expect(mergeQuarters(yahoo, [])).toBe(yahoo);
  });

  it("Yahoo prevalece; relatorios so completam campos faltantes", () => {
    const yahoo = [quarter({ dataFim: "2025-03-31", netMargin: 0.3, revenue: undefined })];
    const reports = [quarter({ dataFim: "2025-03-31", netMargin: 0.9, revenue: 500 })];
    const [merged] = mergeQuarters(yahoo, reports);
    expect(merged.netMargin).toBe(0.3); // Yahoo vence
    expect(merged.revenue).toBe(500); // completado pelo relatorio
  });

  it("inclui trimestres exclusivos de relatorios e ordena por data", () => {
    const yahoo = [quarter({ dataFim: "2025-06-30", periodo: "2T25" })];
    const reports = [quarter({ dataFim: "2025-03-31", periodo: "1T25" })];
    const out = mergeQuarters(yahoo, reports);
    expect(out.map((q) => q.dataFim)).toEqual(["2025-03-31", "2025-06-30"]);
  });
});

describe("hasMeaningfulHistory", () => {
  it("false com menos de 4 trimestres", () => {
    expect(hasMeaningfulHistory([quarter({ roe: 0.2 }), quarter(), quarter()])).toBe(false);
  });

  it("false quando 4+ trimestres mas todas as metricas vazias", () => {
    expect(hasMeaningfulHistory([quarter(), quarter(), quarter(), quarter()])).toBe(false);
  });

  it("true quando 4+ trimestres e ao menos uma metrica preenchida", () => {
    const qs = [quarter(), quarter(), quarter(), quarter({ netMargin: 0.1 })];
    expect(hasMeaningfulHistory(qs)).toBe(true);
  });
});
