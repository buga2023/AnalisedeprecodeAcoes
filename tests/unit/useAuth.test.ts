import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Exercita o wrap do supabase.auth: branch nao-configurado, getSession,
 * onAuthStateChange, signInWithMagicLink (ok/erro/nao-configurado) e signOut.
 */

const mock = vi.hoisted(() => {
  const state: { configured: boolean; session: unknown } = { configured: true, session: null };
  const unsubscribe = vi.fn();
  const auth = {
    getSession: vi.fn(() => Promise.resolve({ data: { session: state.session } })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe } } })),
    signInWithOtp: vi.fn(() => Promise.resolve({ error: null as { message: string } | null })),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
  };
  return { state, auth, unsubscribe };
});

vi.mock("@/lib/supabase", () => ({
  get isSupabaseConfigured() {
    return mock.state.configured;
  },
  supabase: { auth: mock.auth },
}));

beforeEach(() => {
  mock.state.configured = true;
  mock.state.session = null;
  mock.auth.getSession.mockClear();
  mock.auth.onAuthStateChange.mockClear();
  mock.auth.signInWithOtp.mockClear().mockResolvedValue({ error: null });
  mock.auth.signOut.mockClear();
  mock.unsubscribe.mockClear();
});

describe("useAuth — branch nao configurado", () => {
  it("fica nao-autenticado e nao toca no supabase", async () => {
    mock.state.configured = false;
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(mock.auth.getSession).not.toHaveBeenCalled();
  });

  it("signInWithMagicLink retorna erro de configuracao", async () => {
    mock.state.configured = false;
    const { result } = renderHook(() => useAuth());
    const res = await result.current.signInWithMagicLink("a@b.com");
    expect(res).toEqual({ ok: false, error: expect.stringContaining("nao configurado") });
    expect(mock.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it("signOut e no-op", async () => {
    mock.state.configured = false;
    const { result } = renderHook(() => useAuth());
    await result.current.signOut();
    expect(mock.auth.signOut).not.toHaveBeenCalled();
  });
});

describe("useAuth — configurado", () => {
  it("sem sessao corrente -> usuario nulo apos getSession", async () => {
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(mock.auth.getSession).toHaveBeenCalled();
    expect(mock.auth.onAuthStateChange).toHaveBeenCalled();
  });

  it("com sessao corrente -> usuario autenticado", async () => {
    mock.state.session = { user: { id: "u1", email: "x@y.com" } };
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.user).toMatchObject({ id: "u1" });
  });

  it("onAuthStateChange reflete login em tempo real", async () => {
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const cb = mock.auth.onAuthStateChange.mock.calls[0][0] as (
      e: string,
      s: unknown
    ) => void;
    act(() => cb("SIGNED_IN", { user: { id: "u2" } }));
    expect(result.current.user).toMatchObject({ id: "u2" });
    act(() => cb("SIGNED_OUT", null));
    expect(result.current.user).toBeNull();
  });

  it("desinscreve no unmount", async () => {
    const { result, unmount } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    unmount();
    expect(mock.unsubscribe).toHaveBeenCalled();
  });

  it("signInWithMagicLink normaliza email e retorna ok", async () => {
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const res = await result.current.signInWithMagicLink("  USER@MAIL.COM ");
    expect(res).toEqual({ ok: true });
    expect(mock.auth.signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: "user@mail.com" })
    );
  });

  it("signInWithMagicLink propaga erro do supabase", async () => {
    mock.auth.signInWithOtp.mockResolvedValueOnce({ error: { message: "rate limit" } });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const res = await result.current.signInWithMagicLink("a@b.com");
    expect(res).toEqual({ ok: false, error: "rate limit" });
  });

  it("signOut chama supabase.auth.signOut", async () => {
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await result.current.signOut();
    expect(mock.auth.signOut).toHaveBeenCalled();
  });
});
