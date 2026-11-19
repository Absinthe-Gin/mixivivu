// Manual (not part of npm test): node server/test/live-ollama.manual.ts [model]
// Live end-to-end run against local Ollama: user message → LLM → tool → DB → LLM → answer.
import { createApi } from '../api.ts';
import { openDatabase } from '../shared/db.ts';
import { serve } from '../test/helpers.ts';

const model = process.argv[2] ?? 'qwen2.5:3b';
const api = createApi({ basePath: '/app/', db: openDatabase(':memory:'), env: { AI_OLLAMA_MODEL: model, AI_TIMEOUT_MS: '300000' } });
const http = await serve(api);
const c = http.client();
const conv = (await c.req('POST', '/ai/conversations', {})).data.conversation;
const say = async (content: string) => {
  const t = Date.now();
  const events = (await c.req('POST', `/ai/conversations/${conv.id}/messages`, { content })).data;
  report(content, events, t);
  return events;
};
const report = (label: string, events: any[], t: number) => {
  console.log(`\n>>> ${label}  (${((Date.now() - t) / 1000).toFixed(1)}s)`);
  for (const e of events) {
    if (e.type === 'tool_start') console.log(`  [tool] ${e.name}`);
    if (e.type === 'tool_end') console.log(`  [done] ${e.name}: ${e.status} — ${e.summary}`);
    if (e.type === 'confirmation') console.log(`  [confirm?] ${e.confirmation.preview.title}: ${JSON.stringify(e.confirmation.preview.changes)}`);
    if (e.type === 'error') console.log(`  [error] ${e.message}`);
  }
  for (const x of api.services.executions.forConversation(conv.id).slice(-3)) console.log(`  [args] ${x.toolName} ${JSON.stringify(x.arguments)}`);
  console.log('  answer:', events.filter((e) => e.type === 'text').map((e) => e.text).join('').slice(0, 500));
};
await say('Tìm giúp tôi du thuyền có bể sục, giá dưới 4 triệu');
const ev = await say('Tạo kế hoạch chuyến đi tên "Hạ Long cuối tuần", đi ngày 2026-11-28, về 2026-11-29, 2 người');
const conf = ev.find((e: any) => e.type === 'confirmation');
if (conf) {
  const t = Date.now();
  const after = (await c.req('POST', `/ai/confirmations/${conf.confirmation.id}`, { decision: 'confirm' })).data;
  report('CONFIRM', after, t);
}
console.log('\nDB trips:', JSON.stringify((await c.req('GET', '/ai/my-data')).data.trips.map((t: any) => [t.title, t.startDate, t.endDate, t.guests])));
http.server.close();
