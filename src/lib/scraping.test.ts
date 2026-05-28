import { describe, it, expect, vi, beforeEach } from "vitest";
import { coletarDadosRI } from "./scraping";

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("coletarDadosRI", () => {
  it("retorna payload quando ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ticker: "PETR4", conteudo: "hello", fonte: "Investidor10" }),
      })
    );
    const out = await coletarDadosRI("PETR4");
    expect(out.conteudo).toBe("hello");
    expect(out.fonte).toBe("Investidor10");
  });

  it("retorna aviso em status não-ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const out = await coletarDadosRI("PETR4");
    expect(out.conteudo).toBe("");
    expect(out.aviso).toContain("Erro no proxy");
  });

  it("retorna aviso quando fetch lança", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("rede")));
    const out = await coletarDadosRI("PETR4");
    expect(out.aviso).toContain("indisponivel");
  });
});
