/** Test helpers: in-memory API, mock provider, HTTP client with cookies. */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { type Api, createApi } from '../api.ts';
import type { AuthUser } from '../auth/authService.ts';
import type { AgentEvent } from '../ai/orchestrator/events.ts';
import { MockProvider, type MockTurn } from '../ai/providers/mock.ts';
import { openDatabase } from '../shared/db.ts';

export const BASE = '/app/';
// Secret encryption reads process.env (as in production).
process.env.AI_SECRET_KEY ??= 'test-secret-key-123456';

export function makeApi(script: MockTurn[] = [], env: NodeJS.ProcessEnv = {}) {
  const db = openDatabase(':memory:');
  const api = createApi({ basePath: BASE, db, env: { AI_SECRET_KEY: 'test-secret-key-123456', ...env } });
  const mock = new MockProvider(script);
  api.services.providers.override = mock;
  return { api, mock, db };
}

export function makeUser(api: Api, name = 'u'): AuthUser {
  const id = `${name}-${Math.random().toString(36).slice(2, 8)}`;
  api.services.db.prepare("INSERT INTO users (id, username, role, is_guest, created_at, updated_at) VALUES (?, ?, 'user', 0, 'x', 'x')").run(id, id);
  return { id, username: id, displayName: null, role: 'user', isGuest: false };
}

/** Runs one turn directly through the orchestrator and collects events. */
export async function turn(api: Api, user: AuthUser, conversationId: string, content: string, extra: { attachmentIds?: string[] } = {}): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  await api.orchestrator.runTurn({ user, conversationId, content, signal: new AbortController().signal, emit: (e) => events.push(e), ...extra });
  return events;
}

export async function decide(api: Api, user: AuthUser, confirmationId: string, decision: 'confirm' | 'cancel'): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  await api.orchestrator.decide({ user, confirmationId, decision, signal: new AbortController().signal, emit: (e) => events.push(e) });
  return events;
}

export const textOf = (events: AgentEvent[]) => events.filter((e) => e.type === 'text').map((e) => (e as { text: string }).text).join('');
export const confirmationOf = (events: AgentEvent[]) => (events.find((e) => e.type === 'confirmation') as Extract<AgentEvent, { type: 'confirmation' }> | undefined)?.confirmation;

/** Real HTTP server around the API, with a cookie-keeping client. */
export async function serve(api: Api): Promise<{ server: Server; url: string; client: () => Client }> {
  const server = createServer((req, res) => {
    api.handle(req, res).then((handled) => {
      if (!handled) {
        res.statusCode = 404;
        res.end();
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { server, url, client: () => new Client(url) };
}

export class Client {
  cookie = '';
  private readonly url: string;
  constructor(url: string) {
    this.url = url;
  }

  async req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(`${this.url}${BASE}api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'mixivivu', ...(this.cookie ? { Cookie: this.cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0];
    const text = await res.text();
    const type = res.headers.get('content-type') ?? '';
    const data = type.includes('ndjson') ? text.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : text ? JSON.parse(text) : null;
    return { status: res.status, data };
  }
}
