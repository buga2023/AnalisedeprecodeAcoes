import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useWorldNews } from "./useWorldNews";

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("useWorldNews", () => {
  it("setta data em sucesso", async () => {
    const payload = { generatedAt: "", refreshIntervalMs: 1, source: "x", resumoParaPrompt: "", topics: [] };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })));
    const { result } = renderHook(() => useWorldNews());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.source).toBe("x");
  });

  it("refresh(true) usa endpoint com refresh=1", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ generatedAt: "", refreshIntervalMs: 0, source: "y", resumoParaPrompt: "", topics: [] }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useWorldNews());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    fetchMock.mockClear();
    await act(async () => {
      await result.current.refresh(true);
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/world-news?refresh=1");
  });

  it("setta error quando fetch lança em refresh force", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ source: "x", topics: [], generatedAt: "", refreshIntervalMs: 0, resumoParaPrompt: "" }), { status: 200 })
      )
    );
    const { result } = renderHook(() => useWorldNews());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    await act(async () => {
      await result.current.refresh(true);
    });
    expect(result.current.error).toBeTruthy();
  });
});
