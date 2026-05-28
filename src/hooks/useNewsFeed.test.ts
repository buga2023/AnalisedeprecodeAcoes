import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { Stock, InvestorProfile, ScoreBreakdown } from "@/types/stock";
import type { NewsBundle, WorldNewsContext } from "@/lib/context";

vi.mock("@/lib/context", () => ({
  fetchWorldNews: vi.fn<() => Promise<WorldNewsContext | null>>(),
  fetchTickerNews: vi.fn<(ticker: string, limit?: number) => Promise<NewsBundle>>(),
  fetchRegulatoryNews: vi.fn<(ticker: string, limit?: number) => Promise<NewsBundle>>(),
}));

import { fetchTickerNews, fetchRegulatoryNews, fetchWorldNews } from "@/lib/context";
import { useNewsFeed } from "./useNewsFeed";

const fetchTickerNewsMock = vi.mocked(fetchTickerNews);
const fetchRegulatoryNewsMock = vi.mocked(fetchRegulatoryNews);
const fetchWorldNewsMock = vi.mocked(fetchWorldNews);

const profile: InvestorProfile = {
  risk: "mid",
  horizon: "mid",
  interests: ["div", "gro"],
  completedAt: "2026-05-28T00:00:00.000Z",
};

const emptyBreakdown: ScoreBreakdown = {
  priceScore: 0,
  profitabilityScore: 0,
  healthScore: 0,
  dividendScore: 0,
  valuationScore: 0,
};

function makeStock(ticker: string, sector = "Energia"): Stock {
  return {
    ticker,
    price: 30,
    cost: 25,
    quantity: 10,
    lpa: 3,
    vpa: 12,
    roe: 0.15,
    debtToEbitda: 1.2,
    change: 0.2,
    changePercent: 0.8,
    lastUpdated: new Date().toISOString(),
    score: 60,
    scoreBreakdown: emptyBreakdown,
    isFavorite: false,
    pl: 8,
    pvp: 1.2,
    dividendYield: 0.07,
    evEbitda: 5,
    netMargin: 0.18,
    ebitdaMargin: 0.3,
    sector,
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
  fetchTickerNewsMock.mockReset();
  fetchRegulatoryNewsMock.mockReset();
  fetchWorldNewsMock.mockReset();
});

describe("useNewsFeed", () => {
  it("agrega notícias por ticker, regulatórias e mundiais com dedup por link", async () => {
    fetchWorldNewsMock.mockResolvedValue({
      generatedAt: "",
      refreshIntervalMs: 0,
      source: "agg",
      resumoParaPrompt: "",
      topics: [
        {
          topic: "economia",
          description: "x",
          arbitrageAngle: "y",
          items: [
            {
              titulo: "Selic sobe",
              link: "https://world.example/selic",
              fonte: "BCB",
              publicado: "",
              origem: "google-news",
            },
          ],
        },
      ],
    });
    fetchTickerNewsMock.mockResolvedValue({
      query: "PETR4",
      source: "Google News RSS",
      items: [
        { titulo: "PETR sobe", link: "https://ticker.example/a", fonte: "Valor", publicado: "" },
        // Link duplicado vai ser deduplicado
        { titulo: "Selic sobe (dup)", link: "https://world.example/selic", fonte: "Valor", publicado: "" },
      ],
    });
    fetchRegulatoryNewsMock.mockResolvedValue({
      query: "PETR4",
      source: "Google News RSS",
      items: [
        { titulo: "Fato relevante PETR", link: "https://reg.example/r1", fonte: "CVM", publicado: "" },
      ],
    });

    const { result } = renderHook(() => useNewsFeed(profile, [makeStock("PETR4")]));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // 3 únicos: ticker/a + reg/r1 + world/selic (a duplicata é removida)
    expect(result.current.items).toHaveLength(3);
    const links = result.current.items.map((e) => e.item.link).sort();
    expect(links).toEqual([
      "https://reg.example/r1",
      "https://ticker.example/a",
      "https://world.example/selic",
    ]);
    expect(result.current.error).toBeNull();
  });

  it("filtra itens sem link e expõe worldData para a UI", async () => {
    const world: WorldNewsContext = {
      generatedAt: "",
      refreshIntervalMs: 0,
      source: "agg",
      resumoParaPrompt: "",
      topics: [],
    };
    fetchWorldNewsMock.mockResolvedValue(world);
    fetchTickerNewsMock.mockResolvedValue({
      query: "PETR4",
      source: "x",
      items: [
        { titulo: "Sem link", link: "", fonte: "x", publicado: "" },
        { titulo: "Com link", link: "https://x.example/1", fonte: "x", publicado: "" },
      ],
    });
    fetchRegulatoryNewsMock.mockResolvedValue({ query: "PETR4", source: "x", items: [] });

    const { result } = renderHook(() => useNewsFeed(profile, [makeStock("PETR4")]));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.worldData).toBe(world);
  });

  it("personalItems contém apenas entradas com score >= 30", async () => {
    fetchWorldNewsMock.mockResolvedValue(null);
    fetchTickerNewsMock.mockResolvedValue({
      query: "PETR4",
      source: "x",
      items: [
        // Inclui o ticker no título → ganha pontuação alta
        { titulo: "PETR4 anuncia novo plano de dividendos", link: "https://a.example/1", fonte: "Valor", publicado: "" },
      ],
    });
    fetchRegulatoryNewsMock.mockResolvedValue({ query: "PETR4", source: "x", items: [] });

    const { result } = renderHook(() => useNewsFeed(profile, [makeStock("PETR4")]));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.personalItems.length).toBeGreaterThan(0);
    expect(result.current.personalItems[0].score).toBeGreaterThanOrEqual(30);
  });

  it("setta error quando uma das chamadas lança", async () => {
    fetchWorldNewsMock.mockResolvedValue(null);
    fetchTickerNewsMock.mockRejectedValue(new Error("rede caiu"));
    fetchRegulatoryNewsMock.mockResolvedValue({ query: "PETR4", source: "x", items: [] });

    const { result } = renderHook(() => useNewsFeed(profile, [makeStock("PETR4")]));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toMatch(/rede caiu/);
  });

  it("refresh(true) bate /api/world-news?refresh=1 e recarrega", async () => {
    fetchWorldNewsMock.mockResolvedValue(null);
    fetchTickerNewsMock.mockResolvedValue({ query: "PETR4", source: "x", items: [] });
    fetchRegulatoryNewsMock.mockResolvedValue({ query: "PETR4", source: "x", items: [] });

    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            generatedAt: "",
            refreshIntervalMs: 0,
            source: "force",
            resumoParaPrompt: "",
            topics: [],
          }),
          { status: 200 }
        )
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useNewsFeed(profile, [makeStock("PETR4")]));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.refresh(true);
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/world-news?refresh=1");
  });
});
