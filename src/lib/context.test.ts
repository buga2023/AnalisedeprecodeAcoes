import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchTickerNews,
  fetchTopicNews,
  fetchWorldNews,
  fetchMacroContext,
  buildContextBlock,
  newsUrlsFromBundles,
  urlsFromWorldNews,
  type WorldNewsContext,
} from "./context";

function mockFetchOk(payload: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => payload,
  });
}

function mockFetchFail(status = 500) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({}),
  });
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchTickerNews", () => {
  it("retorna NewsBundle do backend", async () => {
    const payload = { query: "PETR4", source: "Google News RSS", items: [{ titulo: "x", link: "https://a", fonte: "y", publicado: "z" }] };
    vi.stubGlobal("fetch", mockFetchOk(payload));
    const result = await fetchTickerNews("PETR4");
    expect(result.items).toHaveLength(1);
  });

  it("retorna bundle vazio quando backend falha", async () => {
    vi.stubGlobal("fetch", mockFetchFail());
    const r = await fetchTickerNews("ZZZZ4");
    expect(r.items).toEqual([]);
  });

  it("retorna bundle vazio quando fetch lança", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("rede")));
    const r = await fetchTickerNews("AAAA1");
    expect(r.items).toEqual([]);
  });
});

describe("fetchTopicNews", () => {
  it("retorna bundle vazio quando backend falha", async () => {
    vi.stubGlobal("fetch", mockFetchFail());
    const r = await fetchTopicNews("politica");
    expect(r.items).toEqual([]);
  });
});

describe("fetchMacroContext", () => {
  it("retorna null em falha", async () => {
    vi.stubGlobal("fetch", mockFetchFail());
    expect(await fetchMacroContext()).toBeNull();
  });
});

describe("fetchWorldNews", () => {
  it("retorna null em falha", async () => {
    vi.stubGlobal("fetch", mockFetchFail());
    expect(await fetchWorldNews()).toBeNull();
  });
});

describe("buildContextBlock", () => {
  it("retorna string vazia quando nada está disponível", () => {
    expect(buildContextBlock({ macro: null, news: [] })).toBe("");
  });

  it("inclui bloco macro quando há resumoParaPrompt", () => {
    const block = buildContextBlock({
      macro: {
        generatedAt: "2025-01-01",
        source: "BCB",
        selicMeta: { valor: 10, data: "01/01", descricao: "" },
        ipcaMensal: { valor: null, data: null, descricao: "" },
        ipca12m: { valor: null, data: null, descricao: "" },
        cdi12m: { valor: null, data: null, descricao: "" },
        igpmMensal: { valor: null, data: null, descricao: "" },
        ibcbr: { valor: null, data: null, descricao: "" },
        ibovespa: { price: null, changePct: null, descricao: "" },
        resumoParaPrompt: "SELIC 10%",
      },
      news: [],
    });
    expect(block).toContain("CONTEXTO MACROECONÔMICO");
    expect(block).toContain("SELIC 10%");
  });

  it("inclui manchetes de news bundles", () => {
    const block = buildContextBlock({
      macro: null,
      news: [
        {
          query: "PETR4",
          source: "Google News RSS",
          items: [
            { titulo: "Petrobras anuncia", link: "https://x.com/a", fonte: "Globo", publicado: "2025-01-01" },
          ],
        },
      ],
    });
    expect(block).toContain("Petrobras anuncia");
    expect(block).toContain("https://x.com/a");
  });

  it("inclui bloco world news com tópicos", () => {
    const worldNews: WorldNewsContext = {
      generatedAt: "2025-01-01",
      refreshIntervalMs: 7200000,
      source: "GDELT",
      resumoParaPrompt: "",
      topics: [
        {
          topic: "geopolitica",
          description: "Conflitos",
          arbitrageAngle: "Conflito sobe petróleo",
          items: [
            { titulo: "Tensão sobe", link: "https://x.com/g", fonte: "BBC", publicado: "2025-01-01", origem: "bbc" },
          ],
        },
      ],
    };
    const block = buildContextBlock({ macro: null, news: [], worldNews });
    expect(block).toContain("GEOPOLITICA");
    expect(block).toContain("Tensão sobe");
  });
});

describe("newsUrlsFromBundles", () => {
  it("retorna URLs únicas", () => {
    const urls = newsUrlsFromBundles([
      {
        query: "x",
        source: "y",
        items: [
          { titulo: "a", link: "https://a", fonte: "", publicado: "" },
          { titulo: "b", link: "https://a", fonte: "", publicado: "" }, // duplicada
          { titulo: "c", link: "https://c", fonte: "", publicado: "" },
        ],
      },
    ]);
    expect(urls).toEqual(["https://a", "https://c"]);
  });
});

describe("urlsFromWorldNews", () => {
  it("retorna [] para null", () => {
    expect(urlsFromWorldNews(null)).toEqual([]);
  });

  it("agrega URLs únicas dos tópicos", () => {
    const out = urlsFromWorldNews({
      generatedAt: "",
      refreshIntervalMs: 0,
      source: "",
      resumoParaPrompt: "",
      topics: [
        {
          topic: "a",
          description: "",
          arbitrageAngle: "",
          items: [
            { titulo: "x", link: "https://a", fonte: "", publicado: "", origem: "gdelt" },
            { titulo: "y", link: "https://b", fonte: "", publicado: "", origem: "gdelt" },
          ],
        },
        {
          topic: "b",
          description: "",
          arbitrageAngle: "",
          items: [
            { titulo: "z", link: "https://a", fonte: "", publicado: "", origem: "gdelt" },
          ],
        },
      ],
    });
    expect(out).toEqual(["https://a", "https://b"]);
  });
});
