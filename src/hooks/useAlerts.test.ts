import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAlerts, alertTypeLabel, formatAlertTrigger } from "./useAlerts";
import type { Stock } from "@/types/stock";

function stock(overrides: Partial<Stock> = {}): Stock {
  return {
    ticker: "PETR4",
    price: 30,
    cost: 25,
    quantity: 0,
    lpa: 2,
    vpa: 10,
    roe: 0,
    debtToEbitda: 0,
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
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  // Notification existe no setup; resetar permissão
  Object.defineProperty(Notification, "permission", { value: "default", configurable: true });
});

describe("useAlerts", () => {
  it("começa sem alertas", () => {
    const { result } = renderHook(() => useAlerts());
    expect(result.current.alerts).toEqual([]);
  });

  it("createAlert adiciona e persiste", () => {
    const { result } = renderHook(() => useAlerts());
    act(() => {
      result.current.createAlert({ ticker: "PETR4", type: "price-above", value: 50 });
    });
    expect(result.current.alerts).toHaveLength(1);
    expect(result.current.activeAlerts).toHaveLength(1);
    expect(localStorage.getItem("praxia-alerts")).toContain("PETR4");
  });

  it("removeAlert remove pelo id", () => {
    const { result } = renderHook(() => useAlerts());
    let id = "";
    act(() => {
      id = result.current.createAlert({ ticker: "X", type: "price-above", value: 1 }).id;
    });
    act(() => result.current.removeAlert(id));
    expect(result.current.alerts).toEqual([]);
  });

  it("checkAlerts dispara price-above quando preço atinge alvo", () => {
    const { result } = renderHook(() => useAlerts());
    act(() => {
      result.current.createAlert({ ticker: "PETR4", type: "price-above", value: 25 });
    });
    let fired: ReturnType<typeof result.current.checkAlerts> = [];
    act(() => {
      fired = result.current.checkAlerts([stock({ price: 30 })]);
    });
    expect(fired).toHaveLength(1);
    expect(result.current.triggeredAlerts).toHaveLength(1);
  });

  it("checkAlerts dispara change-drop quando queda atinge alvo", () => {
    const { result } = renderHook(() => useAlerts());
    act(() => {
      result.current.createAlert({ ticker: "PETR4", type: "change-drop", value: 5 });
    });
    let fired: ReturnType<typeof result.current.checkAlerts> = [];
    act(() => {
      fired = result.current.checkAlerts([stock({ changePercent: -8 })]);
    });
    expect(fired).toHaveLength(1);
  });

  it("checkAlerts dispara graham-margin", () => {
    const { result } = renderHook(() => useAlerts());
    act(() => {
      // graham = sqrt(22.5*2*10) ≈ 21.21; margem = (21.21-10)/21.21 ≈ 52.8% (>= 20)
      result.current.createAlert({ ticker: "PETR4", type: "graham-margin", value: 20 });
    });
    let fired: ReturnType<typeof result.current.checkAlerts> = [];
    act(() => {
      fired = result.current.checkAlerts([stock({ price: 10, lpa: 2, vpa: 10 })]);
    });
    expect(fired).toHaveLength(1);
  });

  it("não dispara se ticker não está na lista", () => {
    const { result } = renderHook(() => useAlerts());
    act(() => {
      result.current.createAlert({ ticker: "VALE3", type: "price-above", value: 1 });
    });
    let fired: ReturnType<typeof result.current.checkAlerts> = [];
    act(() => {
      fired = result.current.checkAlerts([stock({ ticker: "PETR4" })]);
    });
    expect(fired).toEqual([]);
  });

  it("resetAlert limpa triggeredAt", () => {
    const { result } = renderHook(() => useAlerts());
    let id = "";
    act(() => {
      id = result.current.createAlert({ ticker: "PETR4", type: "price-above", value: 1 }).id;
    });
    act(() => {
      result.current.checkAlerts([stock({ price: 10 })]);
    });
    expect(result.current.alerts[0].triggeredAt).toBeTruthy();
    act(() => result.current.resetAlert(id));
    expect(result.current.alerts[0].triggeredAt).toBeUndefined();
  });

  it("requestPermission delega para Notification.requestPermission", async () => {
    const spy = vi
      .spyOn(Notification, "requestPermission")
      .mockResolvedValue("granted" as NotificationPermission);
    const { result } = renderHook(() => useAlerts());
    await act(async () => {
      await result.current.requestPermission();
    });
    expect(spy).toHaveBeenCalled();
  });
});

describe("alertTypeLabel & formatAlertTrigger", () => {
  it("alertTypeLabel cobre todos os tipos", () => {
    expect(alertTypeLabel("price-above")).toMatch(/acima/);
    expect(alertTypeLabel("price-below")).toMatch(/abaixo/);
    expect(alertTypeLabel("graham-margin")).toMatch(/Graham/);
    expect(alertTypeLabel("change-drop")).toMatch(/Queda/);
  });

  it("formatAlertTrigger formata por tipo", () => {
    expect(
      formatAlertTrigger({ id: "", ticker: "", type: "price-above", value: 30, createdAt: "" })
    ).toBe("R$ 30.00");
    expect(
      formatAlertTrigger({ id: "", ticker: "", type: "graham-margin", value: 25, createdAt: "" })
    ).toBe("25%");
  });
});
