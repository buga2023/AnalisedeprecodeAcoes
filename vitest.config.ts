import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "api/**/*.{test,spec}.ts",
      "tests/integration/**/*.{test,spec}.{ts,tsx}",
      "tests/unit/**/*.{test,spec}.{ts,tsx}",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.{ts,tsx}", "api/*.ts"],
      exclude: [
        "src/main.tsx",
        "src/vite-env.d.ts",
        "src/test/**",
        "src/**/*.d.ts",
        "src/types/**",
        "api/dist/**",
        "api/test-helpers.ts",
        "**/*.config.*",
        "**/node_modules/**",
        // UI grande / screens / modais — testes E2E/manuais ficam fora do
        // alvo de cobertura (lógica de negócio fica em hooks/ e lib/).
        "src/App.tsx",
        "src/components/LoginScreen.tsx",
        "src/components/praxia/screens/**",
        "src/components/praxia/Charts.tsx",
        "src/components/praxia/ChatSheet.tsx",
        "src/components/praxia/Citations.tsx",
        "src/components/praxia/CompareTable.tsx",
        "src/components/praxia/MacroQuotesStrip.tsx",
        "src/components/praxia/NewsFeedCard.tsx",
        "src/components/praxia/PortfolioInsightsContent.tsx",
        "src/components/praxia/PortfolioInsightsModal.tsx",
        "src/components/praxia/OptimizeDividendsModal.tsx",
        "src/components/praxia/PortfolioScoreHero.tsx",
        "src/components/praxia/QuickWatch.tsx",
        "src/components/praxia/StockAIAnalysisSection.tsx",
        "src/components/praxia/StockNewsSection.tsx",
        "src/components/praxia/StockReportsSection.tsx",
        "src/components/praxia/WeeklyPerformanceCard.tsx",
        "src/components/praxia/AlertSheet.tsx",
        "src/components/praxia/PraxiaLogo.tsx",
        "src/components/praxia/PraxiaBackground.tsx",
        // Lib só consumido por NewsFeedCard (que está fora)
        "src/lib/aiNewsFeed.ts",
      ],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
  },
});
