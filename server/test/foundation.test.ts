import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openDatabase } from '../shared/db.ts';
import { decryptSecret, encryptSecret, hashPassword, stableStringify, verifyPassword } from '../shared/crypto.ts';
import { Router } from '../shared/http.ts';
import { FavoritesService } from '../domain/favoritesService.ts';
import { NotesService } from '../domain/notesService.ts';
import { TripsService } from '../domain/tripsService.ts';

const user = (db: ReturnType<typeof openDatabase>, id: string) =>
  db.prepare("INSERT INTO users (id, role, is_guest, created_at, updated_at) VALUES (?, 'user', 1, 'x', 'x')").run(id);

test('migrations are idempotent and create every AI table', () => {
  const db = openDatabase(':memory:');
  const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table')").all() as { name: string }[]).map((r) => r.name);
  for (const t of ['ai_conversations', 'ai_messages', 'ai_tool_executions', 'ai_memories', 'ai_documents', 'ai_document_chunks', 'ai_provider_configs', 'ai_user_settings', 'ai_action_confirmations', 'ai_audit_logs']) {
    assert.ok(tables.includes(t), `missing ${t}`);
  }
});

test('password hashing and secret encryption round-trip', () => {
  const h = hashPassword('correct horse');
  assert.ok(verifyPassword('correct horse', h));
  assert.ok(!verifyPassword('wrong', h));
  process.env.AI_SECRET_KEY = 'test-secret-key-123456';
  const enc = encryptSecret('sk-abc');
  assert.notEqual(enc, 'sk-abc');
  assert.equal(decryptSecret(enc), 'sk-abc');
  assert.equal(stableStringify({ b: 1, a: [2, { d: 1, c: 2 }] }), '{"a":[2,{"c":2,"d":1}],"b":1}');
});

test('router matches params and reports wrong methods', () => {
  const r = new Router().get('/conversations/:id', () => 1);
  const m = r.match('GET', '/conversations/abc');
  assert.ok(m && m !== 'method');
  assert.deepEqual((m as { params: object }).params, { id: 'abc' });
  assert.equal(r.match('POST', '/conversations/abc'), 'method');
  assert.equal(r.match('GET', '/nope'), undefined);
});

test('domain services scope every record to its owner', () => {
  const db = openDatabase(':memory:');
  user(db, 'u1');
  user(db, 'u2');
  const notes = new NotesService(db);
  const n = notes.create('u1', { title: 'Đồ cần mang', content: 'kem chống nắng', tags: ['ha-long'] });
  assert.throws(() => notes.get('u2', n.id), /Không tìm thấy/);
  assert.throws(() => notes.remove('u2', [n.id]));
  assert.equal(notes.list('u1').total, 1);

  const trips = new TripsService(db);
  const t = trips.create('u1', { title: 'Hạ Long', start_date: '2026-12-01', end_date: '2026-12-02', guests: 2 });
  assert.throws(() => trips.update('u1', t.id, { end_date: '2026-11-01' }), /sau ngày bắt đầu/);
  assert.throws(() => trips.update('u2', t.id, { title: 'x' }), /Không tìm thấy/);
  const withItem = trips.addItem('u1', t.id, { item_type: 'ship', slug: 'president-cruises-halong' });
  assert.equal(withItem.items[0].title, 'Du thuyền Ambassador Hạ Long');
  assert.ok(withItem.items[0].price! > 0);

  const favs = new FavoritesService(db);
  const a = favs.add('u1', 'ship', 'president-cruises-halong');
  assert.equal(a.created, true);
  assert.equal(favs.add('u1', 'ship', 'president-cruises-halong').created, false);
  assert.throws(() => favs.add('u1', 'ship', 'not-a-ship'), /Không có du thuyền/);
  assert.equal(favs.list('u2').length, 0);
});
