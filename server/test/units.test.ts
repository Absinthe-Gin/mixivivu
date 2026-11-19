/** Unit tests: validator, registry, context manager, provider adapters, RAG, parsers. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { deflateRawSync } from 'node:zlib';
import { ContextManager, toLLMMessages } from '../ai/context/contextManager.ts';
import { toAnthropicMessages } from '../ai/providers/anthropic.ts';
import { OllamaProvider } from '../ai/providers/ollama.ts';
import { OpenAICompatibleProvider } from '../ai/providers/openaiCompatible.ts';
import { envProviderConfigs } from '../ai/providers/providerService.ts';
import type { ProviderConfig } from '../ai/providers/types.ts';
import { HashingEmbedder, cosine } from '../ai/rag/embeddings.ts';
import { parseDocument } from '../ai/rag/parsers.ts';
import { chunkText } from '../ai/rag/text.ts';
import { createDefaultRegistry } from '../ai/tools/index.ts';
import { ToolRegistry } from '../ai/tools/registry.ts';
import { validateArgs } from '../ai/tools/validate.ts';
import { makeApi, makeUser } from './helpers.ts';

test('validator: required, unknown fields, enums, dates, coercion', () => {
  const schema = {
    type: 'object',
    properties: { n: { type: 'integer', minimum: 1 }, d: { type: 'string', format: 'date' }, e: { type: 'string', enum: ['a', 'b'] }, b: { type: 'boolean' }, l: { type: 'array', maxItems: 2, items: { type: 'string' } } },
    required: ['n'],
    additionalProperties: false,
  };
  assert.deepEqual(validateArgs(schema, { n: '3', b: 'true' }).value, { n: 3, b: true });
  const bad = validateArgs(schema, { n: 0.5, d: '2026-13-45', e: 'c', x: 1, l: ['1', '2', '3'] });
  assert.equal(bad.ok, false);
  for (const msg of ['n: must be an integer', 'd: must be a date', 'e: must be one of', 'x: unknown field', 'l: at most 2']) assert.ok(bad.errors.some((e) => e.includes(msg)), msg);
  assert.ok(validateArgs(schema, {}).errors.includes('n: is required'));
});

test('registry: destructive tools always confirm; write tools need previews; names unique', () => {
  const base = { description: 'd', category: 'c', label: 'l', parameters: { type: 'object', properties: {} }, execute: () => ({ data: null }) };
  const r = new ToolRegistry().register({ ...base, name: 'wipe', risk: 'destructive', confirmation: 'never', preview: () => ({ title: 't', consequence: 'c', risk: 'destructive' }) });
  assert.equal(r.get('wipe')!.confirmation, 'always');
  assert.throws(() => r.register({ ...base, name: 'wipe', risk: 'read', confirmation: 'never' }), /already registered/);
  assert.throws(() => r.register({ ...base, name: 'w2', risk: 'write', confirmation: 'significant' }), /preview/);
  assert.throws(() => r.register({ ...base, name: 'Bad Name', risk: 'read', confirmation: 'never' }), /Invalid tool name/);
  // The real registry: every write tool has a preview, every schema forbids extra fields.
  for (const t of createDefaultRegistry().all()) {
    assert.equal(t.parameters.additionalProperties, false, t.name);
    if (t.risk !== 'read') assert.ok(t.preview, t.name);
  }
});

test('context manager: windowing at user boundaries, placeholders, reset and memories', () => {
  const { api } = makeApi();
  const u = makeUser(api);
  const c = api.services.conversations.create(u.id);
  const conv = api.services.conversations;
  conv.append(u.id, c.id, { role: 'user', content: 'Tôi muốn đi Lan Hạ bằng du thuyền có bể bơi' });
  conv.append(u.id, c.id, { role: 'assistant', content: 'Được, mình tìm giúp bạn.' });
  for (let i = 0; i < 10; i++) {
    conv.append(u.id, c.id, { role: 'user', content: `câu hỏi ${i}` });
    conv.append(u.id, c.id, { role: 'assistant', content: '', toolCalls: [{ id: `t${i}`, name: 'search_ships', arguments: {} }] });
    if (i !== 9) conv.append(u.id, c.id, { role: 'tool', content: 'x'.repeat(2000), toolCallId: `t${i}`, toolName: 'search_ships' });
    conv.append(u.id, c.id, { role: 'assistant', content: `trả lời ${i}` });
  }
  const settings = { ...api.services.settings.get(u.id), contextMessages: 8 };
  const cm = new ContextManager(api.services);
  const built = cm.build({ userId: u.id, conversationId: c.id, query: 'du thuyền bể bơi Lan Hạ', settings, contextWindow: 16000, maxOutputTokens: 1000, toolNames: [] });
  assert.equal(built.messages[0].role, 'user', 'window starts at a user turn');
  assert.ok(built.messages.length <= 12, `window too large: ${built.messages.length}`);
  // Unanswered tool call gets a placeholder result.
  const placeholder = built.messages.find((m) => m.role === 'tool' && m.toolCallId === 't9');
  assert.ok(placeholder && /not performed/.test(placeholder.content));
  // Old tool results are truncated.
  assert.ok(built.messages.filter((m) => m.role === 'tool').some((m) => m.content.includes('older result truncated')));
  // A relevant early message is surfaced as an excerpt.
  assert.match(built.system, /Earlier in this conversation[\s\S]*Lan Hạ/);

  conv.clearContext(u.id, c.id);
  conv.append(u.id, c.id, { role: 'user', content: 'mới' });
  const afterReset = cm.build({ userId: u.id, conversationId: c.id, query: 'mới', settings, contextWindow: 16000, maxOutputTokens: 1000, toolNames: [] });
  assert.deepEqual(afterReset.messages.map((m) => m.content), ['mới']);
});

test('anthropic adapter groups consecutive tool results into one user turn', () => {
  const msgs = toAnthropicMessages(
    toLLMMessages([
      { role: 'user', content: 'q' },
      { role: 'assistant', content: 'checking', toolCalls: [{ id: 'a', name: 'x', arguments: {} }, { id: 'b', name: 'y', arguments: { k: 1 } }] },
      { role: 'tool', content: 'ra', toolCallId: 'a', toolName: 'x' },
      { role: 'tool', content: 'Error: rb', toolCallId: 'b', toolName: 'y' },
    ].map((m, i) => ({ id: String(i), conversationId: 'c', seq: i, toolCalls: [], toolCallId: null, toolName: null, status: 'complete', provider: null, model: null, inputTokens: null, outputTokens: null, metadata: {}, createdAt: '', ...m }) as never)),
  );
  assert.equal(msgs.length, 3);
  assert.equal(msgs[1].role, 'assistant');
  const results = msgs[2].content as { type: string; is_error?: boolean }[];
  assert.deepEqual(results.map((b) => b.type), ['tool_result', 'tool_result']);
  assert.equal(results[1].is_error, true);
});

async function fakeServer(handler: (path: string, body: string) => string, type: string) {
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const c of req) body += c;
    res.setHeader('Content-Type', type);
    res.end(handler(req.url ?? '', body));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return { server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

const cfg = (over: Partial<ProviderConfig>): ProviderConfig => ({ id: 't', name: 't', type: 'openai_compatible', model: 'm', models: [], maxTokens: 100, contextWindow: 8000, timeoutMs: 5000, origin: 'env', ...over });

test('openai-compatible adapter assembles streamed tool-call fragments', async () => {
  let sent: { tools?: unknown[]; messages: { role: string }[] } | undefined;
  const sse = [
    { choices: [{ delta: { content: 'Để mình ' } }] },
    { choices: [{ delta: { content: 'tìm.' } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'search_', arguments: '{"que' } }] } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, function: { name: 'ships', arguments: 'ry":"Ambassador"}' } }] }, finish_reason: 'tool_calls' }] },
    { choices: [], usage: { prompt_tokens: 12, completion_tokens: 7 } },
  ]
    .map((c) => `data: ${JSON.stringify(c)}\n\n`)
    .join('') + 'data: [DONE]\n\n';
  const { server, url } = await fakeServer((_p, body) => ((sent = JSON.parse(body)), sse), 'text/event-stream');
  try {
    const p = new OpenAICompatibleProvider(cfg({ baseUrl: `${url}/v1` }));
    const r = await p.generateWithTools({ system: 's', messages: [{ role: 'user', content: 'hi' }], tools: [{ name: 'search_ships', description: 'd', parameters: { type: 'object' } }] });
    assert.equal(r.text, 'Để mình tìm.');
    assert.deepEqual(r.toolCalls, [{ id: 'call_1', name: 'search_ships', arguments: { query: 'Ambassador' } }]);
    assert.equal(r.stopReason, 'tool_calls');
    assert.deepEqual(r.usage, { inputTokens: 12, outputTokens: 7 });
    assert.equal(sent!.messages[0].role, 'system');
    assert.equal(sent!.tools!.length, 1);
  } finally {
    server.close();
  }
});

test('ollama adapter: native tool calls, capability check, no thinking output', async () => {
  let chatBody: { think?: boolean } = {};
  const { server, url } = await fakeServer((path, body) => {
    if (path === '/api/show') return JSON.stringify({ capabilities: JSON.parse(body).model === 'tools-model' ? ['completion', 'tools'] : ['completion'] });
    if (path === '/api/tags') return JSON.stringify({ models: [{ name: 'tools-model', capabilities: ['tools'] }] });
    chatBody = JSON.parse(body);
    return [
      { message: { content: '' , tool_calls: [{ function: { name: 'list_trips', arguments: { status: 'planning' } } }] }, done: false },
      { message: { content: '' }, done: true, done_reason: 'stop', prompt_eval_count: 30, eval_count: 4 },
    ].map((c) => JSON.stringify(c)).join('\n');
  }, 'application/x-ndjson');
  try {
    const p = new OllamaProvider(cfg({ type: 'ollama', baseUrl: url, model: 'tools-model' }));
    const r = await p.generateWithTools({ system: 's', messages: [{ role: 'user', content: 'hi' }], tools: [{ name: 'list_trips', description: 'd', parameters: { type: 'object' } }] });
    assert.equal(r.toolCalls[0].name, 'list_trips');
    assert.deepEqual(r.toolCalls[0].arguments, { status: 'planning' });
    assert.equal(r.stopReason, 'tool_calls');
    assert.equal(chatBody.think, false);
    assert.equal((await p.validateConfiguration()).ok, true);
    const noTools = new OllamaProvider(cfg({ type: 'ollama', baseUrl: url, model: 'plain' }));
    await assert.rejects(noTools.generateWithTools({ system: 's', messages: [{ role: 'user', content: 'x' }], tools: [{ name: 'a', description: 'd', parameters: { type: 'object' } }] }), /không hỗ trợ tool calling/);
  } finally {
    server.close();
  }
});

test('env provider configs: defaults and explicit default', () => {
  assert.deepEqual(envProviderConfigs({}), []);
  const both = envProviderConfigs({ ANTHROPIC_API_KEY: 'k', AI_OLLAMA_MODEL: 'qwen2.5:3b', AI_DEFAULT_PROVIDER: 'ollama' });
  assert.deepEqual(both.map((c) => [c.id, c.isDefault]), [['env-anthropic', false], ['env-ollama', true]]);
});

test('hashing embedder ranks related text higher, chunker splits with overlap', () => {
  const e = new HashingEmbedder();
  const q = e.embedOne('du thuyền có bể bơi');
  assert.ok(cosine(q, e.embedOne('Du thuyền này có bể bơi ngoài trời')) > cosine(q, e.embedOne('Khách sạn gần sân bay Đà Nẵng')));
  const chunks = chunkText('Câu số một rất dài. '.repeat(200), 500, 100);
  assert.ok(chunks.length > 3 && chunks.every((c) => c.length <= 600));
});

/** Minimal ZIP writer (deflate) so the DOCX/XLSX parsers can be tested without fixtures. */
function zip(files: Record<string, string>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = deflateRawSync(Buffer.from(content));
    const n = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt16LE(n.length, 26);
    locals.push(local, n, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, n);
    offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

test('parsers: txt, csv, docx, xlsx; pdf and binaries rejected', () => {
  assert.equal(parseDocument('a.txt', Buffer.from('xin chào')).text, 'xin chào');
  assert.match(parseDocument('a.csv', Buffer.from('ten,gia\n"Tàu A, VIP",3000000')).text, /Tàu A, VIP \| 3000000/);
  const docx = zip({ 'word/document.xml': '<w:document><w:body><w:p><w:r><w:t>Lịch trình &amp; chi phí</w:t></w:r></w:p><w:p><w:r><w:t>Ngày 1</w:t></w:r></w:p></w:body></w:document>' });
  assert.equal(parseDocument('plan.docx', docx).text, 'Lịch trình & chi phí\nNgày 1');
  const xlsx = zip({
    'xl/sharedStrings.xml': '<sst><si><t>Hạng mục</t></si><si><t>Du thuyền</t></si></sst>',
    'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row><c t="s"><v>0</v></c><c><v>100</v></c></row><row><c t="s"><v>1</v></c><c><v>3500000</v></c></row></sheetData></worksheet>',
  });
  assert.match(parseDocument('chi-phi.xlsx', xlsx).text, /Du thuyền \| 3500000/);
  assert.throws(() => parseDocument('a.pdf', Buffer.from('%PDF')), /Chưa hỗ trợ PDF/);
  assert.throws(() => parseDocument('a.txt', Buffer.from([0, 1, 2, 0, 0])), /nhị phân/);
  assert.throws(() => parseDocument('a.exe', Buffer.from('x')), /chưa được hỗ trợ/);
});

test('rag: uploads are private, searchable, readable and removable; public content indexed', async () => {
  const { api } = makeApi();
  const a = makeUser(api, 'a');
  const b = makeUser(api, 'b');
  const doc = await api.services.rag.upload(a.id, 'ghi-chu.md', Buffer.from('# Kế hoạch\nĐặt du thuyền Zyxelegance cho chuyến đi tháng 12, ngân sách 8 triệu.'));
  const hitsA = await api.services.rag.search(a.id, 'ngân sách du thuyền tháng 12', { sourceTypes: ['upload'] });
  assert.equal(hitsA[0]?.documentId, doc.id);
  assert.equal((await api.services.rag.search(b.id, 'ngân sách du thuyền tháng 12', { sourceTypes: ['upload'] })).length, 0);
  assert.throws(() => api.services.rag.read(b.id, doc.id), /Không tìm thấy/);
  assert.throws(() => api.services.rag.remove(b.id, doc.id), /Không tìm thấy/);

  const blog = await api.services.rag.search(b.id, 'lễ hội mùa xuân miền Bắc', { sourceTypes: ['blog'] });
  assert.ok(blog.length > 0 && blog[0].link?.startsWith('/blog-detail/'));

  api.services.rag.remove(a.id, doc.id);
  assert.equal((await api.services.rag.search(a.id, 'Zyxelegance', { sourceTypes: ['upload'] })).length, 0);
  const fts = api.services.db.prepare("SELECT COUNT(*) AS n FROM ai_chunks_fts WHERE ai_chunks_fts MATCH 'zyxelegance'").get() as { n: number };
  assert.equal(fts.n, 0, 'FTS rows removed with the document');

  // Changing the embedder version triggers re-embedding.
  const { HashingEmbedder: H } = await import('../ai/rag/embeddings.ts');
  const { RagService } = await import('../ai/rag/ragService.ts');
  const rag2 = new RagService(api.services.db, new H(256));
  assert.ok((await rag2.reindexStale()) > 0);
});
