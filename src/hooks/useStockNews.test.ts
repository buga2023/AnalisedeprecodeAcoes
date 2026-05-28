import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { StockNewsAnalysis } from "@/lib/stockNews";
import type { InvestorProfile } from "@/types/stock";

vi.mock("@/lib/stockNews", async () => {
  const actual = await vi.importActual<typeof import("@/lib/stockNews")>("@/lib/stockNews");
  return {
    ...actual,
    analisarNoticiasAcao: vi.fn(),
    getCachedStockNews: vi.fn<(ticker: string) => StockNewsAnalysis | null>(),
  };
});

import { analisarNoticiasAcao, getCachedStockNews } from "@/lib/stockNews";
import { useStockNews } from "./useStockNews";

const analisarMock = vi.mocked(analisarNoticiasAcao);
const cacheMock = vi.mocked(getCachedStockNews);

const profile: InvestorProfile = {
  risk: "mid",
  horizon: "mid",
  interests: ["gro"],
  completedAt: "2026-05-28T00:00:00.000Z",
};

function makeAnalysis(overrides: Partial<StockNewsAnalysis> = {}): StockNewsAnalysis {
  return {
    ticker: "PETR4",
    resumo: "Pelo seu perfil moderado, ...",
    sentimentoGeral: "positivo",
    itens: [],
    hasMaterial: false,
    fontes: [],
    generatedAt: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  analisarMock.mockReset();
  cacheMock.mockReset();
});

describe("useStockNews", () => {
  it("inicia sem análise e sem cache quando não há entrada salva", () => {
    cacheMock.mockReturnValue(null);
    const { result } = renderHook(() => useStockNews("PETR4", profile));
    expect(result.current.analysis).toBeNull();
    expect(result.current.fromCache).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("inicia já com cache quando getCachedStockNews retorna payload", () => {
    const cached = makeAnalysis({ resumo: "cacheado" });
    cacheMock.mockReturnValue(cached);
    const { result } = renderHook(() => useStockNews("PETR4", profile));
    expect(result.current.analysis?.resumo).toBe("cacheado");
    expect(result.current.fromCache).toBe(true);
  });

  it("load() chama analisarNoticiasAcao e preenche análise", async () => {
    cacheMock.mockReturnValue(null);
    const analysis = makeAnalysis({ resumo: "fresco" });
    analisarMock.mockResolvedValue(analysis);

    const { result } = renderHook(() => useStockNews("PETR4", profile));
    await act(async () => {
      await result.current.load();
    });

    expect(analisarMock).toHaveBeenCalledWith("PETR4", profile);
    expect(result.current.analysis?.resumo).toBe("fresco");
    expect(result.current.fromCache).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("refresh() limpa o cache local e chama IA novamente", async () => {
    cacheMock.mockReturnValue(null);
    localStorage.setItem("praxia-stock-news:PETR4", "cache-stale");
    analisarMock.mockResolvedValue(makeAnalysis({ resumo: "refreshed" }));

    const { result } = renderHook(() => useStockNews("PETR4", profile));
    await act(async () => {
      await result.current.refresh();
    });

    expect(localStorage.getItem("praxia-stock-news:PETR4")).toBeNull();
    expect(result.current.analysis?.resumo).toBe("refreshed");
  });

  it("setta error quando analisarNoticiasAcao lança", async () => {
    cacheMock.mockReturnValue(null);
    analisarMock.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useStockNews("PETR4", profile));
    await act(async () => {
      await result.current.load();
    });

    expect(result.current.error).toBe("boom");
    expect(result.current.analysis).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("ao trocar ticker reseta o estado e tenta cache do novo ticker", async () => {
    cacheMock.mockReturnValue(null);
    const fresh = makeAnalysis({ ticker: "VALE3", resumo: "vale-fresh" });
    analisarMock.mockResolvedValue(fresh);

    const { result, rerender } = renderHook(
      ({ ticker }: { ticker: string }) => useStockNews(ticker, profile),
      { initialProps: { ticker: "PETR4" } }
    );
    expect(result.current.analysis).toBeNull();

    // Cache do segundo ticker já existe
    cacheMock.mockReturnValue(makeAnalysis({ ticker: "VALE3", resumo: "vale-cached" }));
    rerender({ ticker: "VALE3" });

    await waitFor(() => expect(result.current.analysis?.resumo).toBe("vale-cached"));
    expect(result.current.fromCache).toBe(true);
  });

  it("mensagem genérica quando o erro lançado não é Error", async () => {
    cacheMock.mockReturnValue(null);
    analisarMock.mockRejectedValue("string solto");

    const { result } = renderHook(() => useStockNews("PETR4", profile));
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.error).toMatch(/Falha ao analisar/);
  });
});
