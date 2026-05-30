import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { makeReq } from "./test-helpers";

/**
 * Unit — gate de uso de IA (paywall). Envs lidas no load do módulo → cada teste
 * faz resetModules + import dinâmico. Supabase totalmente mockado.
 */

const h = vi.hoisted(() => ({
  state: {
    getUser: { data: { user: { id: "user-1" } }, error: null } as {
      data: { user: { id: string } | null } | null;
      error: { message: string } | null;
    },
    subRow: null as { status: string } | null,
    usageRow: null as { total_this_month: number } | null,
    rpcCalls: [] as Array<{ name: string; args: unknown }>,
    rpcError: null as { message: string } | null,
  },
}));

function makeChain(result: unknown) {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: async () => ({ data: result }),
  };
  return chain;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: async () => h.state.getUser },
    from: (table: string) =>
      makeChain(table === "subscriptions" ? h.state.subRow : h.state.usageRow),
    rpc: async (name: string, args: unknown) => {
      h.state.rpcCalls.push({ name, args });
      return { error: h.state.rpcError };
    },
  }),
}));

async function loadGuard(opts: { billing: boolean; envs?: boolean }) {
  vi.resetModules();
  vi.stubEnv("BILLING_ENABLED", opts.billing ? "true" : "");
  const configured = opts.envs ?? true;
  vi.stubEnv("SUPABASE_URL", configured ? "https://proj.supabase.co" : "");
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", configured ? "service-role" : "");
  return import("./_usageGuard");
}

const VALID_TOKEN = "x".repeat(60);

beforeEach(() => {
  h.state.getUser = { data: { user: { id: "user-1" } }, error: null };
  h.state.subRow = null;
  h.state.usageRow = null;
  h.state.rpcCalls = [];
  h.state.rpcError = null;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => vi.unstubAllEnvs());

describe("assertCanUseAI", () => {
  it("flag off → libera sem tocar o banco", async () => {
    const { assertCanUseAI } = await loadGuard({ billing: false });
    const req = makeReq({ method: "POST" }); // sem token
    const r = await assertCanUseAI(req, "ai-analysis");
    expect(r).toEqual({ userId: null, isPro: true });
  });

  it("flag on mas sem service role → libera (fail-open) e avisa", async () => {
    const { assertCanUseAI } = await loadGuard({ billing: true, envs: false });
    const req = makeReq({ method: "POST" });
    const r = await assertCanUseAI(req, "ai-analysis");
    expect(r.isPro).toBe(true);
  });

  it("flag on + sem token → 401", async () => {
    const { assertCanUseAI, GuardError } = await loadGuard({ billing: true });
    const req = makeReq({ method: "POST" });
    await expect(assertCanUseAI(req, "ai-analysis")).rejects.toMatchObject({ status: 401 });
    // sanity: é GuardError
    await assertCanUseAI(req, "ai-analysis").catch((e) => {
      expect(e).toBeInstanceOf(GuardError);
    });
  });

  it("flag on + token inválido → 401", async () => {
    h.state.getUser = { data: null, error: { message: "jwt expired" } };
    const { assertCanUseAI } = await loadGuard({ billing: true });
    const req = makeReq({ method: "POST", headers: { authorization: `Bearer ${VALID_TOKEN}` } });
    await expect(assertCanUseAI(req, "ai-analysis")).rejects.toMatchObject({ status: 401 });
  });

  it("flag on + subscription active → isPro sem checar uso", async () => {
    h.state.subRow = { status: "active" };
    const { assertCanUseAI } = await loadGuard({ billing: true });
    const req = makeReq({ method: "POST", headers: { authorization: `Bearer ${VALID_TOKEN}` } });
    const r = await assertCanUseAI(req, "ai-analysis");
    expect(r).toEqual({ userId: "user-1", isPro: true });
  });

  it("flag on + free abaixo do limite → passa (isPro false)", async () => {
    h.state.usageRow = { total_this_month: 3 };
    const { assertCanUseAI } = await loadGuard({ billing: true });
    const req = makeReq({ method: "POST", headers: { authorization: `Bearer ${VALID_TOKEN}` } });
    const r = await assertCanUseAI(req, "ai-analysis");
    expect(r).toEqual({ userId: "user-1", isPro: false });
  });

  it("flag on + free no limite (10) → 402 com payload", async () => {
    h.state.usageRow = { total_this_month: 10 };
    const { assertCanUseAI } = await loadGuard({ billing: true });
    const req = makeReq({ method: "POST", headers: { authorization: `Bearer ${VALID_TOKEN}` } });
    await expect(assertCanUseAI(req, "screener")).rejects.toMatchObject({
      status: 402,
      payload: { feature: "screener", currentUsage: 10, limit: 10, plan: "free" },
    });
  });
});

describe("trackUsage", () => {
  it("flag off → não chama RPC", async () => {
    const { trackUsage } = await loadGuard({ billing: false });
    await trackUsage("user-1", "ai-analysis");
    expect(h.state.rpcCalls).toHaveLength(0);
  });

  it("flag on + userId → chama increment_usage", async () => {
    const { trackUsage } = await loadGuard({ billing: true });
    await trackUsage("user-1", "ai-analysis");
    expect(h.state.rpcCalls).toEqual([
      { name: "increment_usage", args: { p_user_id: "user-1", p_feature: "ai-analysis" } },
    ]);
  });

  it("flag on + userId null → no-op", async () => {
    const { trackUsage } = await loadGuard({ billing: true });
    await trackUsage(null, "ai-analysis");
    expect(h.state.rpcCalls).toHaveLength(0);
  });
});
