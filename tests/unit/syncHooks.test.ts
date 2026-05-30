import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { InvestorProfile, Stock, Transaction } from "@/types/stock";
import * as sync from "@/lib/supabaseSync";
import { useTransactions } from "@/hooks/useTransactions";
import { useInvestorProfile } from "@/hooks/useInvestorProfile";
import { useStockQuotes } from "@/hooks/useStockQuotes";

/**
 * Cobre os caminhos de sincronizacao Supabase das hooks de estado
 * (useTransactions / useInvestorProfile / useStockQuotes): sync-on-login,
 * migracao one-time (servidor vazio + local presente) e write-through nas
 * mutacoes. useAuth e a camada de sync sao mockados; nao ha rede.
 */

const authState = vi.hoisted(() => ({ user: null as { id: string } | null }));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: authState.user,
    session: null,
    loading: false,
    isAuthenticated: !!authState.user,
    signInWithMagicLink: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("@/lib/supabaseSync", () => ({
  fetchTransactionsFromServer: vi.fn(),
  bulkUploadTransactions: vi.fn(),
  insertTransactionOnServer: vi.fn(),
  clearAllTransactionsOnServer: vi.fn(),
  fetchProfileFromServer: vi.fn(),
  saveProfileToServer: vi.fn(),
  clearProfileFromServer: vi.fn(),
  fetchPortfolioFromServer: vi.fn(),
  bulkUploadPortfolio: vi.fn(),
  upsertPortfolioStock: vi.fn(),
  deletePortfolioStock: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  fetchMultipleQuotes: vi.fn(async () => []),
  fetchStockQuote: vi.fn(async () => null),
}));

const m = vi.mocked(sync);

beforeEach(() => {
  authState.user = null;
  for (const fn of Object.values(m)) {
    (fn as ReturnType<typeof vi.fn>).mockReset();
  }
  // Defaults: servidor sem dados.
  m.fetchTransactionsFromServer.mockResolvedValue(null);
  m.fetchProfileFromServer.mockResolvedValue(null);
  m.fetchPortfolioFromServer.mockResolvedValue(null);
  m.bulkUploadTransactions.mockResolvedValue(undefined);
  m.bulkUploadPortfolio.mockResolvedValue(undefined);
  m.saveProfileToServer.mockResolvedValue(undefined);
});

/* ─── useTransactions ──────────────────────────────────────────────────── */

const TX: Transaction = {
  id: "t1",
  ticker: "PETR4",
  type: "buy",
  orderType: "Mercado",
  shares: 10,
  price: 30,
  total: 300,
  fee: 0,
  timestamp: "2024-01-01T00:00:00Z",
};

describe("useTransactions — sync", () => {
  it("substitui estado pelo remoto no login", async () => {
    authState.user = { id: "u1" };
    m.fetchTransactionsFromServer.mockResolvedValue([TX]);
    const { result } = renderHook(() => useTransactions());
    await waitFor(() => expect(result.current.transactions).toHaveLength(1));
    expect(m.fetchTransactionsFromServer).toHaveBeenCalledWith("u1");
    expect(result.current.transactions[0].ticker).toBe("PETR4");
  });

  it("migra local quando servidor vazio", async () => {
    localStorage.setItem("praxia-transactions", JSON.stringify([TX]));
    authState.user = { id: "u1" };
    m.fetchTransactionsFromServer.mockResolvedValue([]);
    renderHook(() => useTransactions());
    await waitFor(() => expect(m.bulkUploadTransactions).toHaveBeenCalledWith("u1", [TX]));
  });

  it("record faz write-through no servidor quando logado", async () => {
    authState.user = { id: "u1" };
    const { result } = renderHook(() => useTransactions());
    await waitFor(() => expect(m.fetchTransactionsFromServer).toHaveBeenCalled());
    act(() => {
      result.current.record({ ticker: "VALE3", type: "buy", orderType: "Mercado", shares: 1, price: 50, total: 50, fee: 0 });
    });
    expect(m.insertTransactionOnServer).toHaveBeenCalledWith("u1", expect.objectContaining({ ticker: "VALE3" }));
  });

  it("clear limpa no servidor quando logado", async () => {
    authState.user = { id: "u1" };
    const { result } = renderHook(() => useTransactions());
    await waitFor(() => expect(m.fetchTransactionsFromServer).toHaveBeenCalled());
    act(() => result.current.clear());
    expect(m.clearAllTransactionsOnServer).toHaveBeenCalledWith("u1");
  });

  it("sem usuario nao sincroniza", async () => {
    const { result } = renderHook(() => useTransactions());
    act(() => {
      result.current.record({ ticker: "X", type: "buy", orderType: "Mercado", shares: 1, price: 1, total: 1, fee: 0 });
    });
    expect(m.fetchTransactionsFromServer).not.toHaveBeenCalled();
    expect(m.insertTransactionOnServer).not.toHaveBeenCalled();
  });
});

/* ─── useInvestorProfile ───────────────────────────────────────────────── */

const PROFILE: InvestorProfile = {
  risk: "mid",
  horizon: "long",
  interests: ["div"],
  completedAt: "2024-01-01",
};

describe("useInvestorProfile — sync", () => {
  it("aplica perfil remoto no login e persiste no localStorage", async () => {
    authState.user = { id: "u1" };
    m.fetchProfileFromServer.mockResolvedValue(PROFILE);
    const { result } = renderHook(() => useInvestorProfile());
    await waitFor(() => expect(result.current.profile).not.toBeNull());
    expect(result.current.profile?.risk).toBe("mid");
    expect(localStorage.getItem("praxia-investor-profile")).toContain("mid");
  });

  it("migra perfil local quando servidor vazio", async () => {
    localStorage.setItem("praxia-investor-profile", JSON.stringify(PROFILE));
    authState.user = { id: "u1" };
    m.fetchProfileFromServer.mockResolvedValue(null);
    renderHook(() => useInvestorProfile());
    await waitFor(() => expect(m.saveProfileToServer).toHaveBeenCalledWith("u1", PROFILE));
  });

  it("saveProfile faz write-through quando logado", async () => {
    authState.user = { id: "u1" };
    const { result } = renderHook(() => useInvestorProfile());
    await waitFor(() => expect(m.fetchProfileFromServer).toHaveBeenCalled());
    act(() => result.current.saveProfile({ risk: "high", horizon: "short", interests: [] }));
    expect(m.saveProfileToServer).toHaveBeenCalledWith("u1", expect.objectContaining({ risk: "high" }));
  });

  it("reset limpa no servidor quando logado", async () => {
    authState.user = { id: "u1" };
    const { result } = renderHook(() => useInvestorProfile());
    await waitFor(() => expect(m.fetchProfileFromServer).toHaveBeenCalled());
    act(() => result.current.reset());
    expect(m.clearProfileFromServer).toHaveBeenCalledWith("u1");
  });
});

/* ─── useStockQuotes ───────────────────────────────────────────────────── */

const STORED_STOCK: Partial<Stock> = {
  ticker: "PETR4",
  name: "Petrobras",
  sector: "Energia",
  quantity: 10,
  cost: 30,
  price: 35,
};

describe("useStockQuotes — sync", () => {
  it("mantem localStorage quando servidor retorna null (erro/nao-config)", async () => {
    localStorage.setItem("stocks-ai-portfolio", JSON.stringify([STORED_STOCK]));
    authState.user = { id: "u1" };
    m.fetchPortfolioFromServer.mockResolvedValue(null);
    const { result } = renderHook(() => useStockQuotes());
    await waitFor(() => expect(m.fetchPortfolioFromServer).toHaveBeenCalledWith("u1"));
    expect(m.bulkUploadPortfolio).not.toHaveBeenCalled();
    expect(result.current.stocks).toHaveLength(1);
  });

  it("migra carteira local quando servidor vazio", async () => {
    localStorage.setItem("stocks-ai-portfolio", JSON.stringify([STORED_STOCK]));
    authState.user = { id: "u1" };
    m.fetchPortfolioFromServer.mockResolvedValue([]);
    renderHook(() => useStockQuotes());
    await waitFor(() =>
      expect(m.bulkUploadPortfolio).toHaveBeenCalledWith("u1", expect.arrayContaining([
        expect.objectContaining({ ticker: "PETR4" }),
      ]))
    );
  });

  it("esvazia estado quando servidor e local vazios", async () => {
    authState.user = { id: "u1" };
    m.fetchPortfolioFromServer.mockResolvedValue([]);
    const { result } = renderHook(() => useStockQuotes());
    await waitFor(() => expect(m.fetchPortfolioFromServer).toHaveBeenCalled());
    expect(result.current.stocks).toHaveLength(0);
    expect(m.bulkUploadPortfolio).not.toHaveBeenCalled();
  });
});
