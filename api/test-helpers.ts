import type { VercelRequest, VercelResponse } from "@vercel/node";

export interface MockResponse {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  ended: boolean;
}

export function makeReq(opts: {
  method?: string;
  query?: Record<string, string | string[]>;
  body?: unknown;
  headers?: Record<string, string>;
} = {}): VercelRequest {
  return {
    method: opts.method ?? "GET",
    query: opts.query ?? {},
    body: opts.body ?? {},
    headers: opts.headers ?? {},
  } as unknown as VercelRequest;
}

export function makeRes(): VercelResponse & { mock: MockResponse } {
  const mock: MockResponse = { statusCode: 200, body: undefined, headers: {}, ended: false };
  const res = {
    mock,
    setHeader(name: string, value: string) {
      mock.headers[name] = value;
      return this;
    },
    status(code: number) {
      mock.statusCode = code;
      return this;
    },
    json(body: unknown) {
      mock.body = body;
      mock.ended = true;
      return this;
    },
    end() {
      mock.ended = true;
      return this;
    },
  };
  return res as unknown as VercelResponse & { mock: MockResponse };
}
