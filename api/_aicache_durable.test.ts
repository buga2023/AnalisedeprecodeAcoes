import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Unit — L2 durável do cache de IA (Supabase). Envs lidas no load do módulo →
 * resetModules + import dinâmico. Supabase mockado.
 */

const h = vi.hoisted(() => ({
  state: {
    row: null as { body: unknown; expires_at: string } | null,
    selectError: null as { message: string } | null,
    upserts: [] as Array<Record<string, unknown>>,
    deletes: [] as string[],
  },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: h.state.row, error: h.state.selectError }),
        }),
      }),
      upsert: async (row: Record<string, unknown>) => {
        h.state.upserts.push(row);
        return { error: null };
      },
      delete: () => ({
        eq: async (_col: string, key: string) => {
          h.state.deletes.push(key);
          return { error: null };
        },
      }),
    }),
  }),
}));

async function load(configured = true) {
  vi.resetModules();
  vi.stubEnv("SUPABASE_URL", configured ? "https://proj.supabase.co" : "");
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", configured ? "service-role" : "");
  return import("./_aicache");
}

beforeEach(() => {
  h.state.row = null;
  h.state.selectError = null;
  h.state.upserts = [];
  h.state.deletes = [];
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => vi.unstubAllEnvs());

describe("L2 durável — getCachedDurable", () => {
  it("sem envs Supabase → null (no-op)", async () => {
    const { getCachedDurable } = await load(false);
    expect(await getCachedDurable("k")).toBeNull();
  });

  it("hit fresco → devolve body", async () => {
    h.state.row = { body: { content: "ok", provider: "openrouter" }, expires_at: new Date(Date.now() + 60_000).toISOString() };
    const { getCachedDurable } = await load();
    expect(await getCachedDurable("k")).toEqual({ content: "ok", provider: "openrouter" });
  });

  it("expirado → null e limpa a linha", async () => {
    h.state.row = { body: { content: "velho" }, expires_at: new Date(Date.now() - 1_000).toISOString() };
    const { getCachedDurable } = await load();
    expect(await getCachedDurable("k-exp")).toBeNull();
    expect(h.state.deletes).toContain("k-exp");
  });

  it("erro do select → null (degrada)", async () => {
    h.state.selectError = { message: "relation does not exist" };
    const { getCachedDurable } = await load();
    expect(await getCachedDurable("k")).toBeNull();
  });
});

describe("L2 durável — setCachedDurable", () => {
  it("sem envs → não faz upsert", async () => {
    const { setCachedDurable } = await load(false);
    await setCachedDurable("k", { content: "x" });
    expect(h.state.upserts).toHaveLength(0);
  });

  it("com envs → upsert com key/body/expires_at", async () => {
    const { setCachedDurable } = await load();
    await setCachedDurable("k1", { content: "y" });
    expect(h.state.upserts).toHaveLength(1);
    expect(h.state.upserts[0]).toMatchObject({ key: "k1", body: { content: "y" } });
    expect(typeof h.state.upserts[0].expires_at).toBe("string");
  });
});
