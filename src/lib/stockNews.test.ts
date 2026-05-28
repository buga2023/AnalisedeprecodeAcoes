import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  analisarNoticiasAcao,
  clearStockNewsCache,
  getCachedStockNews,
  type StockNewsAnalysis,
} from "./stockNews";
import type { InvestorProfile } from "@/types/stock";
import type { NewsBundle } from "./context";

vi.mock("./context", () => ({
  fetchTickerNews: vi.fn<(ticker: string, limit?: number) => Promise<NewsBundle>>(),
}));

import { fetchTickerNews } from "./context";
const fetchTickerNewsMock = vi.mocked(fetchTickerNews);

const sampleProfile: InvestorProfile = {
  risk: "low",
  horizon: "long",
  interests: ["div"],
  completedAt: "2026-05-28T00:00:00.000Z",
};

const bundle: NewsBundle = {
  query: "PETR4",
  source: "Google News RSS",
  items: [
    {
      titulo: "Petrobras anuncia dividendo extra",
      link: "https://example.com/petr-1",
      fonte: "Valor",
      publicado: "2026-05-28",
    },
    {
      titulo: "Petróleo cai 3% no dia",
      link: "https://example.com/petr-2",
      fonte: "Reuters",
      publicado: "2026-05-28",
    },
  ],
};

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  fetchTickerNewsMock.mockReset();
});

describe("getCachedStockNews", () => {
  it("retorna null quando não há cache", () => {
    expect(getCachedStockNews("PETR4")).toBeNull();
  });

  it("retorna o payload quando dentro do TTL", () => {
    const payload: StockNewsAnalysis = {
      ticker: "PETR4",
      resumo: "Pelo seu perfil conservador, ...",
      sentimentoGeral: "positivo",
      itens: [],
      hasMaterial: false,
      fontes: [],
      generatedAt: Date.now(),
    };
    localStorage.setItem(
      "praxia-stock-news:PETR4",
      JSON.stringify({ signature: "sig", payload })
    );
    const out = getCachedStockNews("PETR4");
    expect(out?.ticker).toBe("PETR4");
    expect(out?.sentimentoGeral).toBe("positivo");
  });

  it("retorna null quando o payload expirou (>1h)", () => {
    const payload: StockNewsAnalysis = {
      ticker: "PETR4",
      resumo: "x",
      sentimentoGeral: "neutro",
      itens: [],
      hasMaterial: false,
      fontes: [],
      generatedAt: Date.now() - 2 * 60 * 60 * 1000,
    };
    localStorage.setItem(
      "praxia-stock-news:PETR4",
      JSON.stringify({ signature: "sig", payload })
    );
    expect(getCachedStockNews("PETR4")).toBeNull();
  });

  it("retorna null em JSON inválido", () => {
    localStorage.setItem("praxia-stock-news:PETR4", "{not-json");
    expect(getCachedStockNews("PETR4")).toBeNull();
  });
});

describe("analisarNoticiasAcao — caminho vazio", () => {
  it("devolve emptyAnalysis quando ticker não tem manchetes", async () => {
    fetchTickerNewsMock.mockResolvedValue({ ...bundle, items: [] });
    const out = await analisarNoticiasAcao("VALE3", sampleProfile);
    expect(out.itens).toEqual([]);
    expect(out.fontes).toEqual([]);
    expect(out.hasMaterial).toBe(false);
    expect(out.sentimentoGeral).toBe("neutro");
    expect(out.resumo).toMatch(/Pelo seu perfil conservador/);
  });

  it("usa fallback genérico quando profile=null e sem manchetes", async () => {
    fetchTickerNewsMock.mockResolvedValue({ ...bundle, items: [] });
    const out = await analisarNoticiasAcao("VALE3", null);
    expect(out.resumo).toMatch(/Sem manchetes recentes para VALE3/);
  });
});

describe("analisarNoticiasAcao — chamada IA + cache", () => {
  it("chama /api/ai, classifica itens e cacheia", async () => {
    fetchTickerNewsMock.mockResolvedValue(bundle);

    const iaPayload = {
      resumo: "Pelo seu perfil conservador, dividendo extra [1] reforça tese; petróleo [2] adiciona ruído.",
      sentimentoGeral: "positivo",
      itens: [
        { indice: 1, sentimento: "positivo", material: true, impacto: "Dividendo extra eleva DY." },
        { indice: 2, sentimento: "negativo", material: false, impacto: "Petróleo em queda pressiona receita." },
      ],
      fontes: ["https://example.com/petr-1"],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: JSON.stringify(iaPayload) }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await analisarNoticiasAcao("petr4", sampleProfile);

    expect(out.ticker).toBe("PETR4");
    expect(out.sentimentoGeral).toBe("positivo");
    expect(out.itens).toHaveLength(2);
    expect(out.itens[0].material).toBe(true);
    expect(out.itens[0].sentimento).toBe("positivo");
    expect(out.itens[1].sentimento).toBe("negativo");
    expect(out.hasMaterial).toBe(true);
    // A 2ª manchete tem [2] citada no resumo → link adicionado automaticamente
    expect(out.fontes).toContain("https://example.com/petr-1");
    expect(out.fontes).toContain("https://example.com/petr-2");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // 2ª chamada deve vir do cache — sem novo fetch
    const out2 = await analisarNoticiasAcao("PETR4", sampleProfile);
    expect(out2.resumo).toBe(out.resumo);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("normaliza sentimento desconhecido para 'neutro'", async () => {
    fetchTickerNewsMock.mockResolvedValue(bundle);
    const iaPayload = {
      resumo: "x",
      sentimentoGeral: "explosivo",
      itens: [
        { indice: 1, sentimento: "indecifravel", material: false, impacto: "" },
        { indice: 2, sentimento: undefined, material: false, impacto: "" },
      ],
      fontes: [],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ content: JSON.stringify(iaPayload) }) })
    );
    const out = await analisarNoticiasAcao("PETR4", null);
    expect(out.sentimentoGeral).toBe("neutro");
    expect(out.itens[0].sentimento).toBe("neutro");
    expect(out.itens[1].sentimento).toBe("neutro");
  });

  it("remove fences ```json no inicio/fim do conteudo", async () => {
    fetchTickerNewsMock.mockResolvedValue(bundle);
    const inner = JSON.stringify({
      resumo: "ok",
      sentimentoGeral: "neutro",
      itens: [],
      fontes: [],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ content: "```json\n" + inner + "\n```" }) })
    );
    const out = await analisarNoticiasAcao("PETR4", null);
    expect(out.resumo).toBe("ok");
  });

  it("lança quando /api/ai responde !ok", async () => {
    fetchTickerNewsMock.mockResolvedValue(bundle);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: "sem provider" }) })
    );
    await expect(analisarNoticiasAcao("PETR4", null)).rejects.toThrow(/sem provider/);
  });

  it("lança erro de timeout legível quando fetch aborta", async () => {
    fetchTickerNewsMock.mockResolvedValue(bundle);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }))
    );
    await expect(analisarNoticiasAcao("PETR4", null)).rejects.toThrow(/timeout/i);
  });

  it("invalida cache quando signature (1ª manchete) muda", async () => {
    fetchTickerNewsMock.mockResolvedValue(bundle);
    const iaPayload = {
      resumo: "primeiro",
      sentimentoGeral: "neutro",
      itens: [],
      fontes: [],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: JSON.stringify(iaPayload) }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await analisarNoticiasAcao("PETR4", null);

    // Manchetes diferentes — signature muda → nova chamada IA
    fetchTickerNewsMock.mockResolvedValue({
      ...bundle,
      items: [
        { titulo: "Nova manchete", link: "https://example.com/x", fonte: "x", publicado: "" },
      ],
    });
    fetchMock.mockClear();
    await analisarNoticiasAcao("PETR4", null);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("clearStockNewsCache", () => {
  it("remove apenas a chave do ticker informado", () => {
    localStorage.setItem("praxia-stock-news:PETR4", "x");
    localStorage.setItem("praxia-stock-news:VALE3", "y");
    localStorage.setItem("outra-coisa", "z");
    clearStockNewsCache("petr4");
    expect(localStorage.getItem("praxia-stock-news:PETR4")).toBeNull();
    expect(localStorage.getItem("praxia-stock-news:VALE3")).toBe("y");
    expect(localStorage.getItem("outra-coisa")).toBe("z");
  });

  it("sem ticker, remove todas as chaves do prefixo", () => {
    localStorage.setItem("praxia-stock-news:PETR4", "x");
    localStorage.setItem("praxia-stock-news:VALE3", "y");
    localStorage.setItem("outra-coisa", "z");
    clearStockNewsCache();
    expect(localStorage.getItem("praxia-stock-news:PETR4")).toBeNull();
    expect(localStorage.getItem("praxia-stock-news:VALE3")).toBeNull();
    expect(localStorage.getItem("outra-coisa")).toBe("z");
  });
});
