import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  toPortfolioData,
  fetchAIInsights,
  analisarAcaoComIA,
  compararAcoesComIA,
  PRAXIA_SYSTEM_PROMPT,
} from "./ai";

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("toPortfolioData", () => {
  it("mapeia campos do Stock para PortfolioData com defaults", () => {
    const out = toPortfolioData({
      ticker: "PETR4",
      price: 30,
      change: 1,
      changePercent: 3,
      lpa: 2,
      vpa: 10,
      roe: 0.18,
      dividendYield: 0.08,
      pl: 5,
      pvp: 1,
      debtToEbitda: 1.5,
      netMargin: 0.1,
      score: 80,
    });
    expect(out.ticker).toBe("PETR4");
    expect(out.roic).toBe(0);
    expect(out.grahamValue).toBe(0);
    expect(out.marginOfSafety).toBe(0);
  });

  it("preserva grahamValue e marginOfSafety quando fornecidos", () => {
    const out = toPortfolioData({
      ticker: "PETR4",
      price: 30,
      change: 0,
      changePercent: 0,
      lpa: 0,
      vpa: 0,
      roe: 0,
      dividendYield: 0,
      pl: 0,
      pvp: 0,
      debtToEbitda: 0,
      netMargin: 0,
      score: 0,
      grahamValue: 40,
      marginOfSafety: 25,
    });
    expect(out.grahamValue).toBe(40);
    expect(out.marginOfSafety).toBe(25);
  });
});

describe("PRAXIA_SYSTEM_PROMPT", () => {
  it("contém regras chave da Pra", () => {
    expect(PRAXIA_SYSTEM_PROMPT).toContain("Pra");
    expect(PRAXIA_SYSTEM_PROMPT).toContain("perfil");
  });
});

function makeContextFetch(aiContent: object | string) {
  const text = typeof aiContent === "string" ? aiContent : JSON.stringify(aiContent);
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/api/ai")) {
      return new Response(JSON.stringify({ content: text }), { status: 200 });
    }
    if (url.startsWith("/api/macro")) {
      return new Response(
        JSON.stringify({
          generatedAt: "",
          source: "BCB",
          resumoParaPrompt: "SELIC 10%",
          selicMeta: { valor: 10, data: null, descricao: "" },
          ipcaMensal: { valor: null, data: null, descricao: "" },
          ipca12m: { valor: null, data: null, descricao: "" },
          cdi12m: { valor: null, data: null, descricao: "" },
          igpmMensal: { valor: null, data: null, descricao: "" },
          ibcbr: { valor: null, data: null, descricao: "" },
          ibovespa: { price: null, changePct: null, descricao: "" },
        }),
        { status: 200 }
      );
    }
    if (url.startsWith("/api/world-news")) {
      return new Response(
        JSON.stringify({ generatedAt: "", refreshIntervalMs: 0, source: "x", resumoParaPrompt: "", topics: [] }),
        { status: 200 }
      );
    }
    if (url.startsWith("/api/news")) {
      return new Response(JSON.stringify({ query: "x", source: "y", items: [] }), { status: 200 });
    }
    if (url.startsWith("/api/scrape")) {
      return new Response(JSON.stringify({ ticker: "PETR4", conteudo: "", fonte: "" }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  });
}

describe("fetchAIInsights", () => {
  it("lança quando portfolio vazio", async () => {
    await expect(fetchAIInsights([])).rejects.toThrow(/Nenhum ativo/);
  });

  it("retorna AIResponse com defesas mínimas", async () => {
    vi.stubGlobal(
      "fetch",
      makeContextFetch({ resumo: "ok", sentimento: "neutro", insights: [{ titulo: "t", tipo: "neutro", confianca: "alta", categoria: "x", descricao: "y" }] })
    );
    const out = await fetchAIInsights(
      [
        toPortfolioData({
          ticker: "PETR4",
          price: 30,
          change: 0,
          changePercent: 0,
          lpa: 2,
          vpa: 10,
          roe: 0.18,
          dividendYield: 0.08,
          pl: 5,
          pvp: 1,
          debtToEbitda: 1.5,
          netMargin: 0.1,
          score: 80,
          grahamValue: 40,
          marginOfSafety: 25,
        }),
      ],
      null
    );
    expect(Array.isArray(out.fontes)).toBe(true);
    expect(Array.isArray(out.insights)).toBe(true);
    expect(out.fontes).toContain("Banco Central do Brasil (SGS)");
  });

  it("normaliza insights inválidos para []", async () => {
    vi.stubGlobal(
      "fetch",
      makeContextFetch({ resumo: "x", sentimento: "neutro" })
    );
    const out = await fetchAIInsights(
      [
        toPortfolioData({
          ticker: "PETR4",
          price: 30,
          change: 0,
          changePercent: 0,
          lpa: 2,
          vpa: 10,
          roe: 0.18,
          dividendYield: 0.08,
          pl: 5,
          pvp: 1,
          debtToEbitda: 1.5,
          netMargin: 0.1,
          score: 80,
        }),
      ],
      null
    );
    expect(out.insights).toEqual([]);
  });
});

describe("analisarAcaoComIA", () => {
  it("normaliza recomendação inválida para SEGURAR e garante arrays", async () => {
    vi.stubGlobal(
      "fetch",
      makeContextFetch({
        resumoTrimestral: "x",
        recomendacao: "AAAA",
        justificativa: "y",
        redFlags: null,
        comparacaoTrimestre: "z",
        periodoAnalisado: "3T24",
        fontes: null,
      })
    );
    const out = await analisarAcaoComIA(
      "PETR4",
      "Petrobras",
      {
        cotacao: 30,
        precoTeto: 50,
        margemSeguranca: 0.4,
        score: 80,
        pl: 5,
        pvp: 1,
        roe: 0.18,
        dividendYield: 0.08,
        debtToEbitda: 1.5,
        netMargin: 0.1,
      }
    );
    expect(out.recomendacao).toBe("SEGURAR");
    expect(Array.isArray(out.redFlags)).toBe(true);
    expect(out.fontes).toEqual(expect.arrayContaining(["Yahoo Finance", "calculo do app"]));
  });
});

describe("compararAcoesComIA", () => {
  const base = toPortfolioData({
    ticker: "PETR4",
    price: 30,
    change: 0,
    changePercent: 0,
    lpa: 2,
    vpa: 10,
    roe: 0.18,
    dividendYield: 0.08,
    pl: 5,
    pvp: 1,
    debtToEbitda: 1.5,
    netMargin: 0.1,
    score: 80,
  });

  it("lança com menos de 2 ações", async () => {
    await expect(compararAcoesComIA([base])).rejects.toThrow(/2 ações/);
  });

  it("lança com mais de 4 ações", async () => {
    const lots = [base, { ...base, ticker: "B" }, { ...base, ticker: "C" }, { ...base, ticker: "D" }, { ...base, ticker: "E" }];
    await expect(compararAcoesComIA(lots)).rejects.toThrow(/4 ações/);
  });

  it("normaliza itens e fontes", async () => {
    vi.stubGlobal(
      "fetch",
      makeContextFetch({
        vencedor: "PETR4",
        resumo: "x",
        itens: [{ ticker: "PETR4", recomendacao: "COMPRAR", tese: "y", pros: null, contras: null, fontes: null }],
      })
    );
    const out = await compararAcoesComIA([base, { ...base, ticker: "VALE3" }]);
    expect(out.itens[0].pros).toEqual([]);
    expect(out.itens[0].contras).toEqual([]);
    expect(out.itens[0].fontes).toEqual([]);
    expect(out.fontes).toEqual([]);
  });
});
