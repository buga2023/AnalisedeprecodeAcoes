import type { VercelRequest } from "@vercel/node";

/**
 * Rate limit em memória por IP. Suficiente pra MVP em Vercel — cada região
 * tem seu próprio contador, então o limite real é por região × instância.
 * Pra limite global, trocar por Vercel KV / Upstash Redis.
 */

interface Bucket {
  count: number;
  resetAt: number;
  /** Carimbos de tempo das últimas N requisições — pra burst control. */
  recent: number[];
}

const buckets = new Map<string, Bucket>();

// Limpa buckets expirados periodicamente — sem isso o Map cresce indefinidamente.
function gc(now: number) {
  if (buckets.size < 1000) return;
  for (const [k, v] of buckets) {
    if (now >= v.resetAt + 60_000) buckets.delete(k);
  }
}

function clientIp(request: VercelRequest): string {
  const fwd = request.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) {
    return fwd.split(",")[0].trim();
  }
  if (Array.isArray(fwd) && fwd[0]) return fwd[0];
  const real = request.headers["x-real-ip"];
  if (typeof real === "string") return real;
  // Fallback dev (Vite). socket.remoteAddress pode vir como ::ffff:127.0.0.1
  const sock = (request.socket?.remoteAddress as string | undefined) ?? "unknown";
  return sock.replace(/^::ffff:/, "");
}

export interface RateLimitOptions {
  /** Janela do limite normal (ex.: 60_000 ms). */
  windowMs: number;
  /** Máximo de requests dentro de windowMs. */
  max: number;
  /** Burst control: máximo de requests em burstWindowMs (default 5s, 3 req). */
  burstMax?: number;
  burstWindowMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
  /** Motivo do bloqueio (pro log). */
  reason?: "window" | "burst";
}

export function checkRateLimit(
  request: VercelRequest,
  opts: RateLimitOptions
): RateLimitResult {
  const ip = clientIp(request);
  const now = Date.now();
  const burstWindow = opts.burstWindowMs ?? 5_000;
  const burstMax = opts.burstMax ?? 3;

  gc(now);

  const bucket = buckets.get(ip);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + opts.windowMs, recent: [now] });
    return { allowed: true, retryAfterSec: 0 };
  }

  // Burst control: olha só as N últimas reqs dentro do burstWindow.
  const recentInBurst = bucket.recent.filter((t) => now - t < burstWindow);
  if (recentInBurst.length >= burstMax) {
    const oldest = recentInBurst[0];
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((oldest + burstWindow - now) / 1000)),
      reason: "burst",
    };
  }

  if (bucket.count >= opts.max) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      reason: "window",
    };
  }

  bucket.count += 1;
  bucket.recent.push(now);
  // Mantém só os últimos burstMax+1 timestamps — o resto é descartado.
  if (bucket.recent.length > burstMax + 2) {
    bucket.recent = bucket.recent.slice(-burstMax - 2);
  }
  return { allowed: true, retryAfterSec: 0 };
}
