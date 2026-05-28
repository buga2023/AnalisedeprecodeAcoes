import { test, expect } from "@playwright/test";

/**
 * Fluxo de portfolio na home — todas as chamadas a /api/* são interceptadas
 * com payloads determinísticos para isolar a UI de Yahoo Finance / IA reais.
 */

test.beforeEach(async ({ context, page }) => {
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
    // Pré-popula o portfolio com 1 stock para a Home já ter conteúdo a renderizar.
    localStorage.setItem(
      "stocks-ai-portfolio",
      JSON.stringify([
        {
          ticker: "PETR4",
          price: 35,
          cost: 30,
          quantity: 50,
          lpa: 2,
          vpa: 10,
          roe: 0.18,
          debtToEbitda: 1.2,
          change: 0.5,
          changePercent: 1.45,
          lastUpdated: new Date().toISOString(),
          score: 72,
          scoreBreakdown: { priceScore: 25, profitabilityScore: 15, healthScore: 20, dividendScore: 10, valuationScore: 2 },
          isFavorite: false,
          pl: 5,
          pvp: 1.2,
          dividendYield: 0.08,
          evEbitda: 5,
          netMargin: 0.15,
          ebitdaMargin: 0.25,
          grahamValue: 21,
          marginOfSafety: -66,
          name: "Petrobras",
          market: "B3",
          sector: "Energia",
        },
      ])
    );
  });

  // Intercepta /api/brapi (poll de cotações)
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
      body: JSON.stringify({
        USDBRL: { bid: "5.10", pctChange: "0.20" },
        EURBRL: { bid: "5.50", pctChange: "0.10" },
        BRLUSD: { bid: "0.19", pctChange: "-0.20" },
        BTCBRL: { bid: "300000", pctChange: "1.5" },
        ETHBRL: { bid: "20000", pctChange: "0.5" },
      }),
    });
  });

  await page.route(/\/api\/world-news.*/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        generatedAt: new Date().toISOString(),
        refreshIntervalMs: 7_200_000,
        source: "mock",
        resumoParaPrompt: "",
        topics: [],
      }),
    });
  });

  await page.route(/\/api\/fundamentals.*/, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
});

test("Home mostra o ticker PETR4 do portfolio pré-populado", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[name="username"]').fill("admin");
  await page.locator('input[name="password"]').fill("1234");
  await page.getByRole("button", { name: /Entrar/i }).click();
  await expect(page.getByLabel(/Início/i)).toBeVisible({ timeout: 8000 });
  // PETR4 deve aparecer em algum lugar da home (HoldingRow)
  await expect(page.getByText("PETR4").first()).toBeVisible({ timeout: 8000 });
});

test("Bottom nav permite trocar para Atividade", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[name="username"]').fill("admin");
  await page.locator('input[name="password"]').fill("1234");
  await page.getByRole("button", { name: /Entrar/i }).click();
  await expect(page.getByLabel(/Início/i)).toBeVisible({ timeout: 8000 });
  await page.getByLabel(/Atividade/i).click();
  // Header da tela de atividade
  await expect(page.locator('[aria-current="page"][aria-label*="Atividade"]')).toBeVisible();
});

test("Floating button da Pra abre o chat", async ({ page, context }) => {
  // Mock leve do /api/ai para o caso do chat enviar mensagem
  await context.route(/\/api\/ai/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ content: "Olá! Sou a Pra." }),
    });
  });

  await page.goto("/");
  await page.locator('input[name="username"]').fill("admin");
  await page.locator('input[name="password"]').fill("1234");
  await page.getByRole("button", { name: /Entrar/i }).click();
  await expect(page.getByLabel(/Início/i)).toBeVisible({ timeout: 8000 });

  await page.getByLabel(/Conversar com a Pra/i).click();
  // Após o clique, espera-se alguma superfície de chat (campo de input).
  await expect(page.locator("textarea, input[type='text']").first()).toBeVisible({ timeout: 8000 });
});
