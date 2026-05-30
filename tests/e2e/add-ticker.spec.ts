import { test, expect } from "@playwright/test";

/**
 * Fluxo "buscar ticker -> adicionar -> ver na carteira com score".
 *
 * Carteira comeca VAZIA (so o perfil pre-salvo pula o onboarding). O usuario
 * busca PETR4 no Mercado, adiciona, e o ticker passa a aparecer na Home — o
 * que so acontece depois de useStockQuotes.addStock computar o Stock + score.
 * Todas as chamadas /api/* sao mockadas com payload deterministico.
 */

test.beforeEach(async ({ context, page }) => {
  await context.addInitScript(() => {
    localStorage.setItem(
      "praxia-investor-profile",
      JSON.stringify({ risk: "mid", horizon: "long", interests: ["div"], completedAt: new Date().toISOString() })
    );
    // Carteira vazia de proposito.
    localStorage.setItem("stocks-ai-portfolio", JSON.stringify([]));
  });

  // /api/brapi — usado tanto na busca (fetchStockQuote) quanto no addStock.
  await page.route(/\/api\/brapi.*/, async (route) => {
    const url = route.request().url();
    if (url.includes("/quote/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [
            {
              symbol: "PETR4",
              shortName: "Petrobras",
              longName: "Petroleo Brasileiro SA",
              currency: "BRL",
              regularMarketPrice: 36,
              regularMarketChange: 1,
              regularMarketChangePercent: 2.85,
              regularMarketTime: new Date().toISOString(),
              earningsPerShare: 2.5,
              priceEarnings: 5,
              bookValue: 11,
              dividendYield: 0.08,
            },
          ],
          requestedAt: new Date().toISOString(),
          took: "10ms",
        }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.route(/\/api\/market.*/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ USDBRL: { bid: "5.10", pctChange: "0.20" } }),
    });
  });
  await page.route(/\/api\/world-news.*/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ generatedAt: new Date().toISOString(), refreshIntervalMs: 7_200_000, source: "mock", resumoParaPrompt: "", topics: [] }),
    });
  });
  await page.route(/\/api\/fundamentals.*/, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.route(/\/api\/ai.*/, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ content: "{}" }) });
  });
});

async function login(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.locator('input[name="username"]').fill("admin");
  await page.locator('input[name="password"]').fill("1234");
  await page.getByRole("button", { name: /Entrar/i }).click();
  await expect(page.getByLabel(/Início/i)).toBeVisible({ timeout: 8000 });
}

test("buscar PETR4 no Mercado, adicionar e ver na Home", async ({ page }) => {
  await login(page);

  // Vai pro Mercado.
  await page.getByLabel("Mercado").click();

  // Busca PETR4.
  await page.locator('input[name="search"]').fill("PETR4");
  await page.getByRole("button", { name: /^Buscar$/i }).click();

  // Card de resultado aparece com o botao Adicionar.
  const addBtn = page.getByRole("button", { name: /^Adicionar$/i });
  await expect(addBtn).toBeVisible({ timeout: 8000 });
  await addBtn.click();

  // Volta pra Home — o ticker recem-adicionado deve aparecer.
  await page.getByLabel("Início").click();
  await expect(page.getByText("PETR4").first()).toBeVisible({ timeout: 8000 });
});
