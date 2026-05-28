import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Aplica headers de CORS com allowlist. Origens permitidas vêm de
 * `process.env.PRAXIA_ALLOWED_ORIGINS` (separadas por vírgula) — falta dela,
 * só localhost / 127.0.0.1 são aceitos (modo dev).
 *
 * Retorna `true` se a requisição é OPTIONS (preflight) e já foi respondida —
 * o handler deve sair imediatamente nesse caso.
 *
 * Arquivos com prefixo `_` em `api/` são tratados como utilitários e
 * ignorados pelo roteamento do `vite-api-plugin.ts` e do Vercel.
 */

const DEFAULT_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
];

function allowedOrigins(): string[] {
  const env = process.env.PRAXIA_ALLOWED_ORIGINS;
  if (!env) return DEFAULT_DEV_ORIGINS;
  return env
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function applyCors(
  request: VercelRequest,
  response: VercelResponse,
  methods: string = "GET, POST, OPTIONS"
): boolean {
  const origin = (request.headers.origin as string | undefined) ?? "";
  const allowed = allowedOrigins();
  const isAllowed = allowed.includes(origin);

  // Só ecoa a origem quando ela está na allowlist. Sem origin (ex.: chamada
  // server-to-server ou curl sem -H), seguimos sem header — o browser bloqueia
  // se for chamada cross-origin não-listada, mas curl/SSR funcionam.
  if (isAllowed) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Methods", methods);
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
  response.setHeader("Content-Type", "application/json");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return true;
  }
  return false;
}
