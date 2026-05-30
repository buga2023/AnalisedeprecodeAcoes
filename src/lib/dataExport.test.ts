import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildExportPayload, collectLocalData, collectServerData } from "./dataExport";

// Mocka os fetchers do servidor — collectServerData só os agrega.
vi.mock("./supabaseSync", () => ({
  fetchProfileFromServer: vi.fn(async () => ({ risk: "moderado" })),
  fetchPortfolioFromServer: vi.fn(async () => [{ ticker: "PETR4" }]),
  fetchTransactionsFromServer: vi.fn(async () => []),
  fetchPreferencesFromServer: vi.fn(async () => ({ accent: "#fff" })),
}));

beforeEach(() => {
  localStorage.clear();
});

describe("dataExport — collectLocalData", () => {
  it("coleta chaves do Praxia e parseia JSON; ignora chaves de terceiros", () => {
    localStorage.setItem("praxia-ui-prefs", JSON.stringify({ accent: "#c8a25c" }));
    localStorage.setItem("stocks-ai-analysis:PETR4", JSON.stringify({ veredito: "COMPRAR" }));
    localStorage.setItem("outra-app", "nao-incluir");

    const data = collectLocalData();
    expect(data["praxia-ui-prefs"]).toEqual({ accent: "#c8a25c" });
    expect(data["stocks-ai-analysis:PETR4"]).toEqual({ veredito: "COMPRAR" });
    expect(data["outra-app"]).toBeUndefined();
  });

  it("cai pra string crua quando o valor não é JSON", () => {
    localStorage.setItem("praxia-pra-chat", "texto-solto");
    expect(collectLocalData()["praxia-pra-chat"]).toBe("texto-solto");
  });
});

describe("dataExport — buildExportPayload", () => {
  it("monta payload versionado; authenticated=false sem server", () => {
    const p = buildExportPayload({ exportedAt: "2026-05-30T00:00:00Z", server: null, device: {} });
    expect(p.schema).toBe(1);
    expect(p.app).toBe("Praxia");
    expect(p.authenticated).toBe(false);
    expect(p.server).toBeNull();
    expect(p.exportedAt).toBe("2026-05-30T00:00:00Z");
  });

  it("authenticated=true quando há server; preserva device", () => {
    const server = { profile: null, portfolio: null, transactions: null, preferences: null };
    const p = buildExportPayload({ exportedAt: "x", server, device: { a: 1 } });
    expect(p.authenticated).toBe(true);
    expect(p.device).toEqual({ a: 1 });
  });
});

describe("dataExport — collectServerData", () => {
  it("retorna null sem userId (não toca o servidor)", async () => {
    expect(await collectServerData(null)).toBeNull();
  });

  it("agrega os 4 fetchers quando há userId", async () => {
    const result = await collectServerData("user-123");
    expect(result).not.toBeNull();
    expect(result?.profile).toEqual({ risk: "moderado" });
    expect(result?.portfolio).toEqual([{ ticker: "PETR4" }]);
    expect(result?.transactions).toEqual([]);
    expect(result?.preferences).toEqual({ accent: "#fff" });
  });
});
