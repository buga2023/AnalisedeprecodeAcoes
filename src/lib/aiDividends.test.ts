import { describe, it, expect, beforeEach, vi } from "vitest";
import { otimizarDividendos, type DividendStockInput } from "./aiDividends";
import type { MonthBucket } from "./dividends";
import type { InvestorProfile } from "@/types/stock";

const STOCK_FIXTURE: DividendStockInput[] = [
  {
    ticker: "PETR4",
    quantity: 100,
    price: 36.5,
    dividendYield: 12.4,
    score: 78,
    sector: "Petróleo",
  },
  {
    ticker: "ITUB4",
    quantity: 50,
    price: 28.1,
    dividendYield: 5.2,
    score: 70,
  },
];

const BUCKETS_FIXTURE: MonthBucket[] = Array.from({ length: 12 }, (_, i) => ({
  month: `2025-${String(i + 1).padStart(2, "0")}`,
  amount: 150,
}));

const PROFILE_FIXTURE: InvestorProfile = {
  risk: "mid",
  horizon: "long",
  interests: ["div"],
  completedAt: "2026-01-01T00:00:00Z",
};

function mockAIResponse(payload: unknown) {
  const content = typeof payload === "string" ? payload : JSON.stringify(payload);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ content }), { status: 200 }))
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("otimizarDividendos", () => {
  it("rejeita quando nao ha acoes com posicao na carteira", async () => {
    await expect(otimizarDividendos([], BUCKETS_FIXTURE, PROFILE_FIXTURE)).rejects.toThrow(
      /posi[cç][aã]o/i
    );
    const semQuantidade: DividendStockInput[] = STOCK_FIXTURE.map((s) => ({ ...s, quantity: 0 }));
    await expect(
      otimizarDividendos(semQuantidade, BUCKETS_FIXTURE, PROFILE_FIXTURE)
    ).rejects.toThrow(/posi[cç][aã]o/i);
  });

  it("retorna estrutura normalizada quando IA responde JSON valido", async () => {
    mockAIResponse({
      resumo: "Pelo seu perfil moderado, manter PETR4 e adicionar ITSA4.",
      fontes: ["BrAPI", "perfil do usuario"],
      sugestoes: [
        {
          ticker: "petr4",
          acao: "manter",
          tese: "DY 12,4% acima da media; manter exposicao [1].",
          impactoEstimado: "+R$ 380/ano",
          fontes: ["BrAPI"],
        },
        {
          ticker: "ITSA4",
          acao: "adicionar",
          tese: "Setor financeiro com cadencia trimestral previsivel [2].",
          impactoEstimado: "+R$ 220/ano",
          fontes: ["calculo do app", "perfil do usuario"],
        },
      ],
    });

    const result = await otimizarDividendos(STOCK_FIXTURE, BUCKETS_FIXTURE, PROFILE_FIXTURE);

    expect(result.resumo).toMatch(/^Pelo seu perfil/);
    expect(result.fontes).toContain("BrAPI");
    expect(result.sugestoes).toHaveLength(2);
    // ticker normalizado pra uppercase
    expect(result.sugestoes[0].ticker).toBe("PETR4");
    expect(result.sugestoes[0].acao).toBe("manter");
    expect(result.sugestoes[1].acao).toBe("adicionar");
  });

  it("tolera resposta envolvida em ```json fences", async () => {
    mockAIResponse(
      "```json\n" +
        JSON.stringify({
          resumo: "Pelo seu perfil arrojado, considere TAEE11.",
          fontes: ["BrAPI"],
          sugestoes: [
            {
              ticker: "TAEE11",
              acao: "adicionar",
              tese: "Dividend yield consistente [1].",
              impactoEstimado: "+R$ 90/mes",
              fontes: ["Yahoo Finance"],
            },
          ],
        }) +
        "\n```"
    );

    const result = await otimizarDividendos(STOCK_FIXTURE, BUCKETS_FIXTURE, PROFILE_FIXTURE);
    expect(result.sugestoes[0].ticker).toBe("TAEE11");
  });

  it("defaulta acao invalida pra 'manter' e filtra sugestao sem ticker ou tese", async () => {
    mockAIResponse({
      resumo: "Pelo seu perfil conservador...",
      fontes: [],
      sugestoes: [
        { ticker: "PETR4", acao: "vender_tudo", tese: "Tese ok", impactoEstimado: "x", fontes: [] },
        { ticker: "", acao: "manter", tese: "Sem ticker", impactoEstimado: "y", fontes: [] },
        { ticker: "ITUB4", acao: "manter", tese: "", impactoEstimado: "z", fontes: [] },
      ],
    });

    const result = await otimizarDividendos(STOCK_FIXTURE, BUCKETS_FIXTURE, PROFILE_FIXTURE);
    expect(result.sugestoes).toHaveLength(1);
    expect(result.sugestoes[0].ticker).toBe("PETR4");
    // 'vender_tudo' nao esta no enum → vira 'manter'
    expect(result.sugestoes[0].acao).toBe("manter");
  });

  it("lança erro quando API responde nao-ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "Sem chave" }), { status: 503 })
      )
    );
    await expect(
      otimizarDividendos(STOCK_FIXTURE, BUCKETS_FIXTURE, PROFILE_FIXTURE)
    ).rejects.toThrow(/Sem chave/);
  });

  it("lança erro quando o conteudo da resposta esta vazio", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ content: "" }), { status: 200 }))
    );
    await expect(
      otimizarDividendos(STOCK_FIXTURE, BUCKETS_FIXTURE, PROFILE_FIXTURE)
    ).rejects.toThrow(/vazia/i);
  });

  it("lança erro quando JSON da IA esta malformado", async () => {
    mockAIResponse("isto nao é JSON {");
    await expect(
      otimizarDividendos(STOCK_FIXTURE, BUCKETS_FIXTURE, PROFILE_FIXTURE)
    ).rejects.toThrow(/interpretar/i);
  });

  it("passa describeProfile=ainda nao definido quando profile=null", async () => {
    const seenBodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        seenBodies.push(String(init?.body ?? ""));
        return new Response(
          JSON.stringify({
            content: JSON.stringify({
              resumo: "Pelo seu perfil ...",
              fontes: [],
              sugestoes: [],
            }),
          }),
          { status: 200 }
        );
      })
    );

    await otimizarDividendos(STOCK_FIXTURE, BUCKETS_FIXTURE, null);
    expect(seenBodies[0]).toMatch(/PERFIL: ainda nao definido/);
  });
});
