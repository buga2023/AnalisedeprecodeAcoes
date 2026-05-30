import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./supabaseSync", () => ({
  fetchPortfolioFromServer: vi.fn(),
  fetchProfileFromServer: vi.fn(),
  fetchTransactionsFromServer: vi.fn(),
  fetchPreferencesFromServer: vi.fn(),
}));

import {
  fetchPortfolioFromServer,
  fetchProfileFromServer,
  fetchTransactionsFromServer,
  fetchPreferencesFromServer,
} from "./supabaseSync";
import {
  buildExportPayload,
  exportUserDataAsJSON,
  snapshotLocalStorage,
} from "./exportUserData";

describe("buildExportPayload", () => {
  it("monta o shape com conta, servidor e dispositivo", () => {
    const p = buildExportPayload(
      { userId: "u1", email: "a@b.com" },
      { portfolio: [], perfil: null, transacoes: null, preferencias: null },
      { "praxia-x": 1 },
      "2026-05-30T00:00:00.000Z"
    );
    expect(p.app).toBe("Praxia");
    expect(p.exported_at).toBe("2026-05-30T00:00:00.000Z");
    expect(p.conta).toEqual({ userId: "u1", email: "a@b.com" });
    expect(p.servidor.portfolio).toEqual([]);
    expect(p.dispositivo).toEqual({ "praxia-x": 1 });
    expect(p.base).toMatch(/Art\. 18/);
  });
});

describe("snapshotLocalStorage", () => {
  beforeEach(() => localStorage.clear());

  it("coleta só praxia-/stocks-ai e parseia JSON", () => {
    localStorage.setItem("praxia-ui-prefs", JSON.stringify({ accent: "#fff" }));
    localStorage.setItem("stocks-ai-portfolio", JSON.stringify([{ ticker: "PETR4" }]));
    localStorage.setItem("outra-coisa", "ignora");
    const snap = snapshotLocalStorage();
    expect(snap["praxia-ui-prefs"]).toEqual({ accent: "#fff" });
    expect(snap["stocks-ai-portfolio"]).toEqual([{ ticker: "PETR4" }]);
    expect(snap["outra-coisa"]).toBeUndefined();
  });

  it("guarda valor cru quando não é JSON", () => {
    localStorage.setItem("praxia-token", "abc123");
    expect(snapshotLocalStorage()["praxia-token"]).toBe("abc123");
  });
});

describe("exportUserDataAsJSON", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(fetchPortfolioFromServer).mockResolvedValue([
      { ticker: "VALE3", name: "Vale", sector: "Mineração", quantity: 10, cost: 60 },
    ]);
    vi.mocked(fetchProfileFromServer).mockResolvedValue({
      risk: "moderado",
    } as unknown as Awaited<ReturnType<typeof fetchProfileFromServer>>);
    vi.mocked(fetchTransactionsFromServer).mockResolvedValue([]);
    vi.mocked(fetchPreferencesFromServer).mockResolvedValue({
      accent: "#c8a25c",
      tone: "casual",
      aiVerbosity: "normal",
    });
  });

  it("busca os 4 fetchers em paralelo e dispara o download", async () => {
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const click = vi.fn();
    const origCreate = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = origCreate(tag) as HTMLElement;
      if (tag === "a") el.click = click;
      return el;
    });

    await exportUserDataAsJSON("u1", "a@b.com");

    expect(fetchPortfolioFromServer).toHaveBeenCalledWith("u1");
    expect(fetchProfileFromServer).toHaveBeenCalledWith("u1");
    expect(fetchTransactionsFromServer).toHaveBeenCalledWith("u1");
    expect(fetchPreferencesFromServer).toHaveBeenCalledWith("u1");
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");

    createSpy.mockRestore();
  });
});
