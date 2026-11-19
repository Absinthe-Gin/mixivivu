import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * Assistant UI. Streams are mocked (no LLM calls, no cost); the real
 * backend serves auth, conversations list and validation checks.
 */
const ndjson = (events: object[]) => events.map((e) => JSON.stringify(e)).join('\n') + '\n';

const conversation = { id: 'c1', title: 'Xoá ghi chú', pinned: false, archived: false, contextResetAt: null, lastMessageAt: '2026-11-19T00:00:00Z', createdAt: '2026-11-19T00:00:00Z' };
const preview = {
  title: 'Xoá ghi chú',
  target: 'Đồ cần mang',
  changes: [{ field: 'Đồ cần mang', before: 'kem chống nắng', after: 'Đã xoá' }],
  consequence: 'Ghi chú sẽ bị xoá.',
  risk: 'destructive',
};
const msg = (id: string, role: 'user' | 'assistant', content: string, extra: object = {}) => ({ id, role, content, status: 'complete', model: 'mock', createdAt: '2026-11-19T00:00:00Z', metadata: {}, steps: [], confirmations: [], ...extra });

/** Mocks the conversation endpoints with a tiny in-memory state machine. */
async function mockAgent(page: Page) {
  let state: 'empty' | 'pending' | 'done' = 'empty';
  const sent: { content?: string; decision?: string }[] = [];
  const history = () => {
    if (state === 'empty') return [];
    const step = { callId: 't1', name: 'delete_notes', label: 'Đang xoá ghi chú…', status: state === 'done' ? 'succeeded' : 'awaiting_confirmation', summary: state === 'done' ? 'Đã xoá 1 ghi chú' : 'Chờ bạn xác nhận' };
    const conf = { id: 'k1', toolName: 'delete_notes', preview, status: state === 'done' ? 'confirmed' : 'pending', expiresAt: '2099-01-01T00:00:00Z' };
    const out = [msg('m1', 'user', 'Xoá ghi chú đồ cần mang'), msg('m2', 'assistant', 'Mình cần bạn xác nhận trước khi xoá.', { steps: [step], confirmations: [conf] })];
    if (state === 'done') out.push(msg('m3', 'assistant', 'Đã xoá ghi chú **Đồ cần mang**.'));
    return out;
  };
  await page.route('**/api/ai/conversations**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === 'POST' && url.pathname.endsWith('/ai/conversations')) return route.fulfill({ json: { conversation } });
    if (req.method() === 'GET' && url.pathname.endsWith('/ai/conversations')) return route.fulfill({ json: { conversations: state === 'empty' ? [] : [conversation] } });
    if (req.method() === 'GET' && url.pathname.endsWith('/conversations/c1')) return route.fulfill({ json: { conversation, messages: history() } });
    if (req.method() === 'POST' && url.pathname.endsWith('/conversations/c1/messages')) {
      sent.push(req.postDataJSON());
      state = 'pending';
      return route.fulfill({
        contentType: 'application/x-ndjson',
        body: ndjson([
          { type: 'conversation', conversation: { id: 'c1', title: 'Xoá ghi chú' } },
          { type: 'status', text: 'Đang phân tích yêu cầu…' },
          { type: 'tool_start', callId: 's1', name: 'search_notes', label: 'Đang tìm ghi chú…' },
          { type: 'tool_end', callId: 's1', name: 'search_notes', status: 'succeeded', summary: 'Đã tìm thấy 1 ghi chú' },
          { type: 'text', text: 'Mình cần bạn xác nhận ' },
          { type: 'text', text: 'trước khi xoá.' },
          { type: 'confirmation', confirmation: { id: 'k1', toolName: 'delete_notes', preview, status: 'pending', expiresAt: '2099-01-01T00:00:00Z' } },
          { type: 'done', messageId: 'm2', mode: 'ai', awaitingConfirmation: true },
        ]),
      });
    }
    return route.continue();
  });
  await page.route('**/api/ai/confirmations/k1', async (route) => {
    sent.push(route.request().postDataJSON());
    state = 'done';
    await route.fulfill({
      contentType: 'application/x-ndjson',
      body: ndjson([
        { type: 'confirmation_update', id: 'k1', status: 'confirmed' },
        { type: 'tool_end', callId: 't1', name: 'delete_notes', status: 'succeeded', summary: 'Đã xoá 1 ghi chú' },
        { type: 'text', text: 'Đã xoá ghi chú **Đồ cần mang**.' },
        { type: 'done', messageId: 'm3', mode: 'ai', awaitingConfirmation: false },
      ]),
    });
  });
  return sent;
}

test('assistant page: streaming, tool steps, confirmation card and history', async ({ page }) => {
  const sent = await mockAgent(page);
  await page.goto('tro-ly');
  await expect(page.getByText('Hôm nay bạn muốn đi đâu?')).toBeVisible();

  const box = page.getByRole('textbox', { name: 'Tin nhắn cho trợ lý' });
  await box.fill('Xoá ghi chú đồ cần mang');
  await box.press('Enter');
  await expect(page).toHaveURL(/tro-ly\/c1$/);
  expect(sent[0]).toMatchObject({ content: 'Xoá ghi chú đồ cần mang' });
  expect((sent[0] as { clientMessageId?: string }).clientMessageId).toBeTruthy();

  const card = page.getByRole('region', { name: 'Xác nhận: Xoá ghi chú' });
  await expect(card).toBeVisible();
  await expect(card.getByText('Ghi chú sẽ bị xoá.')).toBeVisible();
  await expect(card.getByText('kem chống nắng')).toBeVisible();
  await expect(page.getByText('Mình cần bạn xác nhận trước khi xoá.')).toBeVisible();
  await expect(page.getByText('Chờ bạn xác nhận')).toBeVisible();

  await card.getByRole('button', { name: 'Xác nhận xoá' }).click();
  expect(sent[1]).toEqual({ decision: 'confirm' });
  await expect(page.getByText('Đã xác nhận và thực hiện')).toBeVisible();
  await expect(page.getByText('Đã xoá 1 ghi chú')).toBeVisible();
  await expect(page.locator('strong', { hasText: 'Đồ cần mang' })).toBeVisible();
  // The confirmed card no longer offers buttons.
  await expect(card.getByRole('button', { name: 'Xác nhận xoá' })).toHaveCount(0);
  // Sidebar lists the conversation.
  await expect(page.getByRole('navigation', { name: 'Cuộc trò chuyện' }).getByRole('link', { name: 'Xoá ghi chú' })).toBeVisible();
});

test('markdown renders tables, code and safe links only', async ({ page }) => {
  await page.route('**/api/ai/conversations**', async (route) => {
    const url = new URL(route.request().url());
    const md = '| Tàu | Giá |\n|---|---|\n| **A** | 3,000,000đ |\n\n```js\nconst x = 1;\n```\n\n[Trang tàu](/du-thuyen/president-cruises-halong) [xấu](javascript:alert(1))';
    if (route.request().method() === 'POST' && url.pathname.endsWith('/ai/conversations')) return route.fulfill({ json: { conversation } });
    if (url.pathname.endsWith('/messages')) return route.fulfill({ contentType: 'application/x-ndjson', body: ndjson([{ type: 'text', text: md }, { type: 'done', messageId: 'm2', mode: 'ai', awaitingConfirmation: false }]) });
    if (url.pathname.endsWith('/conversations/c1')) return route.fulfill({ json: { conversation, messages: [msg('m1', 'user', 'so sánh'), msg('m2', 'assistant', md)] } });
    return route.fulfill({ json: { conversations: [] } });
  });
  await page.goto('tro-ly');
  await page.getByRole('textbox', { name: 'Tin nhắn cho trợ lý' }).fill('so sánh');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('cell', { name: '3,000,000đ' })).toBeVisible();
  await expect(page.locator('pre code')).toHaveText('const x = 1;');
  await expect(page.getByRole('link', { name: 'Trang tàu' })).toHaveAttribute('href', /\/du-thuyen\/president-cruises-halong$/);
  await expect(page.getByRole('link', { name: 'xấu' })).toHaveCount(0);
});

test('widget sends the current page as context and opens the full page', async ({ page }) => {
  const sent = await mockAgent(page);
  await page.goto('du-thuyen/president-cruises-halong');
  await page.getByRole('button', { name: 'Mở trợ lý Mixivivu' }).click();
  const chat = page.getByRole('dialog', { name: 'Trợ lý Mixivivu' });
  await chat.getByRole('textbox', { name: 'Tin nhắn cho trợ lý' }).fill('Xoá ghi chú đồ cần mang');
  await chat.getByRole('textbox', { name: 'Tin nhắn cho trợ lý' }).press('Enter');
  await expect(chat.getByRole('region', { name: 'Xác nhận: Xoá ghi chú' })).toBeVisible();
  expect(sent[0]).toMatchObject({ appContext: { path: '/du-thuyen/president-cruises-halong' } });
  await chat.getByRole('link', { name: 'Mở toàn màn hình' }).click();
  await expect(page).toHaveURL(/tro-ly\/c1$/);
  await expect(page.getByRole('region', { name: 'Xác nhận: Xoá ghi chú' })).toBeVisible();
});

test('assistant API: CSRF, validation and isolation (real backend)', async ({ request, playwright }) => {
  const h = { 'X-Requested-With': 'mixivivu' };
  expect((await request.post('api/ai/conversations', { data: {} })).status()).toBe(403);
  const conv = (await (await request.post('api/ai/conversations', { data: { title: 'Riêng tư' }, headers: h })).json()).conversation;
  expect((await request.post(`api/ai/conversations/${conv.id}/messages`, { data: { content: 'x'.repeat(4001) }, headers: h })).status()).toBe(400);
  // Another browser session (no cookie) cannot read it.
  const other = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  expect((await other.get(`api/ai/conversations/${conv.id}`)).status()).toBe(404);
  await other.dispose();
});

test('basic mode answers without an AI provider (real backend)', async ({ request }) => {
  const providers = (await (await request.get('api/ai/providers')).json()).providers as unknown[];
  test.skip(providers.length > 0, 'An AI provider is configured on this server; this check would call it.');
  const h = { 'X-Requested-With': 'mixivivu' };
  const conv = (await (await request.post('api/ai/conversations', { data: {}, headers: h })).json()).conversation;
  const res = await request.post(`api/ai/conversations/${conv.id}/messages`, { data: { content: 'Khách sạn 5 sao ở Đà Nẵng' }, headers: h });
  const events = (await res.text()).trim().split('\n').map((l) => JSON.parse(l));
  expect(events.at(-1)).toMatchObject({ type: 'done', mode: 'basic' });
  expect(events.filter((e) => e.type === 'text').map((e) => e.text).join('')).toContain('/tim-khach-san/');
});

test('assistant is full screen with a drawer and a fixed composer on mobile @mobile', async ({ page }) => {
  await page.route('**/api/ai/conversations**', (route) => route.fulfill({ json: { conversations: [] } }));
  await page.goto('tro-ly');
  const composer = page.getByRole('textbox', { name: 'Tin nhắn cho trợ lý' });
  const box = await composer.boundingBox();
  expect(box!.y + box!.height).toBeGreaterThan(844 - 120);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Mở danh sách cuộc trò chuyện' }).click();
  const drawer = page.getByRole('dialog', { name: 'Danh sách cuộc trò chuyện' });
  await expect(drawer.getByRole('button', { name: 'Cuộc trò chuyện mới' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(drawer.getByRole('button', { name: 'Cuộc trò chuyện mới' })).toHaveCount(0);

  await page.goto('');
  await page.getByRole('button', { name: 'Mở trợ lý Mixivivu' }).click();
  expect((await page.getByRole('dialog', { name: 'Trợ lý Mixivivu' }).boundingBox())?.width).toBe(390);
});
