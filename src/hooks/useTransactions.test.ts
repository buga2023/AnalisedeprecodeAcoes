import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useTransactions } from "./useTransactions";

beforeEach(() => {
  localStorage.clear();
});

describe("useTransactions", () => {
  it("começa com lista vazia", () => {
    const { result } = renderHook(() => useTransactions());
    expect(result.current.transactions).toEqual([]);
  });

  it("record adiciona com id + timestamp e persiste", () => {
    const { result } = renderHook(() => useTransactions());
    let recorded;
    act(() => {
      recorded = result.current.record({
        ticker: "PETR4",
        type: "buy",
        orderType: "Mercado",
        shares: 10,
        price: 30,
        total: 300,
        fee: 1,
      });
    });
    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0].id).toBeTruthy();
    expect(result.current.transactions[0].timestamp).toBeTruthy();
    expect(recorded).toBeDefined();
    expect(localStorage.getItem("praxia-transactions")).toContain("PETR4");
  });

  it("clear esvazia a lista", () => {
    const { result } = renderHook(() => useTransactions());
    act(() => {
      result.current.record({ ticker: "X", type: "buy", orderType: "Mercado", shares: 1, price: 1, total: 1, fee: 0 });
    });
    act(() => result.current.clear());
    expect(result.current.transactions).toEqual([]);
  });

  it("carrega lista pré-existente do localStorage", () => {
    localStorage.setItem(
      "praxia-transactions",
      JSON.stringify([{ id: "a", ticker: "VALE3", type: "buy", orderType: "Mercado", shares: 1, price: 50, total: 50, fee: 0, timestamp: "x" }])
    );
    const { result } = renderHook(() => useTransactions());
    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0].ticker).toBe("VALE3");
  });
});
