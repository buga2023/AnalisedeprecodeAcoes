import { test, expect } from "@playwright/test";

/**
 * Fluxo de login (LoginScreen).
 *
 * Pré-condição pra cair no login: existir `praxia-investor-profile` em
 * localStorage. Setamos via initScript antes de cada teste para evitar o
 * detour pelas telas de onboarding.
 */

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    localStorage.setItem(
      "praxia-investor-profile",
      JSON.stringify({
        risk: "mid",
        horizon: "long",
        interests: ["div"],
        completedAt: new Date().toISOString(),
      })
    );
  });
});

test("login válido (admin/1234) avança para o app", async ({ page }) => {
  await page.goto("/");
  // Inputs com autoComplete=username/current-password — uso pelo name
  await page.locator('input[name="username"]').fill("admin");
  await page.locator('input[name="password"]').fill("1234");
  await page.getByRole("button", { name: /Entrar/i }).click();
  // Após login, a home deve carregar com BottomNav (ícone "Início")
  await expect(page.getByLabel(/Início/i)).toBeVisible({ timeout: 8000 });
});

test("login inválido mostra mensagem de erro", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[name="username"]').fill("usuario_errado");
  await page.locator('input[name="password"]').fill("senha-errada");
  await page.getByRole("button", { name: /Entrar/i }).click();
  await expect(page.getByText(/Usuário ou senha incorretos/i)).toBeVisible();
});

test("botão Entrar desabilitado enquanto formulário está incompleto", async ({ page }) => {
  await page.goto("/");
  const btn = page.getByRole("button", { name: /Entrar/i });
  await expect(btn).toBeDisabled();
  await page.locator('input[name="username"]').fill("admin");
  await expect(btn).toBeDisabled();
  await page.locator('input[name="password"]').fill("1234");
  await expect(btn).toBeEnabled();
});

test("toggle Mostrar/Ocultar senha alterna o type do input", async ({ page }) => {
  await page.goto("/");
  const pwd = page.locator('input[name="password"]');
  await expect(pwd).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: /Mostrar/i }).click();
  await expect(pwd).toHaveAttribute("type", "text");
});
