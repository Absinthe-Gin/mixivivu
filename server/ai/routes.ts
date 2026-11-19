/**
 * HTTP API of the assistant (mounted at {base}api/ai/). Every handler
 * resolves the user from the session cookie; ids in paths are always
 * checked against that user by the services.
 */
import type { AuthUser } from '../auth/authService.ts';
import { ApiError, type RequestContext, Router, bool, readJson, startNdjson, str } from '../shared/http.ts';
import { RateLimiter } from '../shared/rateLimit.ts';
import { historyView } from './conversations/historyView.ts';
import type { AgentEvent } from './orchestrator/events.ts';
import { MAX_USER_MESSAGE_CHARS, type Orchestrator } from './orchestrator/orchestrator.ts';
import type { ProviderConfigInput } from './providers/providerService.ts';
import { MAX_UPLOAD_BYTES } from './rag/parsers.ts';
import type { Services } from './services.ts';
import type { ToolRegistry } from './tools/registry.ts';
import type { MemoryKind } from './memory/memoryService.ts';

export interface AiRouteDeps {
  services: Services;
  registry: ToolRegistry;
  orchestrator: Orchestrator;
  env?: NodeJS.ProcessEnv;
}

export function aiRoutes({ services, registry, orchestrator, env = process.env }: AiRouteDeps): Router {
  const r = new Router();
  const messageLimit = new RateLimiter(Number(env.AI_RATE_LIMIT_MESSAGES ?? 30), 5 * 60_000);
  const uploadLimit = new RateLimiter(20, 60 * 60_000);
  const user = (ctx: RequestContext): AuthUser => services.auth.ensure(ctx.req, ctx.res);
  const admin = (ctx: RequestContext): AuthUser => {
    const u = services.auth.current(ctx.req);
    if (!u || u.role !== 'admin') throw new ApiError(403, 'Chỉ quản trị viên được thay đổi cấu hình AI.', 'forbidden');
    return u;
  };

  /** Streams agent events; aborts the run when the client disconnects or presses stop. */
  const stream = async (ctx: RequestContext, run: (emit: (e: AgentEvent) => void, signal: AbortSignal) => Promise<void>) => {
    const abort = new AbortController();
    ctx.res.on('close', () => abort.abort());
    const send = startNdjson(ctx.res);
    try {
      await run(send, abort.signal);
    } catch (err) {
      if (!abort.signal.aborted) {
        const message = err instanceof ApiError ? err.message : 'Trợ lý gặp sự cố. Vui lòng thử lại.';
        if (!(err instanceof ApiError)) console.error('[ai] turn failed', err);
        send({ type: 'error', message, code: err instanceof ApiError ? err.code : 'internal' });
      }
    } finally {
      ctx.res.end();
    }
  };

  // ---------- conversations ----------

  r.get('/conversations', (ctx) => {
    const u = user(ctx);
    return { conversations: services.conversations.list(u.id, { q: ctx.query.get('q') ?? undefined, archived: ctx.query.get('archived') === '1' }) };
  });

  r.post('/conversations', async (ctx) => {
    const u = user(ctx);
    const body = await readJson(ctx.req);
    return { conversation: services.conversations.create(u.id, str(body.title, 'title', { optional: true, max: 120 })) };
  });

  r.get('/conversations/:id', (ctx) => {
    const u = user(ctx);
    const conversation = services.conversations.get(u.id, ctx.params.id);
    return { conversation, messages: historyView(services, registry, u.id, conversation.id) };
  });

  r.patch('/conversations/:id', async (ctx) => {
    const u = user(ctx);
    const body = await readJson(ctx.req);
    return {
      conversation: services.conversations.update(u.id, ctx.params.id, {
        title: str(body.title, 'title', { optional: true, max: 120 }),
        pinned: bool(body.pinned, 'pinned'),
        archived: bool(body.archived, 'archived'),
      }),
    };
  });

  r.delete('/conversations/:id', (ctx) => {
    const u = user(ctx);
    services.conversations.remove(u.id, ctx.params.id);
    return { ok: true };
  });

  r.post('/conversations/:id/clear-context', (ctx) => {
    const u = user(ctx);
    return { conversation: services.conversations.clearContext(u.id, ctx.params.id) };
  });

  r.post('/conversations/:id/messages', async (ctx) => {
    const u = user(ctx);
    if (messageLimit.limited(u.id) || messageLimit.limited(`ip:${ctx.ip}`)) throw new ApiError(429, 'Bạn gửi quá nhiều tin nhắn. Vui lòng thử lại sau ít phút.', 'rate_limited');
    const body = await readJson(ctx.req);
    const content = str(body.content, 'content', { max: MAX_USER_MESSAGE_CHARS });
    const attachmentIds = Array.isArray(body.attachments) ? body.attachments.filter((x): x is string => typeof x === 'string') : [];
    const app = body.appContext as { path?: unknown; title?: unknown } | undefined;
    const appContext = app && typeof app === 'object' ? { path: str(app.path, 'appContext.path', { optional: true, max: 300 }), title: str(app.title, 'appContext.title', { optional: true, max: 200 }) } : undefined;
    // Validate ownership before the stream starts so errors become proper HTTP statuses.
    services.conversations.get(u.id, ctx.params.id);
    await stream(ctx, (emit, signal) =>
      orchestrator.runTurn({ user: u, conversationId: ctx.params.id, content: content!, clientMessageId: str(body.clientMessageId, 'clientMessageId', { optional: true, max: 64 }), attachmentIds, appContext, signal, emit }),
    );
  });

  r.post('/confirmations/:id', async (ctx) => {
    const u = user(ctx);
    const body = await readJson(ctx.req);
    const decision = body.decision;
    if (decision !== 'confirm' && decision !== 'cancel') throw new ApiError(400, 'decision phải là "confirm" hoặc "cancel".', 'validation');
    const c = services.confirmations.get(u.id, ctx.params.id);
    if (c.status !== 'pending') throw new ApiError(409, 'Thao tác này đã được xử lý.', 'already_decided');
    await stream(ctx, (emit, signal) => orchestrator.decide({ user: u, confirmationId: c.id, decision, signal, emit }));
  });

  // ---------- settings, tools, providers ----------

  r.get('/settings', (ctx) => {
    const u = user(ctx);
    return { settings: services.settings.get(u.id), user: u };
  });

  r.put('/settings', async (ctx) => {
    const u = user(ctx);
    const body = await readJson(ctx.req);
    const settings = services.settings.update(u.id, body);
    services.audit.record({ userId: u.id, action: 'settings.update', status: 'ok', details: { keys: Object.keys(body) }, ip: ctx.ip });
    return { settings };
  });

  r.get('/tools', (ctx) => {
    const u = user(ctx);
    return { tools: registry.describe(services.settings.get(u.id), services) };
  });

  r.get('/providers', (ctx) => {
    const u = user(ctx);
    const isAdmin = u.role === 'admin';
    const list = services.providers.listPublic(isAdmin);
    // Non-admins only see what they need to pick a model.
    return { providers: isAdmin ? list : list.map((p) => ({ id: p.id, name: p.name, type: p.type, model: p.model, models: p.models, isDefault: p.isDefault })), canManage: isAdmin };
  });

  const providerInput = (b: Record<string, unknown>): ProviderConfigInput => ({
    name: str(b.name, 'name', { optional: true, max: 60 }),
    type: b.type as ProviderConfigInput['type'],
    baseUrl: b.baseUrl === null ? null : str(b.baseUrl, 'baseUrl', { optional: true, max: 300 }),
    model: str(b.model, 'model', { optional: true, max: 120 }),
    models: Array.isArray(b.models) ? b.models.filter((m): m is string => typeof m === 'string').slice(0, 30) : undefined,
    apiKey: b.apiKey === null ? null : typeof b.apiKey === 'string' ? b.apiKey : undefined,
    temperature: b.temperature === null ? null : typeof b.temperature === 'number' ? b.temperature : undefined,
    maxTokens: typeof b.maxTokens === 'number' ? b.maxTokens : undefined,
    contextWindow: typeof b.contextWindow === 'number' ? b.contextWindow : undefined,
    timeoutMs: typeof b.timeoutMs === 'number' ? b.timeoutMs : undefined,
    enabled: bool(b.enabled, 'enabled'),
    isDefault: bool(b.isDefault, 'isDefault'),
  });

  r.post('/providers', async (ctx) => {
    const a = admin(ctx);
    const created = services.providers.create(providerInput(await readJson(ctx.req)));
    services.audit.record({ userId: a.id, action: 'provider.create', target: created.name, status: 'ok', ip: ctx.ip });
    return { provider: created };
  });

  r.patch('/providers/:id', async (ctx) => {
    const a = admin(ctx);
    const updated = services.providers.update(ctx.params.id, providerInput(await readJson(ctx.req)));
    services.audit.record({ userId: a.id, action: 'provider.update', target: updated.name, status: 'ok', ip: ctx.ip });
    return { provider: updated };
  });

  r.delete('/providers/:id', (ctx) => {
    const a = admin(ctx);
    services.providers.remove(ctx.params.id);
    services.audit.record({ userId: a.id, action: 'provider.delete', target: ctx.params.id, status: 'ok', ip: ctx.ip });
    return { ok: true };
  });

  r.post('/providers/:id/validate', async (ctx) => {
    admin(ctx);
    const config = services.providers.getConfig(ctx.params.id);
    if (!config) throw new ApiError(404, 'Không tìm thấy provider.', 'not_found');
    const provider = services.providers.instance(config);
    const result = await provider.validateConfiguration();
    let models: { id: string; supportsTools?: boolean }[] = [];
    if (result.ok) models = await provider.getAvailableModels().catch(() => []);
    return { result, models };
  });

  // ---------- memories ----------

  r.get('/memories', (ctx) => {
    const u = user(ctx);
    return { memories: services.memory.list(u.id) };
  });

  r.post('/memories', async (ctx) => {
    const u = user(ctx);
    const b = await readJson(ctx.req);
    const memory = services.memory.add(u.id, { kind: b.kind as MemoryKind, content: str(b.content, 'content', { max: 500 })!, source: 'settings' });
    services.audit.record({ userId: u.id, action: 'memory.create', target: memory.content, status: 'ok', ip: ctx.ip });
    return { memory };
  });

  r.patch('/memories/:id', async (ctx) => {
    const u = user(ctx);
    const b = await readJson(ctx.req);
    const memory = services.memory.update(u.id, ctx.params.id, { content: str(b.content, 'content', { optional: true, max: 500 }), kind: b.kind as MemoryKind | undefined });
    services.audit.record({ userId: u.id, action: 'memory.update', target: memory.content, status: 'ok', ip: ctx.ip });
    return { memory };
  });

  r.delete('/memories/:id', (ctx) => {
    const u = user(ctx);
    const m = services.memory.remove(u.id, ctx.params.id);
    services.audit.record({ userId: u.id, action: 'memory.delete', target: m.content, status: 'ok', ip: ctx.ip });
    return { ok: true };
  });

  r.delete('/memories', (ctx) => {
    const u = user(ctx);
    const n = services.memory.clear(u.id);
    services.audit.record({ userId: u.id, action: 'memory.clear', status: 'ok', details: { count: n }, ip: ctx.ip });
    return { ok: true, cleared: n };
  });

  // ---------- documents ----------

  r.get('/documents', (ctx) => {
    const u = user(ctx);
    return { documents: services.rag.list(u.id) };
  });

  r.post('/documents', async (ctx) => {
    const u = user(ctx);
    if (uploadLimit.limited(u.id)) throw new ApiError(429, 'Bạn tải lên quá nhiều tệp. Thử lại sau.', 'rate_limited');
    // Base64 inflates by ~4/3; allow some headroom for the JSON wrapper.
    const b = await readJson(ctx.req, Math.ceil(MAX_UPLOAD_BYTES * 1.4) + 4096);
    const filename = str(b.filename, 'filename', { max: 200 })!;
    const data = Buffer.from(str(b.data, 'data')!, 'base64');
    const document = await services.rag.upload(u.id, filename, data);
    services.audit.record({ userId: u.id, action: 'document.upload', target: document.title, status: 'ok', details: { size: data.length }, ip: ctx.ip });
    return { document };
  });

  r.delete('/documents/:id', (ctx) => {
    const u = user(ctx);
    const d = services.rag.remove(u.id, ctx.params.id);
    services.audit.record({ userId: u.id, action: 'document.delete', target: d.title, status: 'ok', ip: ctx.ip });
    return { ok: true };
  });

  // ---------- user data overview and audit ----------

  r.get('/my-data', (ctx) => {
    const u = user(ctx);
    return { favorites: services.favorites.list(u.id), trips: services.trips.list(u.id), notes: services.notes.list(u.id, { limit: 50 }).notes };
  });

  r.get('/audit', (ctx) => {
    const u = user(ctx);
    return { entries: services.audit.list(u.id, Number(ctx.query.get('limit') ?? 100)) };
  });

  return r;
}

