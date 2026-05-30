import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Unit — cache semântico (L3). Envs no load → resetModules + import dinâmico.
 * Supabase (rpc/insert) e a Edge Function `embed` (fetch) mockados.
 */

const h = vi.hoisted(() => ({
  state: {
    matchRows: [] as Array<{ body: unknown; similarity: number }>,
    rpcError: null as { message: string } | null,
    inserts: [] as Array<Record<string, unknown>>,
    embedStatus: 200,
    embedBody: { embedding: Array.from({ length: 384 }, () => 0.1) } as unknown,
  },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    rpc: async () => ({ data: h.state.matchRows, error: h.state.rpcError }),
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        h.state.inserts.push(row);
        return { error: null };
      },
    }),
  }),
}));

async function load(opts: { enabled: boolean; envs?: boolean }) {
  vi.resetModules();
  vi.stubEnv("SEMANTIC_CACHE_ENABLED", opts.enabled ? "true" : "");
  const configured = opts.envs ?? true;
  vi.stubEnv("SUPABASE_URL", configured ? "https://proj.supabase.co" : "");
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", configured ? "service-role" : "");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(h.state.embedBody), { status: h.state.embedStatus }))
  );
  return import("./_semanticCache");
}

beforeEach(() => {
  h.state.matchRows = [];
  h.state.rpcError = null;
  h.state.inserts = [];
  h.state.embedStatus = 200;
  h.state.embedBody = { embedding: Array.from({ length: 384 }, () => 0.1) };
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("getSemanticCached", () => {
  it("flag off → null sem embeddar", async () => {
    const { getSemanticCached } = await load({ enabled: false });
    const fetchSpy = globalThis.fetch as ReturnType<typeof vi.fn>;
    expect(await getSemanticCached("oi")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("flag on + match acima do limiar → devolve body", async () => {
    h.state.matchRows = [{ body: { content: "cacheada", provider: "openrouter" }, similarity: 0.95 }];
    const { getSemanticCached } = await load({ enabled: true });
    expect(await getSemanticCached("qual a selic?")).toEqual({ content: "cacheada", provider: "openrouter" });
  });

  it("flag on + sem match → null", async () => {
    h.state.matchRows = [];
    const { getSemanticCached } = await load({ enabled: true });
    expect(await getSemanticCached("pergunta nova")).toBeNull();
  });

  it("embed falha (404 = edge não implantada) → null", async () => {
    h.state.embedStatus = 404;
    const { getSemanticCached } = await load({ enabled: true });
    expect(await getSemanticCached("x")).toBeNull();
  });
});

describe("setSemanticCached", () => {
  it("flag off → não insere", async () => {
    const { setSemanticCached } = await load({ enabled: false });
    await setSemanticCached("p", { content: "r" });
    expect(h.state.inserts).toHaveLength(0);
  });

  it("flag on → insere question + embedding + body + expires_at", async () => {
    const { setSemanticCached } = await load({ enabled: true });
    await setSemanticCached("pergunta", { content: "resposta" });
    expect(h.state.inserts).toHaveLength(1);
    expect(h.state.inserts[0]).toMatchObject({ question: "pergunta", body: { content: "resposta" } });
    expect(Array.isArray(h.state.inserts[0].embedding)).toBe(true);
    expect(typeof h.state.inserts[0].expires_at).toBe("string");
  });
});
