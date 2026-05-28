import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  useInvestorProfile,
  riskLabel,
  horizonLabel,
  interestLabel,
} from "./useInvestorProfile";

beforeEach(() => {
  localStorage.clear();
});

describe("useInvestorProfile", () => {
  it("começa null quando não há nada salvo", () => {
    const { result } = renderHook(() => useInvestorProfile());
    expect(result.current.profile).toBeNull();
    expect(result.current.hasProfile).toBe(false);
  });

  it("salva perfil + persiste no localStorage", () => {
    const { result } = renderHook(() => useInvestorProfile());
    act(() => {
      result.current.saveProfile({ risk: "mid", horizon: "long", interests: ["div"] });
    });
    expect(result.current.profile?.risk).toBe("mid");
    expect(result.current.hasProfile).toBe(true);
    expect(localStorage.getItem("praxia-investor-profile")).toContain("mid");
  });

  it("reset zera o perfil e remove a chave", () => {
    localStorage.setItem(
      "praxia-investor-profile",
      JSON.stringify({ risk: "low", horizon: "short", interests: ["div"], completedAt: "" })
    );
    const { result } = renderHook(() => useInvestorProfile());
    expect(result.current.profile).not.toBeNull();
    act(() => result.current.reset());
    expect(result.current.profile).toBeNull();
    expect(localStorage.getItem("praxia-investor-profile")).toBeNull();
  });

  it("carrega perfil pré-existente", () => {
    localStorage.setItem(
      "praxia-investor-profile",
      JSON.stringify({ risk: "high", horizon: "long", interests: ["gro"], completedAt: "" })
    );
    const { result } = renderHook(() => useInvestorProfile());
    expect(result.current.profile?.risk).toBe("high");
  });
});

describe("labels", () => {
  it("riskLabel cobre os 3 níveis", () => {
    expect(riskLabel("low")).toBe("Conservador");
    expect(riskLabel("mid")).toBe("Moderado");
    expect(riskLabel("high")).toBe("Arrojado");
  });
  it("horizonLabel cobre os 3 horizontes", () => {
    expect(horizonLabel("short")).toMatch(/Curto/);
    expect(horizonLabel("mid")).toMatch(/Médio/);
    expect(horizonLabel("long")).toMatch(/Longo/);
  });
  it("interestLabel cobre os 4 interesses", () => {
    expect(interestLabel("div")).toBe("Dividendos");
    expect(interestLabel("gro")).toBe("Crescimento");
    expect(interestLabel("esg")).toBe("ESG");
    expect(interestLabel("tec")).toBe("Tecnologia");
  });
});
