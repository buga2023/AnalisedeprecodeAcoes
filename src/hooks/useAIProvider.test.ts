import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAIProvider } from "./useAIProvider";

beforeEach(() => {
  localStorage.clear();
});

describe("useAIProvider", () => {
  it("começa com config null", () => {
    const { result } = renderHook(() => useAIProvider());
    expect(result.current.providerConfig).toBeNull();
    expect(result.current.hasConfig).toBe(false);
  });

  it("setProviderConfig grava no localStorage", () => {
    const { result } = renderHook(() => useAIProvider());
    act(() => {
      result.current.setProviderConfig({ provider: "groq", apiKey: "sk-xxx" });
    });
    expect(result.current.providerConfig?.provider).toBe("groq");
    expect(result.current.hasConfig).toBe(true);
    expect(localStorage.getItem("stocks-ai-provider-config")).toContain("groq");
  });

  it("setProviderConfig com apiKey vazia lança", () => {
    const { result } = renderHook(() => useAIProvider());
    expect(() => result.current.setProviderConfig({ provider: "groq", apiKey: "   " })).toThrow(
      /API Key/
    );
  });

  it("setProviderConfig(null) limpa", () => {
    const { result } = renderHook(() => useAIProvider());
    act(() => result.current.setProviderConfig({ provider: "groq", apiKey: "k" }));
    act(() => result.current.setProviderConfig(null));
    expect(result.current.providerConfig).toBeNull();
    expect(localStorage.getItem("stocks-ai-provider-config")).toBeNull();
  });

  it("clearProviderConfig limpa", () => {
    localStorage.setItem("stocks-ai-provider-config", JSON.stringify({ provider: "groq", apiKey: "x" }));
    const { result } = renderHook(() => useAIProvider());
    act(() => result.current.clearProviderConfig());
    expect(result.current.providerConfig).toBeNull();
  });
});
