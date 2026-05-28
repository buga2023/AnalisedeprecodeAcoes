import { test, expect } from "@playwright/test";

/**
 * Fluxo de boas-vindas sem perfil salvo:
 *   ScreenOnboarding (Começar) → ScreenOnboardingB (Criar conta) → App home
 */

test.beforeEach(async ({ context }) => {
  // Sem profile e sem stocks — força o caminho de onboarding.
  await context.addInitScript(() => {
    localStorage.clear();
  });
});

test("Onboarding A → B → App via 'Começar' + 'Criar conta'", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Começar$/i }).click();
  await page.getByRole("button", { name: /Criar conta/i }).click();
  // Chegou no app — BottomNav presente
  await expect(page.getByLabel(/Início/i)).toBeVisible({ timeout: 8000 });
});

test("Onboarding A → Login via link 'Entrar' (caminho alternativo)", async ({ page }) => {
  await page.goto("/");
  // Onboarding A tem um link Entrar no rodapé
  await page.getByRole("button", { name: /^Entrar$/i }).first().click();
  // Espera-se ver o formulário de login (input usuário)
  await expect(page.locator('input[name="username"]')).toBeVisible();
});
