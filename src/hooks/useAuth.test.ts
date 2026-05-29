import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

// Estado mockavel do modulo @/lib/supabase. `configured` controla o guard
// isSupabaseConfigured; `authCallback` guarda o listener de onAuthStateChange
// pra disparar eventos (PASSWORD_RECOVERY) nos testes.
const mocks = vi.hoisted(() => {
  const state = {
    configured: true,
    authCallback: null as null | ((event: string, session: unknown) => void),
  };
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: null } })),
    onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
      state.authCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    signInWithPassword: vi.fn(async () => ({ data: { session: {} }, error: null })),
    signUp: vi.fn(async () => ({ data: { session: {} }, error: null })),
    signInWithOtp: vi.fn(async () => ({ data: {}, error: null })),
    resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null })),
    updateUser: vi.fn(async () => ({ data: { user: {} }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
  };
  return { state, auth };
});

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: mocks.auth },
  get isSupabaseConfigured() {
    return mocks.state.configured;
  },
}));

import { useAuth } from "./useAuth";

beforeEach(() => {
  mocks.state.configured = true;
  mocks.state.authCallback = null;
  vi.clearAllMocks();
  // re-stub defaults apos clear
  mocks.auth.getSession.mockResolvedValue({ data: { session: null } });
  mocks.auth.onAuthStateChange.mockImplementation((cb) => {
    mocks.state.authCallback = cb;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  mocks.auth.signInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });
  mocks.auth.signUp.mockResolvedValue({ data: { session: {} }, error: null });
  mocks.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
  mocks.auth.updateUser.mockResolvedValue({ data: { user: {} }, error: null });
});

async function mounted() {
  const hook = renderHook(() => useAuth());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe("useAuth — email + senha", () => {
  it("signInWithPassword normaliza email e retorna ok", async () => {
    const { result } = await mounted();
    let res: unknown;
    await act(async () => {
      res = await result.current.signInWithPassword("  User@Email.com ", "segredo12");
    });
    expect(mocks.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "user@email.com",
      password: "segredo12",
    });
    expect(res).toEqual({ ok: true });
  });

  it("signInWithPassword propaga erro do supabase", async () => {
    mocks.auth.signInWithPassword.mockResolvedValueOnce({
      data: { session: null },
      error: { message: "Invalid login credentials" },
    });
    const { result } = await mounted();
    let res: unknown;
    await act(async () => {
      res = await result.current.signInWithPassword("a@b.com", "errada12");
    });
    expect(res).toEqual({ ok: false, error: "Invalid login credentials" });
  });

  it("signUpWithPassword com sessao retorna ok (loga direto)", async () => {
    const { result } = await mounted();
    let res: unknown;
    await act(async () => {
      res = await result.current.signUpWithPassword("novo@b.com", "segredo12");
    });
    expect(mocks.auth.signUp).toHaveBeenCalledWith({
      email: "novo@b.com",
      password: "segredo12",
    });
    expect(res).toEqual({ ok: true });
  });

  it("signUpWithPassword sem sessao sinaliza needsConfirmation", async () => {
    mocks.auth.signUp.mockResolvedValueOnce({
      data: { session: null, user: {} },
      error: null,
    });
    const { result } = await mounted();
    let res: unknown;
    await act(async () => {
      res = await result.current.signUpWithPassword("novo@b.com", "segredo12");
    });
    expect(res).toEqual({ ok: true, needsConfirmation: true });
  });

  it("signUpWithPassword propaga erro", async () => {
    mocks.auth.signUp.mockResolvedValueOnce({
      data: { session: null },
      error: { message: "User already registered" },
    });
    const { result } = await mounted();
    let res: unknown;
    await act(async () => {
      res = await result.current.signUpWithPassword("dup@b.com", "segredo12");
    });
    expect(res).toEqual({ ok: false, error: "User already registered" });
  });

  it("resetPassword chama resetPasswordForEmail com redirectTo", async () => {
    const { result } = await mounted();
    let res: unknown;
    await act(async () => {
      res = await result.current.resetPassword("  Me@B.com ");
    });
    expect(mocks.auth.resetPasswordForEmail).toHaveBeenCalledWith("me@b.com", {
      redirectTo: window.location.origin,
    });
    expect(res).toEqual({ ok: true });
  });

  it("updatePassword chama updateUser e reseta passwordRecovery", async () => {
    const { result } = await mounted();
    // entra em modo recuperacao
    act(() => mocks.state.authCallback?.("PASSWORD_RECOVERY", { user: {} }));
    await waitFor(() => expect(result.current.passwordRecovery).toBe(true));

    let res: unknown;
    await act(async () => {
      res = await result.current.updatePassword("novasenha12");
    });
    expect(mocks.auth.updateUser).toHaveBeenCalledWith({ password: "novasenha12" });
    expect(res).toEqual({ ok: true });
    await waitFor(() => expect(result.current.passwordRecovery).toBe(false));
  });

  it("evento PASSWORD_RECOVERY liga passwordRecovery", async () => {
    const { result } = await mounted();
    expect(result.current.passwordRecovery).toBe(false);
    act(() => mocks.state.authCallback?.("PASSWORD_RECOVERY", { user: {} }));
    await waitFor(() => expect(result.current.passwordRecovery).toBe(true));
  });

  it("sem config: cada acao retorna erro de configuracao", async () => {
    mocks.state.configured = false;
    const { result } = await mounted();
    const signin = await result.current.signInWithPassword("a@b.com", "segredo12");
    const signup = await result.current.signUpWithPassword("a@b.com", "segredo12");
    const reset = await result.current.resetPassword("a@b.com");
    const upd = await result.current.updatePassword("segredo12");
    for (const r of [signin, signup, reset, upd]) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/configurado/i);
    }
    expect(mocks.auth.signInWithPassword).not.toHaveBeenCalled();
  });
});
