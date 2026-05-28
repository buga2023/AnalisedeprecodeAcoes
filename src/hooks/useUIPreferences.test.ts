import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useUIPreferences } from "./useUIPreferences";
import { PraxiaTokens } from "@/components/praxia/tokens";

beforeEach(() => {
  localStorage.clear();
});

describe("useUIPreferences", () => {
  it("usa defaults quando nada salvo", () => {
    const { result } = renderHook(() => useUIPreferences());
    expect(result.current.accent).toBe(PraxiaTokens.accent);
    expect(result.current.tone).toBe("casual");
  });

  it("setAccent persiste no localStorage", () => {
    const { result } = renderHook(() => useUIPreferences());
    act(() => result.current.setAccent("#ff0000"));
    expect(result.current.accent).toBe("#ff0000");
    expect(localStorage.getItem("praxia-ui-prefs")).toContain("#ff0000");
  });

  it("setTone alterna casual/formal", () => {
    const { result } = renderHook(() => useUIPreferences());
    act(() => result.current.setTone("formal"));
    expect(result.current.tone).toBe("formal");
  });

  it("carrega prefs salvas (merge com defaults)", () => {
    localStorage.setItem("praxia-ui-prefs", JSON.stringify({ accent: "#abcdef" }));
    const { result } = renderHook(() => useUIPreferences());
    expect(result.current.accent).toBe("#abcdef");
    expect(result.current.tone).toBe("casual");
  });
});
