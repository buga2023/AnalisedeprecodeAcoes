import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getCachedResumoNoticias,
  resumirNoticiasComIA,
  clearAllNewsSummaryCache,
} from "./aiNews";
import type { WorldNewsTopicBundle } from "./context";

const bundle: WorldNewsTopicBundle = {
  topic: "geopolitica",
  description: "x",
  arbitrageAngle: "Conflito sobe petróleo",
  items: [
    { titulo: "Tensão sobe", link: "https://x.com/a", fonte: "BBC", publicado: "", origem: "bbc" },
    { titulo: "Sanção volta", link: "https://x.com/b", fonte: "Reuters", publicado: "", origem: "gdelt" },
  ],
};

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("getCachedResumoNoticias", () => {
  it("retorna null quando vazio", () => {
    expect(getCachedResumoNoticias(bundle)).toBeNull();
  });
});

describe("resumirNoticiasComIA", () => {
  it("retorna fallback quando bundle vazio", async () => {
    const empty = { ...bundle, items: [] };
    const out = await resumirNoticiasComIA(empty);
    expect(out.resumo).toMatch(/Sem manchetes/);
    expect(out.alvos).toEqual([]);
  });

  it("chama IA e cacheia em sucesso", async () => {
    const payload = {
      resumo: "Resumo [1]",
      impactoArbitragem: "x",
      alvos: [{ alvo: "PETR4", direcao: "ganha", motivo: "y" }],
      fontes: ["https://x.com/a"],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: JSON.stringify(payload) }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await resumirNoticiasComIA(bundle);
    expect(out.resumo).toBe("Resumo [1]");
    expect(out.alvos).toHaveLength(1);

    // 2ª chamada usa cache
    const out2 = await resumirNoticiasComIA(bundle);
    expect(out2.resumo).toBe("Resumo [1]");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // cache acessível via getCached
    expect(getCachedResumoNoticias(bundle)).not.toBeNull();
  });

  it("lança quando backend falha", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: "boom" }) })
    );
    await expect(resumirNoticiasComIA(bundle)).rejects.toThrow();
  });

  it("normaliza arrays ausentes", async () => {
    const payload = { resumo: "x", impactoArbitragem: "y" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ content: JSON.stringify(payload) }) })
    );
    const out = await resumirNoticiasComIA(bundle);
    expect(out.alvos).toEqual([]);
    expect(out.fontes).toEqual([]);
  });
});

describe("clearAllNewsSummaryCache", () => {
  it("remove apenas chaves do prefixo", () => {
    localStorage.setItem("praxia-news-summary:geopolitica", "x");
    localStorage.setItem("outra-coisa", "y");
    clearAllNewsSummaryCache();
    expect(localStorage.getItem("praxia-news-summary:geopolitica")).toBeNull();
    expect(localStorage.getItem("outra-coisa")).toBe("y");
  });
});
