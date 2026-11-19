/** HTTP-level checks: sessions, CSRF, cross-user isolation, admin-only config, rate limits. */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { makeApi, serve } from './helpers.ts';

const { api, mock } = makeApi([], { AI_RATE_LIMIT_MESSAGES: '5' });
const http = await serve(api);
after(() => http.server.close());

test('writes without the CSRF header or from another origin are refused', async () => {
  const c = http.client();
  const noHeader = await c.req('POST', '/ai/conversations', {}, { 'X-Requested-With': '' });
  assert.equal(noHeader.status, 403);
  const evil = await c.req('POST', '/ai/conversations', {}, { Origin: 'https://evil.example' });
  assert.equal(evil.status, 403);
  const ok = await c.req('POST', '/ai/conversations', {});
  assert.equal(ok.status, 200);
});

test('a guest session is created on first use and cookies are HttpOnly', async () => {
  const res = await fetch(`${http.url}/app/api/auth/me`);
  const cookie = res.headers.get('set-cookie') ?? '';
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Path=\/app\//);
  const body = (await res.json()) as { user: { isGuest: boolean } };
  assert.equal(body.user.isGuest, true);
});

test('users cannot read or act on each other’s conversations and confirmations', async () => {
  const alice = http.client();
  const bob = http.client();
  const conv = (await alice.req('POST', '/ai/conversations', { title: 'Kế hoạch riêng' })).data.conversation;
  mock.push({ toolCalls: [{ name: 'create_trip', arguments: { title: 'Bí mật' } }] });
  const events = (await alice.req('POST', `/ai/conversations/${conv.id}/messages`, { content: 'tạo chuyến đi Bí mật' })).data as { type: string; confirmation?: { id: string } }[];
  const confirmation = events.find((e) => e.type === 'confirmation')!.confirmation!;

  await bob.req('GET', '/auth/me');
  assert.equal((await bob.req('GET', `/ai/conversations/${conv.id}`)).status, 404);
  assert.equal((await bob.req('POST', `/ai/conversations/${conv.id}/messages`, { content: 'hi' })).status, 404);
  assert.equal((await bob.req('PATCH', `/ai/conversations/${conv.id}`, { title: 'hacked' })).status, 404);
  assert.equal((await bob.req('DELETE', `/ai/conversations/${conv.id}`)).status, 404);
  assert.equal((await bob.req('POST', `/ai/confirmations/${confirmation.id}`, { decision: 'confirm' })).status, 404);
  assert.equal((await bob.req('GET', '/ai/conversations')).data.conversations.length, 0);

  // Alice can still decide; the decision is idempotent over HTTP too.
  mock.push({ text: 'Đã tạo.' });
  const done = await alice.req('POST', `/ai/confirmations/${confirmation.id}`, { decision: 'confirm' });
  assert.equal(done.status, 200);
  assert.equal((await alice.req('POST', `/ai/confirmations/${confirmation.id}`, { decision: 'confirm' })).status, 409);
  assert.equal((await alice.req('GET', '/ai/my-data')).data.trips.length, 1);
  assert.equal((await bob.req('GET', '/ai/my-data')).data.trips.length, 0);
});

test('conversation history shows steps and confirmation cards, not raw tool messages', async () => {
  const c = http.client();
  const conv = (await c.req('POST', '/ai/conversations', {})).data.conversation;
  mock.push({ toolCalls: [{ name: 'search_ships', arguments: { limit: 2 } }] }, { text: 'Đây là 2 tàu.' });
  await c.req('POST', `/ai/conversations/${conv.id}/messages`, { content: 'tìm tàu', clientMessageId: 'm1' });
  const dup = await c.req('POST', `/ai/conversations/${conv.id}/messages`, { content: 'tìm tàu', clientMessageId: 'm1' });
  assert.ok((dup.data as { type: string; code?: string }[]).some((e) => e.type === 'error' && e.code === 'duplicate_message'));
  const view = (await c.req('GET', `/ai/conversations/${conv.id}`)).data;
  assert.deepEqual(view.messages.map((m: { role: string }) => m.role), ['user', 'assistant', 'assistant']);
  assert.equal(view.messages[1].steps[0].name, 'search_ships');
  assert.equal(view.messages[1].steps[0].status, 'succeeded');
});

test('conversation management: rename, pin, archive, search, clear context, delete', async () => {
  const c = http.client();
  const a = (await c.req('POST', '/ai/conversations', { title: 'Đà Nẵng hè' })).data.conversation;
  const b = (await c.req('POST', '/ai/conversations', { title: 'Phú Quốc' })).data.conversation;
  await c.req('PATCH', `/ai/conversations/${b.id}`, { pinned: true, title: 'Phú Quốc tháng 12' });
  let list = (await c.req('GET', '/ai/conversations')).data.conversations;
  assert.equal(list[0].id, b.id);
  assert.equal(list[0].title, 'Phú Quốc tháng 12');
  assert.equal((await c.req('GET', `/ai/conversations?q=${encodeURIComponent('Đà Nẵng')}`)).data.conversations.length, 1);
  await c.req('PATCH', `/ai/conversations/${a.id}`, { archived: true });
  list = (await c.req('GET', '/ai/conversations')).data.conversations;
  assert.ok(!list.some((x: { id: string }) => x.id === a.id));
  assert.equal((await c.req('GET', '/ai/conversations?archived=1')).data.conversations[0].id, a.id);
  const cleared = await c.req('POST', `/ai/conversations/${b.id}/clear-context`);
  assert.ok(cleared.data.conversation.contextResetAt);
  assert.equal((await c.req('DELETE', `/ai/conversations/${b.id}`)).status, 200);
  assert.equal((await c.req('GET', `/ai/conversations/${b.id}`)).status, 404);
});

test('provider configuration is admin-only and never returns API keys', async () => {
  const guest = http.client();
  assert.equal((await guest.req('POST', '/ai/providers', { name: 'x', type: 'ollama', model: 'm' })).status, 403);

  const admin = http.client();
  const reg = await admin.req('POST', '/auth/register', { username: 'boss', password: 'supersecret1' });
  assert.equal(reg.data.user.role, 'admin', 'first registered account administers the install');
  const created = await admin.req('POST', '/ai/providers', { name: 'OpenRouter', type: 'openai_compatible', baseUrl: 'https://openrouter.ai/api/v1', model: 'x/y', apiKey: 'sk-live-1234567890' });
  assert.equal(created.status, 200);
  assert.equal(created.data.provider.hasApiKey, true);
  assert.equal(created.data.provider.apiKeyHint, '…7890');
  const raw = JSON.stringify((await admin.req('GET', '/ai/providers')).data);
  assert.doesNotMatch(raw, /sk-live-1234567890/);
  const stored = api.services.db.prepare('SELECT api_key_encrypted FROM ai_provider_configs').get() as { api_key_encrypted: string };
  assert.doesNotMatch(stored.api_key_encrypted, /sk-live/);
  assert.equal((await admin.req('POST', '/ai/providers', { name: 'bad', type: 'ollama', model: 'm', baseUrl: 'file:///etc/passwd' })).status, 400);

  const user2 = http.client();
  await user2.req('POST', '/auth/register', { username: 'second', password: 'supersecret2' });
  assert.equal((await user2.req('PATCH', `/ai/providers/${created.data.provider.id}`, { model: 'z' })).status, 403);
});

test('registration upgrades the guest in place; login rotates the session', async () => {
  const c = http.client();
  await c.req('POST', '/ai/conversations', { title: 'trước khi đăng ký' });
  const guestCookie = c.cookie;
  const reg = await c.req('POST', '/auth/register', { username: 'traveler', password: 'longpassword' });
  assert.equal(reg.data.user.isGuest, false);
  assert.notEqual(c.cookie, guestCookie);
  assert.equal((await c.req('GET', '/ai/conversations')).data.conversations.length, 1, 'guest data kept');
  // The old guest token no longer works.
  const old = http.client();
  old.cookie = guestCookie;
  assert.equal((await old.req('GET', '/ai/conversations')).data.conversations.length, 0);

  const bad = await http.client().req('POST', '/auth/login', { username: 'traveler', password: 'wrong-password' });
  assert.equal(bad.status, 401);
  const again = http.client();
  assert.equal((await again.req('POST', '/auth/login', { username: 'traveler', password: 'longpassword' })).status, 200);
  assert.equal((await again.req('GET', '/ai/conversations')).data.conversations.length, 1);
  assert.equal((await again.req('POST', '/auth/register', { username: 'traveler', password: 'longpassword' })).status, 409);
});

test('message rate limit and input validation', async () => {
  const own = makeApi([], { AI_RATE_LIMIT_MESSAGES: '5' });
  const srv = await serve(own.api);
  after(() => srv.server.close());
  const c = srv.client();
  const conv = (await c.req('POST', '/ai/conversations', {})).data.conversation;
  assert.equal((await c.req('POST', `/ai/conversations/${conv.id}/messages`, { content: 'x'.repeat(4001) })).status, 400);
  assert.equal((await c.req('POST', `/ai/conversations/${conv.id}/messages`, {})).status, 400);
  assert.equal((await c.req('PUT', '/ai/settings', { maxToolCalls: 99 })).status, 400);
  assert.equal((await c.req('PUT', '/ai/settings', { isAdmin: true })).status, 400);
  const statuses: number[] = [];
  for (let i = 0; i < 6; i++) statuses.push((await c.req('POST', `/ai/conversations/${conv.id}/messages`, { content: `hi ${i}` })).status);
  assert.ok(statuses.includes(429));
});
