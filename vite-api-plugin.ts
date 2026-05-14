import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { URL } from "node:url";

/**
 * Mounts the Vercel-style handlers in `api/*.ts` as middleware on the Vite dev
 * server so the SPA can call `/api/brapi`, `/api/ai`, … without running
 * `vercel dev` in parallel. In production these continue to be deployed as
 * normal serverless functions.
 */
export function viteApiPlugin(): Plugin {
  const apiDir = resolve(process.cwd(), "api");

  return {
    name: "vite-api-plugin",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith("/api/")) return next();

        const parsed = new URL(req.url, "http://localhost");
        const route = parsed.pathname.replace(/^\/api\//, "").replace(/\/+$/, "");
        if (!route || route.includes("..")) return next();

        const tsPath = resolve(apiDir, `${route}.ts`);
        if (!existsSync(tsPath)) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: `API route '/api/${route}' not found` }));
          return;
        }

        try {
          const mod = await server.ssrLoadModule(tsPath);
          const handler = (mod.default ?? mod.handler) as
            | ((req: VercelLikeRequest, res: VercelLikeResponse) => Promise<void> | void)
            | undefined;
          if (!handler) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: `Handler not found in ${route}.ts` }));
            return;
          }

          const query = Object.fromEntries(parsed.searchParams.entries());
          const body = await readJsonBody(req);

          const vercelReq = Object.assign(req, { query, body }) as VercelLikeRequest;
          const vercelRes = wrapResponse(res);

          await handler(vercelReq, vercelRes);
        } catch (err) {
          console.error(`[vite-api-plugin] error in /api/${route}:`, err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                error: err instanceof Error ? err.message : "internal error",
              })
            );
          }
        }
      });
    },
  };
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return undefined;
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolvePromise(undefined);
      try {
        resolvePromise(JSON.parse(raw));
      } catch {
        resolvePromise(raw);
      }
    });
    req.on("error", reject);
  });
}

type VercelLikeRequest = IncomingMessage & {
  query: Record<string, string>;
  body: unknown;
};

type VercelLikeResponse = ServerResponse & {
  status(code: number): VercelLikeResponse;
  json(body: unknown): VercelLikeResponse;
};

function wrapResponse(res: ServerResponse): VercelLikeResponse {
  const wrapped = res as VercelLikeResponse;
  wrapped.status = (code: number) => {
    wrapped.statusCode = code;
    return wrapped;
  };
  wrapped.json = (body: unknown) => {
    if (!wrapped.getHeader("Content-Type")) {
      wrapped.setHeader("Content-Type", "application/json");
    }
    wrapped.end(JSON.stringify(body));
    return wrapped;
  };
  return wrapped;
}
