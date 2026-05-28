import { defineConfig, devices } from "@playwright/test";

/**
 * Config Playwright para fluxos E2E do Praxia.
 *
 * Pré-requisito: chromium instalado via `npx playwright install chromium`.
 * Se a rede bloqueia o download (Kaspersky/firewall), exporte:
 *   NODE_EXTRA_CA_CERTS=<cert do Kaspersky>
 *   ou PLAYWRIGHT_DOWNLOAD_HOST=<mirror>
 *
 * O webServer abaixo sobe automaticamente o Vite dev server antes dos testes;
 * em CI use baseURL=http://localhost:5173 (default).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
