/**
 * Teste de integração — fluxo de IA conversacional.
 *
 * Cobre: client-side `lib/aiNews.resumirNoticiasComIA` ↔ `/api/ai` handler real
 * (rate-limit + cache em memória + provider switch).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resumirNoticiasComIA, clearAllNewsSummaryCache } from "@/lib/aiNews";
import type { WorldNewsTopicBundle } from "@/lib/context";
import { makeReq, makeRes } from "../../api/test-helpers";

const bundle: WorldNewsTopicBundle = {
  topic: "geopolitica-integ",
  description: "Conflitos",
  arbitrageAngle: "Conflito sobe petróleo",
  items: [
    { titulo: "Tensão sobe", link: "https://x.com/a", fonte: "BBC", publicado: "", origem: "bbc" },
  ],
};

beforeEach(() => {
  localStorage.clear();
  clearAllNewsSummaryCache();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function bridgeToLocalAi() {
  const { default: aiHandler } = await import("../../api/ai");
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url === "/api/ai") {
      const body = init?.body ? JSON.parse(init.body as string) : {};
      const req = makeReq({
        method: "POST",
        body,
        // IP único por chamada pra escapar do rate-limit do handler.
        headers: { "x-forwarded-for": `10.20.30.${Math.floor(Math.random() * 200)}` },
      });
      const res = makeRes();
      await aiHandler(req, res);
      return new Response(JSON.stringify(res.mock.body), {
        status: res.mock.statusCode,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("api.groq.com")) {
      const aiBody = {
        resumo: "Resumo IA [1]",
        impactoArbitragem: "petróleo sobe",
        alvos: [{ alvo: "PETR4", direcao: "ganha", motivo: "tese de conflito" }],
        fontes: ["https://x.com/a"],
      };
      return new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(aiBody) } }] }),
        { status: 200 }
      );
    }
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
}

describe("[integração] IA conversacional: aiNews ↔ api/ai handler", () => {
  it("resumirNoticiasComIA passa pelo handler e cacheia em localStorage", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "k");
    await bridgeToLocalAi();

    const out = await resumirNoticiasComIA(bundle);
    expect(out.resumo).toContain("Resumo IA");
    expect(out.alvos[0]?.alvo).toBe("PETR4");
    // Cache em localStorage pelo client
    expect(localStorage.getItem(`praxia-news-summary:${bundle.topic}`)).toBeTruthy();
  });

  it("503 quando IA não configurada no servidor", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "");
    await bridgeToLocalAi();

    await expect(resumirNoticiasComIA(bundle)).rejects.toThrow();
  });
});
