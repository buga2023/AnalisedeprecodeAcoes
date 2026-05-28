/**
 * Teste de integração — fluxo completo de portfolio.
 *
 * Cobre as camadas conectadas em produção:
 *  api/brapi handler (handler real) ↔ lib/api.ts (fetch) ↔ useStockQuotes hook
 * O único mock é o `fetch` global que substitui a chamada externa pra Yahoo
 * Finance — todo o resto é código real chamando código real.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useStockQuotes } from "@/hooks/useStockQuotes";
import { useBatchValuation } from "@/hooks/useBatchValuation";
import brapiHandler from "../../api/brapi";
import { makeReq, makeRes } from "../../api/test-helpers";

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

/**
 * Roteia `fetch("/api/brapi?endpoint=...")` direto pro handler real local,
 * convertendo URL → request mock → response mock → Response do fetch.
 *
 * Os fetches que partem dentro do handler (Yahoo) chamam o globalFetch passado
 * — assim podemos mockar só a borda externa.
 */
function installLocalBrapiBridge(externalFetch: typeof fetch) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes("/api/brapi")) {
      const parsed = new URL(url, "http://test");
      const query: Record<string, string> = {};
      parsed.searchParams.forEach((v, k) => (query[k] = v));
      const req = makeReq({ method: "GET", query });
      const res = makeRes();
      // Reescreve fetch só pra duração do handler — Yahoo usa o externalFetch.
      const inner = globalThis.fetch;
      globalThis.fetch = externalFetch;
      try {
        await brapiHandler(req, res);
      } finally {
        globalThis.fetch = inner;
      }
      return new Response(JSON.stringify(res.mock.body), {
        status: res.mock.statusCode,
        headers: { "Content-Type": "application/json" },
      });
    }
    return realFetch(input as RequestInfo, init);
  }) as typeof fetch;
}

describe("[integração] portfolio: useStockQuotes ↔ lib/api ↔ api/brapi handler", () => {
  it("addStock percorre todas as camadas e adiciona o stock", async () => {
    const yahooFetch = vi.fn(async (input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("v8/finance/chart")) {
        return new Response(
          JSON.stringify({
            chart: {
              result: [
                {
                  meta: {
                    regularMarketPrice: 32.5,
                    previousClose: 31.0,
                    shortName: "Petrobras",
                    longName: "Petroleo Brasileiro SA",
                    currency: "BRL",
                    regularMarketTime: 1700000000,
                  },
                  timestamp: [1700000000],
                  indicators: {
                    quote: [{ open: [31], high: [33], low: [30.5], close: [32.5], volume: [10000] }],
                  },
                },
              ],
            },
          }),
          { status: 200 }
        );
      }
      if (u.includes("v10/finance/quoteSummary")) {
        return new Response(
          JSON.stringify({
            quoteSummary: {
              result: [
                {
                  defaultKeyStatistics: {
                    trailingEps: { raw: 2.5 },
                    bookValue: { raw: 11.2 },
                    trailingPE: { raw: 5.4 },
                    dividendYield: { raw: 0.08 },
                  },
                  financialData: {
                    returnOnEquity: { raw: 0.18 },
                    totalDebt: { raw: 200 },
                    ebitda: { raw: 100 },
                    profitMargins: { raw: 0.15 },
                    totalRevenue: { raw: 500 },
                    debtToEquity: { raw: 50 },
                  },
                },
              ],
            },
          }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 200 });
    });
    installLocalBrapiBridge(yahooFetch as unknown as typeof fetch);

    const { result } = renderHook(() => useStockQuotes());
    await act(async () => {
      await result.current.addStock("PETR4", 30, 50);
    });
    await waitFor(() => expect(result.current.stocks).toHaveLength(1));

    const s = result.current.stocks[0];
    expect(s.ticker).toBe("PETR4");
    expect(s.price).toBe(32.5);
    expect(s.cost).toBe(30);
    expect(s.quantity).toBe(50);
    // Score derivado das calculadoras a partir dos fundamentos da camada API
    expect(s.score).toBeGreaterThan(0);
    // Persistido em localStorage (camada de cima)
    expect(localStorage.getItem("stocks-ai-portfolio")).toContain("PETR4");
  });

  it("404 do upstream propaga até o erro no hook", async () => {
    const yahooFetch = vi.fn(async () => new Response("", { status: 404 }));
    installLocalBrapiBridge(yahooFetch as unknown as typeof fetch);

    const { result } = renderHook(() => useStockQuotes());
    await act(async () => {
      await result.current.addStock("ZZZZ9", 1, 1);
    });
    expect(result.current.error).toBeTruthy();
    expect(result.current.stocks).toEqual([]);
  });
});

describe("[integração] batch valuation: planilha → calculadora → preço da API", () => {
  it("processa CSV inteiro e calcula valuations com preços da API", async () => {
    const csv = "Ativo,Preço Médio,Quantidade,DPA,LPA,VPA\nPETR4,30,100,3,2,10\nVALE3,60,50,2,5,20\n";
    const file = new File([csv], "carteira.csv", { type: "text/csv" });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const u = String(input);
        if (u.includes("/api/brapi")) {
          return new Response(
            JSON.stringify({
              results: [
                { symbol: "PETR4", regularMarketPrice: 35 },
                { symbol: "VALE3", regularMarketPrice: 70 },
              ],
            }),
            { status: 200 }
          );
        }
        return new Response("{}", { status: 200 });
      })
    );

    const { result } = renderHook(() => useBatchValuation());
    await act(async () => {
      await result.current.startImport(file);
    });
    expect(result.current.pendingData).not.toBeNull();
    const mapping = result.current.pendingData!.initialMapping;
    await act(async () => {
      await result.current.processBatch(mapping as Parameters<typeof result.current.processBatch>[0]);
    });
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    const petr = result.current.rows.find((r) => r.ticker === "PETR4");
    expect(petr).toBeDefined();
    expect(petr?.currentPrice).toBe(35);
    // Bazin = 3 / 0.06 = 50 → margem (50-35)/50 = 30% → "Comprar"
    expect(petr?.bazinSignal).toBe("Comprar");
    // ROI = (35 - 30) / 30 * 100 ≈ 16.67
    expect(petr?.roi).toBeCloseTo(16.666, 1);
  });
});
