import { describe, it, expect, beforeEach, vi } from "vitest";
import { captureError, captureMessage, initTelemetry } from "./telemetry";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("telemetry — captureError", () => {
  it("loga via console.error com prefixo `[telemetry:<tag>]`", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    captureError(new Error("boom"), { tag: "usePraChat" });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0][0])).toMatch(/\[telemetry:usePraChat\]/);
    expect(String(spy.mock.calls[0][0])).toMatch(/boom/);
  });

  it("trunca mensagem em 200 chars", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const longMsg = "x".repeat(500);
    captureError(new Error(longMsg), { tag: "longTest" });
    const logged = String(spy.mock.calls[0][0]);
    // prefixo + 200 chars de mensagem — total ~225, nunca > 250.
    expect(logged.length).toBeLessThan(250);
  });

  it("aceita erro não-Error (string, número, objeto)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    captureError("falha simples", { tag: "t1" });
    captureError(42, { tag: "t2" });
    captureError({ code: "EAGAIN" }, { tag: "t3" });
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("passa `extra` como segundo argumento do console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    captureError(new Error("x"), { tag: "ctx", extra: { ticker: "PETR4" } });
    expect(spy.mock.calls[0][1]).toEqual({ ticker: "PETR4" });
  });
});

describe("telemetry — captureMessage", () => {
  it("loga via console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    captureMessage("estado degradado", { tag: "fetchStockQuote" });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0][0])).toMatch(/\[telemetry:fetchStockQuote\]/);
    expect(String(spy.mock.calls[0][0])).toMatch(/estado degradado/);
  });
});

describe("telemetry — initTelemetry", () => {
  it("é no-op (não chama console.error/warn e não lança)", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => initTelemetry()).not.toThrow();
    expect(errSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
