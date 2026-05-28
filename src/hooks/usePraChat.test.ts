import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePraChat } from "./usePraChat";

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("usePraChat", () => {
  it("começa sem mensagens", () => {
    const { result } = renderHook(() =>
      usePraChat({ tone: "casual", profile: null, stocks: [], totalValue: 0 })
    );
    expect(result.current.messages).toEqual([]);
  });

  it("ensureGreeting adiciona mensagem de boas-vindas quando vazio", () => {
    const { result } = renderHook(() =>
      usePraChat({ tone: "casual", profile: null, stocks: [], totalValue: 0 })
    );
    act(() => result.current.ensureGreeting());
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe("pra");
  });

  it("send com texto vazio é noop", async () => {
    const { result } = renderHook(() =>
      usePraChat({ tone: "casual", profile: null, stocks: [], totalValue: 0 })
    );
    await act(async () => {
      await result.current.send("   ");
    });
    expect(result.current.messages).toEqual([]);
  });

  it("send adiciona msg do usuário e resposta da Pra em sucesso", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ content: "Resposta da Pra" }), { status: 200 })
      )
    );
    const { result } = renderHook(() =>
      usePraChat({ tone: "casual", profile: null, stocks: [], totalValue: 0 })
    );
    await act(async () => {
      await result.current.send("Olá");
    });
    expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
    expect(result.current.messages[0].role).toBe("user");
    expect(result.current.messages.at(-1)?.role).toBe("pra");
  });

  it("send em falha usa fallbackReply", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    const { result } = renderHook(() =>
      usePraChat({ tone: "casual", profile: null, stocks: [], totalValue: 0 })
    );
    await act(async () => {
      await result.current.send("falar de dividendos");
    });
    const last = result.current.messages.at(-1);
    expect(last?.role).toBe("pra");
    expect(last?.text).toMatch(/dividend/i);
  });

  it("extrai marcador [PROFILE] e chama onProfileDetected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            content: 'Beleza! [PROFILE]{"risk":"mid","horizon":"long","interests":["div"]}[/PROFILE]',
          }),
          { status: 200 }
        )
      )
    );
    const onProfileDetected = vi.fn();
    const { result } = renderHook(() =>
      usePraChat({ tone: "casual", profile: null, stocks: [], totalValue: 0, onProfileDetected })
    );
    await act(async () => {
      await result.current.send("sou moderado, longo prazo, dividendos");
    });
    expect(onProfileDetected).toHaveBeenCalledWith({
      risk: "mid",
      horizon: "long",
      interests: ["div"],
    });
    expect(result.current.messages.at(-1)?.text).not.toContain("[PROFILE]");
  });

  it("reset limpa mensagens", async () => {
    const { result } = renderHook(() =>
      usePraChat({ tone: "casual", profile: null, stocks: [], totalValue: 0 })
    );
    act(() => result.current.ensureGreeting());
    expect(result.current.messages.length).toBeGreaterThan(0);
    act(() => result.current.reset());
    expect(result.current.messages).toEqual([]);
  });
});
