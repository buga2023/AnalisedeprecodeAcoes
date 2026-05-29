import { describe, it, expect, beforeEach, vi } from "vitest";
import type { InvestorProfile, Stock, Transaction } from "@/types/stock";
import {
  fetchPortfolioFromServer,
  upsertPortfolioStock,
  deletePortfolioStock,
  bulkUploadPortfolio,
  fetchProfileFromServer,
  saveProfileToServer,
  clearProfileFromServer,
  fetchTransactionsFromServer,
  insertTransactionOnServer,
  bulkUploadTransactions,
  clearAllTransactionsOnServer,
  fetchPreferencesFromServer,
  savePreferencesToServer,
} from "@/lib/supabaseSync";

/**
 * Cobre a camada de sync localStorage <-> Supabase. O cliente `@/lib/supabase`
 * eh mockado por um query-builder encadeavel: cada metodo (`select`, `eq`,
 * `upsert`, ...) devolve o mesmo builder, que e thenable e resolve para
 * `mock.state.result`. Assim conseguimos exercitar happy-path, error-path e o
 * curto-circuito de `isSupabaseConfigured = false` sem rede.
 */

type QueryResult = { data: unknown; error: unknown };

const mock = vi.hoisted(() => {
  const state: { result: QueryResult; configured: boolean } = {
    result: { data: null, error: null },
    configured: true,
  };
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  const ret = () => builder;
  for (const name of ["select", "eq", "order", "upsert", "insert", "update", "delete"]) {
    builder[name] = vi.fn(ret);
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve(state.result));
  // Torna o builder "thenable" para `await supabase.from(t).select().eq()`.
  (builder as Record<string, unknown>).then = (
    resolve: (v: QueryResult) => unknown,
    reject: (e: unknown) => unknown
  ) => Promise.resolve(state.result).then(resolve, reject);
  const from = vi.fn(() => builder);
  return { state, builder, from };
});

vi.mock("@/lib/supabase", () => ({
  get isSupabaseConfigured() {
    return mock.state.configured;
  },
  supabase: { from: mock.from },
}));

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mock.state.result = { data: null, error: null };
  mock.state.configured = true;
  mock.from.mockClear();
  for (const fn of Object.values(mock.builder)) {
    if (typeof (fn as { mockClear?: unknown }).mockClear === "function") {
      (fn as ReturnType<typeof vi.fn>).mockClear();
    }
  }
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

const ERR: QueryResult = { data: null, error: { message: "boom" } };

/* ─── Portfolio ────────────────────────────────────────────────────────── */

describe("fetchPortfolioFromServer", () => {
  it("retorna null e nao chama o cliente quando nao configurado", async () => {
    mock.state.configured = false;
    expect(await fetchPortfolioFromServer("u1")).toBeNull();
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("retorna null e loga quando o servidor responde erro", async () => {
    mock.state.result = ERR;
    expect(await fetchPortfolioFromServer("u1")).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("mapeia linhas e coage tipos numericos", async () => {
    mock.state.result = {
      data: [{ ticker: "PETR4", name: "Petro", sector: "Energia", quantity: "10", cost: "30.5" }],
      error: null,
    };
    const out = await fetchPortfolioFromServer("u1");
    expect(mock.from).toHaveBeenCalledWith("portfolio_stocks");
    expect(out).toEqual([
      { ticker: "PETR4", name: "Petro", sector: "Energia", quantity: 10, cost: 30.5 },
    ]);
  });

  it("aplica defaults para campos nulos/ausentes", async () => {
    mock.state.result = { data: [{ ticker: "VALE3", name: null, sector: null }], error: null };
    const out = await fetchPortfolioFromServer("u1");
    expect(out).toEqual([{ ticker: "VALE3", name: "", sector: "", quantity: 0, cost: 0 }]);
  });

  it("trata data nula como lista vazia", async () => {
    mock.state.result = { data: null, error: null };
    expect(await fetchPortfolioFromServer("u1")).toEqual([]);
  });
});

const STOCK: Pick<Stock, "ticker" | "name" | "sector" | "quantity" | "cost"> = {
  ticker: "PETR4",
  name: "Petrobras",
  sector: "Energia",
  quantity: 10,
  cost: 30,
};

describe("upsertPortfolioStock", () => {
  it("nao faz nada quando nao configurado", async () => {
    mock.state.configured = false;
    await upsertPortfolioStock("u1", STOCK);
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("faz upsert com onConflict user_id,ticker", async () => {
    await upsertPortfolioStock("u1", STOCK);
    expect(mock.from).toHaveBeenCalledWith("portfolio_stocks");
    expect(mock.builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "u1", ticker: "PETR4", quantity: 10, cost: 30 }),
      { onConflict: "user_id,ticker" }
    );
  });

  it("converte name/sector vazios em null", async () => {
    await upsertPortfolioStock("u1", { ...STOCK, name: "", sector: "" });
    expect(mock.builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ name: null, sector: null }),
      expect.anything()
    );
  });

  it("loga quando da erro", async () => {
    mock.state.result = ERR;
    await upsertPortfolioStock("u1", STOCK);
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe("deletePortfolioStock", () => {
  it("nao faz nada quando nao configurado", async () => {
    mock.state.configured = false;
    await deletePortfolioStock("u1", "PETR4");
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("deleta filtrando por user_id e ticker", async () => {
    await deletePortfolioStock("u1", "PETR4");
    expect(mock.builder.delete).toHaveBeenCalled();
    expect(mock.builder.eq).toHaveBeenCalledWith("user_id", "u1");
    expect(mock.builder.eq).toHaveBeenCalledWith("ticker", "PETR4");
  });

  it("loga quando da erro", async () => {
    mock.state.result = ERR;
    await deletePortfolioStock("u1", "PETR4");
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe("bulkUploadPortfolio", () => {
  it("nao faz nada quando nao configurado", async () => {
    mock.state.configured = false;
    await bulkUploadPortfolio("u1", [STOCK]);
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("nao faz nada com lista vazia", async () => {
    await bulkUploadPortfolio("u1", []);
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("faz upsert de todas as linhas", async () => {
    await bulkUploadPortfolio("u1", [STOCK, { ...STOCK, ticker: "VALE3" }]);
    const rows = mock.builder.upsert.mock.calls[0][0] as unknown[];
    expect(rows).toHaveLength(2);
  });

  it("loga quando da erro", async () => {
    mock.state.result = ERR;
    await bulkUploadPortfolio("u1", [STOCK]);
    expect(warnSpy).toHaveBeenCalled();
  });
});

/* ─── Profile ──────────────────────────────────────────────────────────── */

describe("fetchProfileFromServer", () => {
  it("retorna null quando nao configurado", async () => {
    mock.state.configured = false;
    expect(await fetchProfileFromServer("u1")).toBeNull();
  });

  it("retorna null em erro", async () => {
    mock.state.result = ERR;
    expect(await fetchProfileFromServer("u1")).toBeNull();
  });

  it("retorna null quando quiz nao foi feito (sem risk/horizon)", async () => {
    mock.state.result = { data: { risk: null, horizon: null, interests: [] }, error: null };
    expect(await fetchProfileFromServer("u1")).toBeNull();
  });

  it("mapeia perfil completo", async () => {
    mock.state.result = {
      data: { risk: "mid", horizon: "long", interests: ["div"], quiz_completed_at: "2024-01-01" },
      error: null,
    };
    expect(await fetchProfileFromServer("u1")).toEqual({
      risk: "mid",
      horizon: "long",
      interests: ["div"],
      completedAt: "2024-01-01",
    });
  });

  it("usa [] quando interests vem nulo", async () => {
    mock.state.result = {
      data: { risk: "low", horizon: "short", interests: null, quiz_completed_at: null },
      error: null,
    };
    const out = await fetchProfileFromServer("u1");
    expect(out?.interests).toEqual([]);
    expect(out?.completedAt).toBeTruthy();
  });
});

const PROFILE: InvestorProfile = {
  risk: "mid",
  horizon: "long",
  interests: ["div"],
  completedAt: "2024-01-01",
};

describe("saveProfileToServer", () => {
  it("nao faz nada quando nao configurado", async () => {
    mock.state.configured = false;
    await saveProfileToServer("u1", PROFILE);
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("faz upsert com onConflict user_id", async () => {
    await saveProfileToServer("u1", PROFILE);
    expect(mock.builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "u1", risk: "mid", horizon: "long" }),
      { onConflict: "user_id" }
    );
  });

  it("loga em erro", async () => {
    mock.state.result = ERR;
    await saveProfileToServer("u1", PROFILE);
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe("clearProfileFromServer", () => {
  it("nao faz nada quando nao configurado", async () => {
    mock.state.configured = false;
    await clearProfileFromServer("u1");
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("zera os campos do perfil", async () => {
    await clearProfileFromServer("u1");
    expect(mock.builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ risk: null, horizon: null, interests: [] })
    );
    expect(mock.builder.eq).toHaveBeenCalledWith("user_id", "u1");
  });

  it("loga em erro", async () => {
    mock.state.result = ERR;
    await clearProfileFromServer("u1");
    expect(warnSpy).toHaveBeenCalled();
  });
});

/* ─── Transactions ─────────────────────────────────────────────────────── */

describe("fetchTransactionsFromServer", () => {
  it("retorna null quando nao configurado", async () => {
    mock.state.configured = false;
    expect(await fetchTransactionsFromServer("u1")).toBeNull();
  });

  it("retorna null e loga em erro", async () => {
    mock.state.result = ERR;
    expect(await fetchTransactionsFromServer("u1")).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("mapeia kind 'sell' e coage numeros", async () => {
    mock.state.result = {
      data: [
        { id: "a", ticker: "PETR4", kind: "sell", quantity: "5", price: "30", total: "150", occurred_at: "t1", note: null },
      ],
      error: null,
    };
    const out = await fetchTransactionsFromServer("u1");
    expect(out).toEqual([
      { id: "a", ticker: "PETR4", type: "sell", orderType: "Mercado", shares: 5, price: 30, total: 150, fee: 0, timestamp: "t1" },
    ]);
  });

  it("converte kind 'dividend' (schema novo) em 'buy' (tipo legado)", async () => {
    mock.state.result = {
      data: [{ id: "b", ticker: "ITUB4", kind: "dividend", quantity: "0", price: "0", total: "12", occurred_at: "t2" }],
      error: null,
    };
    const out = await fetchTransactionsFromServer("u1");
    expect(out?.[0].type).toBe("buy");
  });

  it("ordena por occurred_at desc", async () => {
    await fetchTransactionsFromServer("u1");
    expect(mock.builder.order).toHaveBeenCalledWith("occurred_at", { ascending: false });
  });
});

const TX: Transaction = {
  id: "tx1",
  ticker: "PETR4",
  type: "buy",
  orderType: "Mercado",
  shares: 10,
  price: 30,
  total: 300,
  fee: 1,
  timestamp: "2024-01-01T00:00:00Z",
};

describe("insertTransactionOnServer", () => {
  it("nao faz nada quando nao configurado", async () => {
    mock.state.configured = false;
    await insertTransactionOnServer("u1", TX);
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("insere mapeando shares->quantity e type->kind", async () => {
    await insertTransactionOnServer("u1", TX);
    expect(mock.builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: "tx1", user_id: "u1", kind: "buy", quantity: 10, total: 300 })
    );
  });

  it("loga em erro", async () => {
    mock.state.result = ERR;
    await insertTransactionOnServer("u1", TX);
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe("bulkUploadTransactions", () => {
  it("nao faz nada quando nao configurado ou lista vazia", async () => {
    mock.state.configured = false;
    await bulkUploadTransactions("u1", [TX]);
    expect(mock.from).not.toHaveBeenCalled();
    mock.state.configured = true;
    await bulkUploadTransactions("u1", []);
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("faz upsert por id", async () => {
    await bulkUploadTransactions("u1", [TX]);
    expect(mock.builder.upsert).toHaveBeenCalledWith(expect.any(Array), { onConflict: "id" });
  });

  it("loga em erro", async () => {
    mock.state.result = ERR;
    await bulkUploadTransactions("u1", [TX]);
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe("clearAllTransactionsOnServer", () => {
  it("nao faz nada quando nao configurado", async () => {
    mock.state.configured = false;
    await clearAllTransactionsOnServer("u1");
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("deleta todas filtrando por user_id", async () => {
    await clearAllTransactionsOnServer("u1");
    expect(mock.builder.delete).toHaveBeenCalled();
    expect(mock.builder.eq).toHaveBeenCalledWith("user_id", "u1");
  });

  it("loga em erro", async () => {
    mock.state.result = ERR;
    await clearAllTransactionsOnServer("u1");
    expect(warnSpy).toHaveBeenCalled();
  });
});

/* ─── Preferences ──────────────────────────────────────────────────────── */

describe("fetchPreferencesFromServer", () => {
  it("retorna null quando nao configurado", async () => {
    mock.state.configured = false;
    expect(await fetchPreferencesFromServer("u1")).toBeNull();
  });

  it("retorna null em erro ou sem dados", async () => {
    mock.state.result = ERR;
    expect(await fetchPreferencesFromServer("u1")).toBeNull();
  });

  it("mapeia preferencias", async () => {
    mock.state.result = {
      data: { accent: "#5b7cff", tone: "casual", ai_verbosity: "normal" },
      error: null,
    };
    expect(await fetchPreferencesFromServer("u1")).toEqual({
      accent: "#5b7cff",
      tone: "casual",
      aiVerbosity: "normal",
    });
  });
});

describe("savePreferencesToServer", () => {
  it("nao faz nada quando nao configurado", async () => {
    mock.state.configured = false;
    await savePreferencesToServer("u1", { accent: "#fff", tone: "casual", aiVerbosity: "normal" });
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("faz upsert com onConflict user_id", async () => {
    await savePreferencesToServer("u1", { accent: "#fff", tone: "formal", aiVerbosity: "concise" });
    expect(mock.builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "u1", accent: "#fff", tone: "formal", ai_verbosity: "concise" }),
      { onConflict: "user_id" }
    );
  });

  it("loga em erro", async () => {
    mock.state.result = ERR;
    await savePreferencesToServer("u1", { accent: "#fff", tone: "casual", aiVerbosity: "normal" });
    expect(warnSpy).toHaveBeenCalled();
  });
});
