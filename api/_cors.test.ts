import { describe, it, expect, beforeEach, vi } from "vitest";
import { applyCors } from "./_cors";
import { makeReq, makeRes } from "./test-helpers";

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("applyCors", () => {
  it("responde 204 em OPTIONS e retorna true", () => {
    const req = makeReq({ method: "OPTIONS" });
    const res = makeRes();
    const handled = applyCors(req, res);
    expect(handled).toBe(true);
    expect(res.mock.statusCode).toBe(204);
  });

  it("não termina em métodos não-OPTIONS e retorna false", () => {
    const req = makeReq({ method: "GET" });
    const res = makeRes();
    const handled = applyCors(req, res);
    expect(handled).toBe(false);
    expect(res.mock.ended).toBe(false);
  });

  it("ecoa origem quando ela está nos defaults de dev", () => {
    const req = makeReq({ method: "GET", headers: { origin: "http://localhost:5173" } });
    const res = makeRes();
    applyCors(req, res);
    expect(res.mock.headers["Access-Control-Allow-Origin"]).toBe("http://localhost:5173");
    expect(res.mock.headers["Vary"]).toBe("Origin");
  });

  it("respeita PRAXIA_ALLOWED_ORIGINS", () => {
    vi.stubEnv("PRAXIA_ALLOWED_ORIGINS", "https://praxia.app, https://app.praxia.app");
    const req = makeReq({ method: "GET", headers: { origin: "https://praxia.app" } });
    const res = makeRes();
    applyCors(req, res);
    expect(res.mock.headers["Access-Control-Allow-Origin"]).toBe("https://praxia.app");
  });

  it("não ecoa origin fora da allowlist", () => {
    const req = makeReq({ method: "GET", headers: { origin: "https://evil.example.com" } });
    const res = makeRes();
    applyCors(req, res);
    expect(res.mock.headers["Access-Control-Allow-Origin"]).toBeUndefined();
    // Headers padrão continuam setados
    expect(res.mock.headers["Content-Type"]).toBe("application/json");
  });

  it("permite customizar methods", () => {
    const req = makeReq();
    const res = makeRes();
    applyCors(req, res, "POST, OPTIONS");
    expect(res.mock.headers["Access-Control-Allow-Methods"]).toBe("POST, OPTIONS");
  });
});
