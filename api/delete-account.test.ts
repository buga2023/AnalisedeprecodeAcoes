import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { makeReq, makeRes } from "./test-helpers";
import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Unit — endpoint LGPD Art. 18 (exclusao de conta).
 *
 * `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` sao lidas como const no load do
 * modulo, entao cada teste faz `vi.resetModules()` + import dinamico apos
 * configurar (ou nao) as envs. O client supabase e totalmente mockado.
 */

const h = vi.hoisted(() => ({
  state: {
    getUser: { data: { user: { id: "user-123" } }, error: null } as {
      data: { user: { id: string } | null } | null;
      error: { message: string } | null;
    },
    deleteErrors: {} as Record<string, { message: string } | null>,
    deleteUserError: null as { message: string } | null,
    deletedTables: [] as string[],
    deleteUserCalledWith: [] as string[],
  },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => h.state.getUser,
      admin: {
        deleteUser: async (uid: string) => {
          h.state.deleteUserCalledWith.push(uid);
          return { error: h.state.deleteUserError };
        },
      },
    },
    from: (table: string) => ({
      delete: () => ({
        eq: async () => {
          h.state.deletedTables.push(table);
          return { error: h.state.deleteErrors[table] ?? null };
        },
      }),
    }),
  }),
}));

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

let ipCounter = 0;
function reqWithUniqueIp(opts: Parameters<typeof makeReq>[0] = {}) {
  ipCounter += 1;
  return makeReq({
    ...opts,
    headers: { ...(opts.headers ?? {}), "x-forwarded-for": `10.9.0.${ipCounter % 250}` },
  });
}

async function loadHandler(configured = true): Promise<Handler> {
  vi.resetModules();
  vi.stubEnv("SUPABASE_URL", configured ? "https://proj.supabase.co" : "");
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", configured ? "service-role-key" : "");
  const mod = await import("./delete-account");
  return mod.default as Handler;
}

const VALID_TOKEN = "x".repeat(60);

beforeEach(() => {
  h.state.getUser = { data: { user: { id: "user-123" } }, error: null };
  h.state.deleteErrors = {};
  h.state.deleteUserError = null;
  h.state.deletedTables = [];
  h.state.deleteUserCalledWith = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("api/delete-account", () => {
  it("responde a preflight OPTIONS", async () => {
    const handler = await loadHandler();
    const req = reqWithUniqueIp({ method: "OPTIONS" });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.ended).toBe(true);
    expect([200, 204]).toContain(res.mock.statusCode);
  });

  it("405 em metodo diferente de POST", async () => {
    const handler = await loadHandler();
    const req = reqWithUniqueIp({ method: "GET" });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(405);
  });

  it("503 quando envs do servidor estao ausentes", async () => {
    const handler = await loadHandler(false);
    const req = reqWithUniqueIp({
      method: "POST",
      headers: { authorization: `Bearer ${VALID_TOKEN}` },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(503);
    expect((res.mock.body as { error: string }).error).toBe("service-unavailable");
  });

  it("401 sem header Authorization", async () => {
    const handler = await loadHandler();
    const req = reqWithUniqueIp({ method: "POST" });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(401);
    expect((res.mock.body as { error: string }).error).toBe("missing-bearer-token");
  });

  it("401 quando o token tem shape invalido (muito curto)", async () => {
    const handler = await loadHandler();
    const req = reqWithUniqueIp({ method: "POST", headers: { authorization: "Bearer abc" } });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(401);
    expect((res.mock.body as { error: string }).error).toBe("invalid-token-shape");
  });

  it("401 quando o supabase rejeita o JWT", async () => {
    h.state.getUser = { data: null, error: { message: "jwt expired" } };
    const handler = await loadHandler();
    const req = reqWithUniqueIp({
      method: "POST",
      headers: { authorization: `Bearer ${VALID_TOKEN}` },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.mock.statusCode).toBe(401);
    expect((res.mock.body as { error: string }).error).toBe("invalid-token");
  });

  it("happy path: apaga as 4 tabelas e o auth.user, responde 200", async () => {
    const handler = await loadHandler();
    const req = reqWithUniqueIp({
      method: "POST",
      headers: { authorization: `Bearer ${VALID_TOKEN}` },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.mock.statusCode).toBe(200);
    expect(res.mock.body).toEqual({ ok: true, userDeleted: true });
    expect(h.state.deletedTables.sort()).toEqual([
      "portfolio_stocks",
      "preferences",
      "profiles",
      "subscriptions",
      "transactions",
      "usage_log",
    ]);
    expect(h.state.deleteUserCalledWith).toEqual(["user-123"]);
  });

  it("500 partial-failure quando um delete de tabela falha (nao chama deleteUser)", async () => {
    h.state.deleteErrors = { transactions: { message: "boom" } };
    const handler = await loadHandler();
    const req = reqWithUniqueIp({
      method: "POST",
      headers: { authorization: `Bearer ${VALID_TOKEN}` },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.mock.statusCode).toBe(500);
    const body = res.mock.body as { error: string; tables: string[] };
    expect(body.error).toBe("partial-failure");
    expect(body.tables).toContain("transactions");
    expect(h.state.deleteUserCalledWith).toEqual([]);
  });

  it("207 quando tabelas foram apagadas mas deleteUser falha", async () => {
    h.state.deleteUserError = { message: "auth down" };
    const handler = await loadHandler();
    const req = reqWithUniqueIp({
      method: "POST",
      headers: { authorization: `Bearer ${VALID_TOKEN}` },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.mock.statusCode).toBe(207);
    const body = res.mock.body as { partial: boolean; tablesDeleted: boolean; userDeleted: boolean };
    expect(body.partial).toBe(true);
    expect(body.tablesDeleted).toBe(true);
    expect(body.userDeleted).toBe(false);
  });
});
