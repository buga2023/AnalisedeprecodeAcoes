import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { captureError, captureMessage, initTelemetry } from "./telemetry";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
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
  it("é no-op sem VITE_SENTRY_DSN (não chama console.error/warn e não lança)", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => initTelemetry()).not.toThrow();
    expect(errSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe("telemetry — com VITE_SENTRY_DSN (forward pro Sentry)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("@sentry/react");
    vi.resetModules();
  });

  it("initTelemetry carrega o Sentry e captureError encaminha (sem console.error)", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://abc@o0.ingest.sentry.io/1");
    const init = vi.fn();
    const captureException = vi.fn();
    vi.doMock("@sentry/react", () => ({ init, captureException, captureMessage: vi.fn() }));
    vi.resetModules();
    const tele = await import("./telemetry");

    tele.initTelemetry();
    // Espera o dynamic import de @sentry/react resolver e o init rodar.
    await vi.waitFor(() => expect(init).toHaveBeenCalledTimes(1));

    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    tele.captureError(new Error("boom"), { tag: "x" });
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(errSpy).not.toHaveBeenCalled();
  });
});
