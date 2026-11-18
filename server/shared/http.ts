/**
 * Minimal HTTP helpers shared by every API module: a path router, JSON
 * bodies with size limits, typed errors and NDJSON streaming.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

// Note: server code runs through Node's type stripping, so no parameter
// properties, enums or namespaces (erasable TypeScript only).
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, message: string, code = 'error') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface RequestContext {
  req: IncomingMessage;
  res: ServerResponse;
  params: Record<string, string>;
  query: URLSearchParams;
  ip: string;
}

export type Handler = (ctx: RequestContext) => Promise<unknown> | unknown;

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

/** Path router: `/conversations/:id` style patterns, first match wins. */
export class Router {
  private routes: Route[] = [];

  on(method: string, path: string, handler: Handler): this {
    const keys: string[] = [];
    const pattern = new RegExp(
      '^' + path.replace(/:([a-zA-Z]+)/g, (_, k: string) => (keys.push(k), '([^/]+)')) + '/?$',
    );
    this.routes.push({ method, pattern, keys, handler });
    return this;
  }

  get = (p: string, h: Handler) => this.on('GET', p, h);
  post = (p: string, h: Handler) => this.on('POST', p, h);
  patch = (p: string, h: Handler) => this.on('PATCH', p, h);
  put = (p: string, h: Handler) => this.on('PUT', p, h);
  delete = (p: string, h: Handler) => this.on('DELETE', p, h);

  /** Returns the handler result, or `undefined` when no route path matches. */
  match(method: string, path: string): { handler: Handler; params: Record<string, string> } | 'method' | undefined {
    let pathMatched = false;
    for (const r of this.routes) {
      const m = r.pattern.exec(path);
      if (!m) continue;
      pathMatched = true;
      if (r.method !== method) continue;
      const params: Record<string, string> = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return { handler: r.handler, params };
    }
    return pathMatched ? 'method' : undefined;
  }
}

export async function readJson<T = Record<string, unknown>>(req: IncomingMessage, limit = 64_000): Promise<T> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new ApiError(413, 'Dữ liệu gửi lên quá lớn.', 'too_large');
    chunks.push(chunk as Buffer);
  }
  if (!chunks.length) return {} as T;
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not an object');
    return value as T;
  } catch {
    throw new ApiError(400, 'Yêu cầu không hợp lệ.', 'bad_json');
  }
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

/** Starts a newline-delimited JSON stream and returns a writer. */
export function startNdjson(res: ServerResponse): (event: object) => void {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  return (event) => {
    if (!res.writableEnded) res.write(`${JSON.stringify(event)}\n`);
  };
}

export function clientIp(req: IncomingMessage): string {
  const fwd = req.headers['x-forwarded-for'];
  return (typeof fwd === 'string' ? fwd.split(',')[0]?.trim() : undefined) || req.socket.remoteAddress || 'unknown';
}

export function parseCookies(req: IncomingMessage): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

// ---------- input helpers (validate untrusted request bodies) ----------

export function str(value: unknown, field: string, opts: { max?: number; min?: number; optional?: boolean } = {}): string | undefined {
  if (value === undefined || value === null || value === '') {
    if (opts.optional) return undefined;
    throw new ApiError(400, `Thiếu trường "${field}".`, 'validation');
  }
  if (typeof value !== 'string') throw new ApiError(400, `Trường "${field}" phải là chuỗi.`, 'validation');
  const v = value.trim();
  if (opts.min && v.length < opts.min) throw new ApiError(400, `"${field}" cần ít nhất ${opts.min} ký tự.`, 'validation');
  if (opts.max && v.length > opts.max) throw new ApiError(400, `"${field}" tối đa ${opts.max} ký tự.`, 'validation');
  return v;
}

export function bool(value: unknown, field: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new ApiError(400, `Trường "${field}" phải là true/false.`, 'validation');
  return value;
}
