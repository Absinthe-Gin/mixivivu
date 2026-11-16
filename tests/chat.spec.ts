import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/** True when the dev server may hold Claude credentials (real calls would be billed). */
const hasClaudeKey =
  !!process.env.ANTHROPIC_API_KEY || (existsSync('.env') && /^ANTHROPIC_API_KEY=\S+/m.test(readFileSync('.env', 'utf8')));

const ndjson = (events: object[]) => events.map((e) => JSON.stringify(e)).join('\n') + '\n';

test('chat widget streams an answer with tool status and working links', async ({ page }) => {
  let sentBody: { messages: { role: string; content: string }[] } | undefined;
  await page.route('**/api/chat', async (route) => {
    sentBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/x-ndjson',
      body: ndjson([
        { type: 'tool', name: 'search_ships' },
        { type: 'text', text: 'Gợi ý cho bạn:\n- **[Du thuyền Ambassador Hạ Long](/du-thuyen/president-cruises-halong)** - từ 3,850,000đ/khách' },
        { type: 'done', mode: 'ai' },
      ]),
    });
  });

  await page.goto('');
  await page.getByRole('button', { name: 'Mở trợ lý Mixivivu' }).click();
  const chat = page.getByRole('dialog', { name: 'Trợ lý Mixivivu' });
  await expect(chat.getByText('Xin chào! Mình là trợ lý Mixivivu', { exact: false })).toBeVisible();

  await chat.getByRole('textbox', { name: 'Câu hỏi cho trợ lý' }).fill('Tàu nào có bể sục?');
  await chat.getByRole('textbox', { name: 'Câu hỏi cho trợ lý' }).press('Enter');
  await expect(chat.getByText('Tàu nào có bể sục?')).toBeVisible();
  const link = chat.getByRole('link', { name: 'Du thuyền Ambassador Hạ Long' });
  await expect(link).toBeVisible();
  await expect(chat.locator('li')).toHaveCount(1);

  // Only real turns are sent: the UI greeting is filtered server-side, the user turn is last.
  expect(sentBody?.messages.at(-1)).toEqual({ role: 'user', content: 'Tàu nào có bể sục?' });

  await link.click();
  await expect(page).toHaveURL(/du-thuyen\/president-cruises-halong$/);
  await expect(page.getByRole('heading', { name: 'Du thuyền Ambassador Hạ Long' })).toBeVisible();
});

test('chat widget shows server errors and keeps history across pages', async ({ page }) => {
  await page.route('**/api/chat', (route) =>
    route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: 'Bạn gửi quá nhiều tin nhắn.' }) }),
  );
  await page.goto('blog');
  await page.getByRole('button', { name: 'Mở trợ lý Mixivivu' }).click();
  const chat = page.getByRole('dialog', { name: 'Trợ lý Mixivivu' });
  await chat.getByRole('button', { name: 'Cách đặt phòng du thuyền?' }).click();
  await expect(chat.getByRole('alert')).toHaveText('Bạn gửi quá nhiều tin nhắn.');

  // The widget lives in the layout, so it stays open with its history while navigating...
  await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: 'Doanh nghiệp' }).click();
  await expect(page).toHaveURL(/doanh-nghiep$/);
  await expect(chat.getByText('Cách đặt phòng du thuyền?')).toBeVisible();
  // ...and the history survives a full reload (sessionStorage).
  await page.reload();
  await page.getByRole('button', { name: 'Mở trợ lý Mixivivu' }).click();
  await expect(page.getByRole('dialog', { name: 'Trợ lý Mixivivu' }).getByText('Cách đặt phòng du thuyền?')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Trợ lý Mixivivu' })).toHaveCount(0);
});

test('chat API rejects malformed requests', async ({ request }) => {
  const empty = await request.post('api/chat', { data: { messages: [] } });
  expect(empty.status()).toBe(400);
  const tooLong = await request.post('api/chat', { data: { messages: [{ role: 'user', content: 'x'.repeat(2001) }] } });
  expect(tooLong.status()).toBe(400);
  const wrongMethod = await request.get('api/chat');
  expect(wrongMethod.status()).toBe(405);
});

test('chat API answers in basic mode without Claude credentials', async ({ request }) => {
  test.skip(hasClaudeKey, 'A Claude key is configured; this check would make a billed API call.');
  const res = await request.post('api/chat', { data: { messages: [{ role: 'user', content: 'Khách sạn 5 sao ở Đà Nẵng' }] } });
  expect(res.status()).toBe(200);
  const events = (await res.text()).trim().split('\n').map((l) => JSON.parse(l));
  expect(events.at(-1)).toEqual({ type: 'done', mode: 'basic' });
  const text = events.filter((e) => e.type === 'text').map((e) => e.text).join('');
  expect(text).toContain('/tim-khach-san/');
  expect(text).toContain('Đà Nẵng');
});

test('chat opens full screen on mobile @mobile', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Mở trợ lý Mixivivu' }).click();
  const box = await page.getByRole('dialog', { name: 'Trợ lý Mixivivu' }).boundingBox();
  expect(box?.width).toBe(390);
  await page.getByRole('button', { name: 'Đóng trợ lý' }).click();
  await expect(page.getByRole('button', { name: 'Mở trợ lý Mixivivu' })).toBeVisible();
});
