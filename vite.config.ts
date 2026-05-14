import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { viteApiPlugin } from "./vite-api-plugin";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Expose .env to the Vite-served Node handlers (so /api/ai can read
  // GROQ_API_KEY, BRAPI_TOKEN, etc. during `npm run dev`).
  const env = loadEnv(mode, process.cwd(), "");
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }

  return {
    plugins: [react(), tailwindcss(), viteApiPlugin()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
