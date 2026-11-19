/**
 * API entry point shared by the Vite dev/preview servers and `npm start`.
 *
 *   {base}api/auth/*   accounts and sessions
 *   {base}api/ai/*     assistant (conversations, streaming, settings...)
 *
 * Cross-cutting checks live here: CSRF (same-origin + custom header on
 * writes), per-IP rate limit, JSON errors.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { createDefaultRegistry } from './ai/tools/index.ts';
import { Orchestrator } from './ai/orchestrator/orchestrator.ts';
import { aiRoutes } from './ai/routes.ts';
import { createServices, type Services } from './ai/services.ts';
import type { ToolRegistry } from './ai/tools/registry.ts';
import { type Db, openDatabase } from './shared/db.ts';
import { ApiError, clientIp, readJson, Router, sendJson, str } from './shared/http.ts';
import { RateLimiter } from './shared/rateLimit.ts';

export interface Api {
  handle(req: IncomingMessage, res: ServerResponse): Promise<boolean>;
  services: Services;
  registry: ToolRegistry;
  orchestrator: Orchestrator;
}

export interface ApiOptions {
  basePath: string;
  db?: Db;
  env?: NodeJS.ProcessEnv;
  services?: Services;
}

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function createApi(opts: ApiOptions): Api {
  const env = opts.env ?? process.env;
  const db = opts.db ?? openDatabase(env.MIXIVIVU_DB_PATH ?? join(process.cwd(), '.data', 'mixivivu.db'));
  const services = opts.services ?? createServices(db, { cookiePath: opts.basePath, env });
  const registry = createDefaultRegistry();
  const orchestrator = new Orchestrator(services, registry);
  const prefix = `${opts.basePath}api`;

  const ipLimit = new RateLimiter(Number(env.API_RATE_LIMIT_PER_MIN ?? 300), 60_000);
  const authLimit = new RateLimiter(20, 5 * 60_000);

  const auth = new Router()
    .get('/me', (ctx) => ({ user: services.auth.ensure(ctx.req, ctx.res) }))
    .post('/register', async (ctx) => {
      if (authLimit.limited(ctx.ip)) throw new ApiError(429, 'Quá nhiều lần thử. Vui lòng đợi vài phút.', 'rate_limited');
      const b = await readJson(ctx.req);
      const user = services.auth.register(ctx.req, ctx.res, str(b.username, 'username', { max: 32 })!, typeof b.password === 'string' ? b.password : '', str(b.displayName, 'displayName', { optional: true, max: 60 }));
      services.audit.record({ userId: user.id, action: 'auth.register', status: 'ok', ip: ctx.ip });
      return { user };
    })
    .post('/login', async (ctx) => {
      if (authLimit.limited(ctx.ip)) throw new ApiError(429, 'Quá nhiều lần thử. Vui lòng đợi vài phút.', 'rate_limited');
      const b = await readJson(ctx.req);
      const user = services.auth.login(ctx.req, ctx.res, str(b.username, 'username', { max: 32 })!, typeof b.password === 'string' ? b.password : '');
      services.audit.record({ userId: user.id, action: 'auth.login', status: 'ok', ip: ctx.ip });
      return { user };
    })
    .post('/logout', (ctx) => {
      services.auth.logout(ctx.req, ctx.res);
      return { ok: true };
    });

  const mounts: [string, Router][] = [
    ['/auth', auth],
    ['/ai', aiRoutes({ services, registry, orchestrator, env })],
  ];

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith(`${prefix}/`)) return false;
    const path = url.pathname.slice(prefix.length);
    const method = req.method ?? 'GET';
    const ip = clientIp(req);
    try {
      if (ipLimit.limited(ip)) throw new ApiError(429, 'Quá nhiều yêu cầu.', 'rate_limited');
      if (WRITE_METHODS.has(method)) checkCsrf(req);
      for (const [mount, router] of mounts) {
        if (!path.startsWith(`${mount}/`) && path !== mount) continue;
        const match = router.match(method, path.slice(mount.length) || '/');
        if (match === 'method') throw new ApiError(405, 'Method not allowed', 'method');
        if (!match) break;
        const result = await match.handler({ req, res, params: match.params, query: url.searchParams, ip });
        if (!res.headersSent && !res.writableEnded) sendJson(res, 200, result ?? { ok: true });
        return true;
      }
      throw new ApiError(404, 'Không tìm thấy API.', 'not_found');
    } catch (err) {
      if (res.headersSent) {
        res.end();
        return true;
      }
      if (err instanceof ApiError) sendJson(res, err.status, { error: err.message, code: err.code });
      else {
        console.error('[api]', err);
        sendJson(res, 500, { error: 'Lỗi máy chủ.', code: 'internal' });
      }
      return true;
    }
  }

  return { handle, services, registry, orchestrator };
}

/**
 * Writes must come from our own pages: the custom header cannot be sent
 * cross-site without a CORS preflight (which we never allow), and a
 * present Origin must match the Host.
 */
function checkCsrf(req: IncomingMessage) {
  if (req.headers['x-requested-with'] !== 'mixivivu') throw new ApiError(403, 'Yêu cầu bị từ chối (CSRF).', 'csrf');
  const origin = req.headers.origin;
  if (origin && origin !== 'null') {
    let host: string;
    try {
      host = new URL(origin).host;
    } catch {
      throw new ApiError(403, 'Yêu cầu bị từ chối (origin).', 'csrf');
    }
    const expected = (req.headers['x-forwarded-host'] as string | undefined) ?? req.headers.host;
    if (host !== expected) throw new ApiError(403, 'Yêu cầu bị từ chối (origin).', 'csrf');
  }
}
