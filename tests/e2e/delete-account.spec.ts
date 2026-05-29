import { test, expect } from "@playwright/test";

/**
 * Fluxo LGPD (Art. 18) — "Excluir minhas informações".
 *
 * Sem Supabase configurado (ambiente de teste), o erase e 100% local: apaga
 * todas as chaves `praxia-*` / `stocks-ai*` do localStorage e redireciona pro
 * login. Este teste garante o direito de exclusao no dispositivo.
 *
 * Pre-condicoes: perfil salvo (pula onboarding) + carteira pre-populada, pra
 * provar que os dados realmente existiam antes e somem depois.
 */

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    localStorage.setItem(
      "praxia-investor-profile",
      JSON.stringify({ risk: "mid", horizon: "long", interests: ["div"], completedAt: new Date().toISOString() })
    );
    localStorage.setItem("stocks-ai-portfolio", JSON.stringify([{ ticker: "PETR4", quantity: 10, cost: 30 }]));
    localStorage.setItem("praxia-transactions", JSON.stringify([{ id: "x", ticker: "PETR4", type: "buy" }]));
    localStorage.setItem("stocks-ai-analysis:PETR4", JSON.stringify({ cached: true }));
  });
});

async function login(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.locator('input[name="username"]').fill("admin");
  await page.locator('input[name="password"]').fill("1234");
  await page.getByRole("button", { name: /Entrar/i }).click();
  await expect(page.getByLabel(/Início/i)).toBeVisible({ timeout: 8000 });
}

test("usuario consegue apagar todos os dados do dispositivo (LGPD)", async ({ page }) => {
  await login(page);

  // Vai pro Perfil e abre a tela de exclusao.
  await page.getByLabel("Perfil").click();
  await page.getByText("Excluir minhas informações").click();

  // Tela LGPD ART. 18 visivel.
  await expect(page.getByText("LGPD ART. 18")).toBeVisible({ timeout: 8000 });

  // Botao desabilitado ate confirmar.
  const eraseBtn = page.getByRole("button", { name: /Excluir tudo do meu dispositivo/i });
  await expect(eraseBtn).toBeDisabled();

  // Confirma e executa.
  await page.getByLabel("Confirmar exclusão").check();
  await expect(eraseBtn).toBeEnabled();
  await eraseBtn.click();

  // Apos o erase (350ms de delay + onLogout), volta pro login.
  await expect(page.locator('input[name="username"]')).toBeVisible({ timeout: 8000 });

  // localStorage limpo das chaves do Praxia.
  const remaining = await page.evaluate(() => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("praxia-") || k.startsWith("stocks-ai"))) keys.push(k);
    }
    return keys;
  });
  expect(remaining).toEqual([]);
});

test("botao de excluir fica desabilitado sem confirmacao", async ({ page }) => {
  await login(page);
  await page.getByLabel("Perfil").click();
  await page.getByText("Excluir minhas informações").click();

  const eraseBtn = page.getByRole("button", { name: /Excluir tudo do meu dispositivo/i });
  await expect(eraseBtn).toBeDisabled();

  // Voltar nao apaga nada.
  await page.getByLabel("Voltar").click();
  await expect(page.getByText(/Legal e privacidade/i)).toBeVisible({ timeout: 8000 });
});
