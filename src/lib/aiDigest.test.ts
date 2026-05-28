import { describe, it, expect, beforeEach, vi } from "vitest";
import { gerarDigestSemanal } from "./aiDigest";
import type { DigestContext, InvestorProfile } from "@/types/stock";

const PROFILE: InvestorProfile = {
  risk: "mid",
  horizon: "long",
  interests: ["div"],
  completedAt: "2026-01-01T00:00:00Z",
};

function emptyCtx(overrides: Partial<DigestContext> = {}): DigestContext {
  return {
    isoWeek: "2026-W21",
    weekStart: "2026-05-18T00:00:00Z",
    weekEnd: "2026-05-24T23:59:59Z",
    variacaoSemanaPct: null,
    patrimonioFim: 0,
    topMover: null,
    dividendosRecebidos: [],
    totalDividendosSemana: 0,
    transacoesDaSemana: [],
    alertasDisparados: [],
    noticiasMateriais: [],
    portfolioSnapshot: [],
    ...overrides,
  };
}

function mockAI(payload: unknown) {
  const content = typeof payload === "string" ? payload : JSON.stringify(payload);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ content }), { status: 200 }))
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("gerarDigestSemanal", () => {
  it("retorna estrutura normalizada com resumo + destaque", async () => {
    mockAI({
      resumo: "Pelo seu perfil moderado, semana tranquila sem dividendos.",
      destaque: "Nenhum evento material.",
      eventosNotaveis: [{ titulo: "Tendência", detalhe: "Carteira estável." }],
      proximasAcoes: [
        { acao: "Acompanhar", motivo: "Manter posições", screenAlvo: "analysis" },
      ],
      fontes: ["Yahoo Finance", "calculo do app"],
    });

    const result = await gerarDigestSemanal(emptyCtx(), PROFILE);
    expect(result.resumo).toMatch(/^Pelo seu perfil/);
    expect(result.destaque).toBe("Nenhum evento material.");
    expect(result.eventosNotaveis).toHaveLength(1);
    expect(result.proximasAcoes).toHaveLength(1);
    expect(result.proximasAcoes[0].screenAlvo).toBe("analysis");
    expect(result.fontes).toContain("Yahoo Finance");
    expect(result.isoWeek).toBe("2026-W21");
  });

  it("descarta screenAlvo inválido (não está no enum)", async () => {
    mockAI({
      resumo: "ok",
      destaque: "ok",
      eventosNotaveis: [{ titulo: "t", detalhe: "d" }],
      proximasAcoes: [
        { acao: "Ir para tela X", motivo: "razão", screenAlvo: "tela_inventada" },
      ],
      fontes: [],
    });
    const result = await gerarDigestSemanal(emptyCtx(), PROFILE);
    expect(result.proximasAcoes[0].screenAlvo).toBeUndefined();
  });

  it("aceita screenAlvo válido do enum", async () => {
    const targets = ["dividends", "analysis", "market", "alerts", "news", "home"];
    for (const t of targets) {
      mockAI({
        resumo: "ok",
        destaque: "ok",
        eventosNotaveis: [{ titulo: "t", detalhe: "d" }],
        proximasAcoes: [{ acao: "x", motivo: "y", screenAlvo: t }],
        fontes: [],
      });
      const r = await gerarDigestSemanal(emptyCtx(), PROFILE);
      expect(r.proximasAcoes[0].screenAlvo).toBe(t);
    }
  });

  it("filtra eventosNotaveis sem titulo ou detalhe", async () => {
    mockAI({
      resumo: "ok",
      destaque: "ok",
      eventosNotaveis: [
        { titulo: "ok", detalhe: "ok" },
        { titulo: "", detalhe: "sem título" },
        { titulo: "sem detalhe", detalhe: "" },
      ],
      proximasAcoes: [],
      fontes: [],
    });
    const result = await gerarDigestSemanal(emptyCtx(), PROFILE);
    expect(result.eventosNotaveis).toHaveLength(1);
  });

  it("injeta fontes defensivas quando IA não retorna nenhuma E há dados", async () => {
    mockAI({
      resumo: "ok",
      destaque: "ok",
      eventosNotaveis: [],
      proximasAcoes: [],
      // sem "fontes"
    });
    const ctx = emptyCtx({
      alertasDisparados: [
        { ticker: "PETR4", type: "price-above", value: 35, triggerPrice: 36, triggeredAt: "2026-05-22T00:00:00Z" },
      ],
      transacoesDaSemana: [
        { ticker: "X", type: "buy", shares: 10, total: 100, timestamp: "2026-05-20T00:00:00Z" },
      ],
    });
    const result = await gerarDigestSemanal(ctx, PROFILE);
    expect(result.fontes).toContain("Yahoo Finance");
    expect(result.fontes).toContain("calculo do app");
    expect(result.fontes).toContain("useAlerts");
    expect(result.fontes).toContain("useTransactions");
  });

  it("aceita JSON envolto em ```json fences", async () => {
    mockAI(
      "```json\n" +
        JSON.stringify({
          resumo: "Pelo seu perfil",
          destaque: "x",
          eventosNotaveis: [{ titulo: "t", detalhe: "d" }],
          proximasAcoes: [],
          fontes: [],
        }) +
        "\n```"
    );
    const result = await gerarDigestSemanal(emptyCtx(), PROFILE);
    expect(result.resumo).toBe("Pelo seu perfil");
  });

  it("lança erro quando API responde não-ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "rate" }), { status: 429 }))
    );
    await expect(gerarDigestSemanal(emptyCtx(), PROFILE)).rejects.toThrow(/rate/);
  });

  it("lança erro quando o content da resposta é vazio", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ content: "" }), { status: 200 }))
    );
    await expect(gerarDigestSemanal(emptyCtx(), PROFILE)).rejects.toThrow(/vazia/i);
  });

  it("lança erro quando JSON da IA é malformado", async () => {
    mockAI("isto não é JSON {");
    await expect(gerarDigestSemanal(emptyCtx(), PROFILE)).rejects.toThrow(/interpretar/i);
  });

  it("passa describeProfile=PERFIL nao definido quando profile=null", async () => {
    const bodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        bodies.push(String(init?.body ?? ""));
        return new Response(
          JSON.stringify({
            content: JSON.stringify({
              resumo: "ok",
              destaque: "ok",
              eventosNotaveis: [],
              proximasAcoes: [],
              fontes: [],
            }),
          }),
          { status: 200 }
        );
      })
    );
    await gerarDigestSemanal(emptyCtx(), null);
    expect(bodies[0]).toMatch(/PERFIL: nao definido/);
  });
});
