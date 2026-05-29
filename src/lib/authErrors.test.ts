import { describe, it, expect } from "vitest";
import { humanizeAuthError } from "./authErrors";

describe("humanizeAuthError", () => {
  it("traduz credenciais invalidas", () => {
    expect(humanizeAuthError("Invalid login credentials")).toBe(
      "Email ou senha incorretos."
    );
  });

  it("traduz email ja registrado", () => {
    expect(humanizeAuthError("User already registered")).toBe(
      "Este email ja tem uma conta. Use “Entrar”."
    );
  });

  it("traduz email nao confirmado", () => {
    expect(humanizeAuthError("Email not confirmed")).toBe(
      "Confirme seu email antes de entrar."
    );
  });

  it("traduz senha curta (qualquer numero) para o minimo do app", () => {
    expect(humanizeAuthError("Password should be at least 6 characters")).toBe(
      "A senha precisa ter pelo menos 8 caracteres."
    );
  });

  it("traduz formato de email invalido", () => {
    expect(
      humanizeAuthError("Unable to validate email address: invalid format")
    ).toBe("Email invalido.");
  });

  it("traduz rate limit", () => {
    expect(
      humanizeAuthError("For security purposes, you can only request this after 47 seconds")
    ).toBe("Muitas tentativas. Aguarde alguns segundos e tente de novo.");
  });

  it("traduz falha de rede", () => {
    expect(humanizeAuthError("Failed to fetch")).toBe(
      "Sem conexao com o servidor. Verifique sua internet e tente de novo."
    );
  });

  it("repassa mensagem desconhecida sem alterar", () => {
    expect(humanizeAuthError("Algo muito especifico do servidor")).toBe(
      "Algo muito especifico do servidor"
    );
  });

  it("usa fallback generico quando vazio", () => {
    expect(humanizeAuthError("")).toBe("Nao foi possivel concluir. Tente de novo.");
  });
});
