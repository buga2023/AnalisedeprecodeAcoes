import { describe, it, expect } from "vitest";
import { scoreNewsItem, scoreFeed, type RelevanceContext } from "./newsRelevance";
import type { WorldNewsItem } from "./context";
import type { Stock, InvestorProfile } from "@/types/stock";

const NOW = Date.parse("2026-05-28T12:00:00Z");

function makeItem(over: Partial<WorldNewsItem> = {}): WorldNewsItem {
  return {
    titulo: "Mercado abre estável após dados de inflação",
    link: "https://example.com/news/1",
    fonte: "Exemplo",
    publicado: "2026-05-28T10:00:00Z",
    origem: "google-news",
    ...over,
  };
}

function makeStock(ticker: string, over: Partial<Stock> = {}): Stock {
  return {
    ticker,
    price: 30,
    cost: 28,
    quantity: 100,
    lpa: 2,
    vpa: 18,
    roe: 0.18,
    debtToEbitda: 1.2,
    change: 0.3,
    changePercent: 1,
    lastUpdated: new Date().toISOString(),
    score: 70,
    scoreBreakdown: { priceScore: 0, profitabilityScore: 0, healthScore: 0, dividendScore: 0, valuationScore: 0 },
    isFavorite: false,
    pl: 8,
    pvp: 1.5,
    dividendYield: 0.06,
    evEbitda: 5,
    netMargin: 0.12,
    ebitdaMargin: 0.25,
    ...over,
  };
}

function makeProfile(over: Partial<InvestorProfile> = {}): InvestorProfile {
  return {
    risk: "mid",
    horizon: "mid",
    interests: ["div"],
    completedAt: "",
    ...over,
  };
}

function makeCtx(over: Partial<RelevanceContext> = {}): RelevanceContext {
  return {
    profile: null,
    stocks: [],
    dominantSectorLabel: null,
    now: NOW,
    ...over,
  };
}

describe("scoreNewsItem", () => {
  it("retorna score 0 sem nenhum sinal", () => {
    const item = makeItem({ publicado: "2020-01-01T00:00:00Z" });
    const r = scoreNewsItem(item, makeCtx());
    expect(r.score).toBe(0);
    expect(r.reasons).toEqual([]);
    expect(r.matchedTickers).toEqual([]);
  });

  it("+30 quando ticker da carteira aparece no título", () => {
    const item = makeItem({ titulo: "Petrobras (PETR4) anuncia novo dividendo", publicado: "2020-01-01T00:00:00Z" });
    const r = scoreNewsItem(item, makeCtx({ stocks: [makeStock("PETR4")] }));
    expect(r.score).toBe(30);
    expect(r.matchedTickers).toEqual(["PETR4"]);
  });

  it("ticker via stem (PETR sem dígito) também conta", () => {
    const item = makeItem({ titulo: "Vale anuncia bonificação", publicado: "2020-01-01T00:00:00Z" });
    const r = scoreNewsItem(item, makeCtx({ stocks: [makeStock("VALE3")] }));
    expect(r.score).toBe(30);
    expect(r.matchedTickers).toEqual(["VALE3"]);
  });

  it("+20 quando palavra-chave do interesse aparece (div)", () => {
    const item = makeItem({ titulo: "Empresas anunciam novos dividendos", publicado: "2020-01-01T00:00:00Z" });
    const r = scoreNewsItem(item, makeCtx({ profile: makeProfile({ interests: ["div"] }) }));
    expect(r.score).toBe(20);
    expect(r.reasons).toContain("interesse: div");
  });

  it("+20 para interesse tec quando título menciona IA", () => {
    const item = makeItem({ titulo: "Empresa investe em inteligência artificial", publicado: "2020-01-01T00:00:00Z" });
    const r = scoreNewsItem(item, makeCtx({ profile: makeProfile({ interests: ["tec"] }) }));
    expect(r.score).toBe(20);
  });

  it("+15 quando tópico bate com setor dominante (Bancos x brasil-fiscal)", () => {
    const item = makeItem({ titulo: "Governo discute arcabouço fiscal", publicado: "2020-01-01T00:00:00Z" });
    const r = scoreNewsItem(item, makeCtx({ dominantSectorLabel: "Bancos" }), "brasil-fiscal");
    expect(r.score).toBe(15);
    expect(r.reasons).toContain("setor dominante: Bancos");
  });

  it("-10 quando perfil low + tom GDELT muito negativo", () => {
    const item = makeItem({ tom: -0.8, publicado: "2020-01-01T00:00:00Z" });
    const r = scoreNewsItem(item, makeCtx({ profile: makeProfile({ risk: "low" }) }));
    expect(r.score).toBe(-10);
    expect(r.reasons).toContain("conservador x notícia muito negativa");
  });

  it("não penaliza quando risk=high com tom negativo", () => {
    const item = makeItem({ tom: -0.8, publicado: "2020-01-01T00:00:00Z" });
    const r = scoreNewsItem(item, makeCtx({ profile: makeProfile({ risk: "high" }) }));
    expect(r.score).toBe(0);
  });

  it("+5 quando publicado < 6h atrás", () => {
    const item = makeItem({ publicado: "2026-05-28T10:00:00Z" });
    const r = scoreNewsItem(item, makeCtx());
    expect(r.score).toBe(5);
    expect(r.reasons).toContain("publicado < 6h");
  });

  it("0 quando publicado tem mais de 6h", () => {
    const item = makeItem({ publicado: "2026-05-27T00:00:00Z" });
    const r = scoreNewsItem(item, makeCtx());
    expect(r.score).toBe(0);
  });

  it("composição: ticker + interesse + recente = 30+20+5", () => {
    const item = makeItem({ titulo: "PETR4 anuncia novo dividendo extraordinário", publicado: "2026-05-28T10:00:00Z" });
    const r = scoreNewsItem(
      item,
      makeCtx({ profile: makeProfile({ interests: ["div"] }), stocks: [makeStock("PETR4")] })
    );
    expect(r.score).toBe(55);
  });

  it("+25 EXTRA quando topic=regulatorio e ticker bate carteira (driver direto de preço)", () => {
    const item = makeItem({
      titulo: "PETR4 publica fato relevante sobre venda de ativo",
      publicado: "2020-01-01T00:00:00Z",
    });
    const r = scoreNewsItem(item, makeCtx({ stocks: [makeStock("PETR4")] }), "regulatorio");
    expect(r.score).toBe(30 + 25);
    expect(r.reasons).toContain("fato relevante de empresa da carteira");
  });

  it("topic=regulatorio sem ticker da carteira NÃO recebe boost extra", () => {
    const item = makeItem({
      titulo: "Cia X publica fato relevante",
      publicado: "2020-01-01T00:00:00Z",
    });
    const r = scoreNewsItem(item, makeCtx({ stocks: [makeStock("PETR4")] }), "regulatorio");
    expect(r.score).toBe(0);
  });
});

describe("scoreFeed", () => {
  it("ordena por score desc, breaktie por data desc", () => {
    const items = [
      { item: makeItem({ titulo: "Notícia genérica", publicado: "2026-05-28T11:00:00Z" }), topic: "geopolitica", topicLabel: "Geo" },
      { item: makeItem({ titulo: "PETR4 sobe forte", publicado: "2026-05-27T00:00:00Z" }), topic: "commodities", topicLabel: "Cm" },
      { item: makeItem({ titulo: "Outra genérica", publicado: "2026-05-28T11:30:00Z" }), topic: "geopolitica", topicLabel: "Geo" },
    ];
    const out = scoreFeed(items, makeCtx({ stocks: [makeStock("PETR4")], now: NOW }));
    expect(out[0].item.titulo).toBe("PETR4 sobe forte");
    expect(out[1].item.titulo).toBe("Outra genérica");
    expect(out[2].item.titulo).toBe("Notícia genérica");
  });

  it("retorna lista vazia quando entrada vazia", () => {
    expect(scoreFeed([], makeCtx())).toEqual([]);
  });
});
