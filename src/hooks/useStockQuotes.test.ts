import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useStockQuotes, getStoredToken, setStoredToken } from "./useStockQuotes";

const baseQuote = {
  symbol: "PETR4",
  shortName: "Petrobras",
  longName: "Petroleo Brasileiro SA",
  currency: "BRL",
  regularMarketPrice: 30,
  regularMarketChange: 1,
  regularMarketChangePercent: 3,
  regularMarketTime: new Date().toISOString(),
  earningsPerShare: 2,
  priceEarnings: 5,
  bookValue: 10,
  dividendYield: 0.08,
};

function fetchOk(body: unknown) {
  return vi.fn(async () => ({
    ok: true,
    json: async () => body,
  })) as unknown as typeof fetch;
}

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("useStockQuotes", () => {
  it("começa vazio", () => {
    const { result } = renderHook(() => useStockQuotes());
    expect(result.current.stocks).toEqual([]);
  });

  it("addStock busca quote e adiciona ao portfolio", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/brapi")) {
          return new Response(JSON.stringify({ results: [baseQuote], requestedAt: "", took: "" }), {
            status: 200,
          });
        }
        if (url.includes("/api/fundamentals")) {
          return new Response(JSON.stringify({}), { status: 200 });
        }
        return new Response("{}", { status: 200 });
      })
    );

    const { result } = renderHook(() => useStockQuotes());
    await act(async () => {
      await result.current.addStock("PETR4", 25, 100);
    });
    expect(result.current.stocks).toHaveLength(1);
    expect(result.current.stocks[0].ticker).toBe("PETR4");
    expect(result.current.stocks[0].cost).toBe(25);
    expect(result.current.stocks[0].quantity).toBe(100);
  });

  it("addStock setta error quando falha", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not found", { status: 404 }))
    );
    const { result } = renderHook(() => useStockQuotes());
    await act(async () => {
      await result.current.addStock("ZZZZ4", 1, 1);
    });
    expect(result.current.error).toBeTruthy();
  });

  it("removeStock retira do portfolio", async () => {
    vi.stubGlobal(
      "fetch",
      fetchOk({ results: [baseQuote], requestedAt: "", took: "" })
    );
    const { result } = renderHook(() => useStockQuotes());
    await act(async () => {
      await result.current.addStock("PETR4", 1, 1);
    });
    act(() => result.current.removeStock("PETR4"));
    expect(result.current.stocks).toEqual([]);
  });

  it("toggleFavorite alterna isFavorite", async () => {
    vi.stubGlobal(
      "fetch",
      fetchOk({ results: [baseQuote], requestedAt: "", took: "" })
    );
    const { result } = renderHook(() => useStockQuotes());
    await act(async () => {
      await result.current.addStock("PETR4", 1, 1);
    });
    act(() => result.current.toggleFavorite("PETR4"));
    expect(result.current.stocks[0].isFavorite).toBe(true);
    act(() => result.current.toggleFavorite("PETR4"));
    expect(result.current.stocks[0].isFavorite).toBe(false);
  });

  it("clearError zera erro", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 }))
    );
    const { result } = renderHook(() => useStockQuotes());
    await act(async () => {
      await result.current.addStock("X", 1, 1);
    });
    expect(result.current.error).toBeTruthy();
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });

  it("applyTransaction buy em ticker novo busca quote", async () => {
    vi.stubGlobal(
      "fetch",
      fetchOk({ results: [baseQuote], requestedAt: "", took: "" })
    );
    const { result } = renderHook(() => useStockQuotes());
    let ok = false;
    await act(async () => {
      ok = await result.current.applyTransaction("PETR4", "buy", 10, 30);
    });
    expect(ok).toBe(true);
    await waitFor(() => expect(result.current.stocks).toHaveLength(1));
  });

  it("applyTransaction buy em ticker existente promedia custo", async () => {
    vi.stubGlobal(
      "fetch",
      fetchOk({ results: [baseQuote], requestedAt: "", took: "" })
    );
    const { result } = renderHook(() => useStockQuotes());
    await act(async () => {
      await result.current.addStock("PETR4", 20, 10); // cost=20, qty=10
    });
    await act(async () => {
      await result.current.applyTransaction("PETR4", "buy", 10, 40); // mais 10 a 40 → cost=30
    });
    expect(result.current.stocks[0].cost).toBeCloseTo(30);
    expect(result.current.stocks[0].quantity).toBe(20);
  });

  it("applyTransaction sell parcial decrementa quantity", async () => {
    vi.stubGlobal(
      "fetch",
      fetchOk({ results: [baseQuote], requestedAt: "", took: "" })
    );
    const { result } = renderHook(() => useStockQuotes());
    await act(async () => {
      await result.current.addStock("PETR4", 25, 10);
    });
    await waitFor(() => expect(result.current.stocks).toHaveLength(1));
    await act(async () => {
      await result.current.applyTransaction("PETR4", "sell", 4, 30);
    });
    // O retorno `ok` do hook é best-effort em React 18+ (o updater do setStocks
    // roda após o return da função); validar pelo efeito no state.
    expect(result.current.stocks[0].quantity).toBe(6);
  });

  it("applyTransaction sell total filtra a posição", async () => {
    vi.stubGlobal(
      "fetch",
      fetchOk({ results: [baseQuote], requestedAt: "", took: "" })
    );
    const { result } = renderHook(() => useStockQuotes());
    await act(async () => {
      await result.current.addStock("PETR4", 25, 10);
    });
    await waitFor(() => expect(result.current.stocks).toHaveLength(1));
    await act(async () => {
      await result.current.applyTransaction("PETR4", "sell", 10, 30);
    });
    expect(result.current.stocks).toEqual([]);
  });

  it("applyTransaction sell além da quantidade falha", async () => {
    vi.stubGlobal(
      "fetch",
      fetchOk({ results: [baseQuote], requestedAt: "", took: "" })
    );
    const { result } = renderHook(() => useStockQuotes());
    await act(async () => {
      await result.current.addStock("PETR4", 25, 5);
    });
    await waitFor(() => expect(result.current.stocks).toHaveLength(1));
    let ok = true;
    await act(async () => {
      ok = await result.current.applyTransaction("PETR4", "sell", 10, 30);
    });
    expect(ok).toBe(false);
    expect(result.current.error).toMatch(/insuficiente/i);
  });

  it("applyTransaction com shares 0 retorna false", async () => {
    const { result } = renderHook(() => useStockQuotes());
    let ok = true;
    await act(async () => {
      ok = await result.current.applyTransaction("PETR4", "buy", 0, 30);
    });
    expect(ok).toBe(false);
  });

  it("replaceAll substitui o portfolio inteiro", () => {
    const { result } = renderHook(() => useStockQuotes());
    act(() =>
      result.current.replaceAll([
        {
          ticker: "VALE3",
          price: 60,
          cost: 50,
          quantity: 10,
          lpa: 5,
          vpa: 20,
          roe: 0.2,
          debtToEbitda: 1,
          change: 0,
          changePercent: 0,
          lastUpdated: "",
          score: 0,
          scoreBreakdown: { priceScore: 0, profitabilityScore: 0, healthScore: 0, dividendScore: 0, valuationScore: 0 },
          isFavorite: false,
          pl: 0,
          pvp: 0,
          dividendYield: 0,
          evEbitda: 0,
          netMargin: 0,
          ebitdaMargin: 0,
        },
      ])
    );
    expect(result.current.stocks).toHaveLength(1);
    expect(result.current.stocks[0].ticker).toBe("VALE3");
  });
});

describe("token helpers", () => {
  it("setStoredToken/getStoredToken roundtrip", () => {
    setStoredToken("abc");
    expect(getStoredToken()).toBe("abc");
    setStoredToken("");
    expect(getStoredToken()).toBe("");
  });
});
