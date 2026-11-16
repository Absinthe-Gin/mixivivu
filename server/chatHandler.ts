/**
 * POST /api/chat - Mixivivu assistant.
 *
 * Streams newline-delimited JSON events to the browser:
 *   {"type":"tool","name":"search_ships"}   a tool started (UI shows a status)
 *   {"type":"text","text":"..."}           answer text delta
 *   {"type":"done","mode":"ai"|"basic"}    end of answer
 *   {"type":"error","message":"..."}       failure (shown to the user)
 *
 * The API key stays on the server. Without Claude credentials the handler
 * answers in "basic" mode with keyword search over the same data.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import Anthropic from '@anthropic-ai/sdk';
import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema';
import { hotelDetails, searchHelp, searchHotels, searchShips, shipDetails } from './catalog.ts';
import { basicAnswer } from './basicMode.ts';

const MODEL = 'claude-opus-5-5';
const MAX_MESSAGES = 20;
const MAX_CHARS = 2000;
const RATE_LIMIT = { windowMs: 5 * 60_000, max: 20 };

const SYSTEM_PROMPT = `Bạn là trợ lý ảo của Mixivivu - website đặt du thuyền Hạ Long, khách sạn và vé máy bay. Bạn giúp khách tìm dịch vụ phù hợp và hướng dẫn cách dùng website.

Cách làm việc:
- Mọi thông tin về du thuyền, khách sạn, giá, phòng, tiện ích phải lấy từ công cụ (search_ships, get_ship_details, search_hotels, get_hotel_details). Không tự bịa tên, giá hay chính sách.
- Câu hỏi về cách đặt, thanh toán, huỷ đổi, quy định, liên hệ, cách dùng website: dùng search_help và trả lời theo nội dung tìm được.
- Khi khách mô tả nhu cầu mơ hồ (ví dụ "tàu cho gia đình 4 người, tầm 4 triệu"), cứ tìm với tiêu chí hợp lý rồi đề xuất 2-4 lựa chọn; chỉ hỏi lại khi thật sự thiếu thông tin quan trọng.
- Mỗi dịch vụ được nhắc đến kèm liên kết Markdown dùng đúng trường "link" của công cụ, ví dụ [Du thuyền Ambassador Hạ Long](/du-thuyen/president-cruises-halong). Không dùng URL tuyệt đối.
- Giá ghi theo đơn vị của dữ liệu (đ/khách cho du thuyền, đ/phòng cho khách sạn) và nói rõ là giá tham khảo.
- Để đặt chỗ: hướng dẫn khách mở trang chi tiết và bấm "Đặt ngay", hoặc gọi hotline 0922222016. Bạn không tự đặt chỗ hay nhận thanh toán.
- Vé máy bay: website không có giá vé trực tuyến; hướng dẫn dùng trang /tim-ve-may-bay và gọi hotline để được báo giá.
- Câu hỏi ngoài phạm vi du lịch của Mixivivu: trả lời ngắn gọn rằng bạn chỉ hỗ trợ các dịch vụ của Mixivivu.
- Không hỏi hay ghi nhận thông tin cá nhân (số điện thoại, email) trong khung chat; khách nhập các thông tin đó vào form đặt chỗ.

Trình bày: trả lời bằng ngôn ngữ khách dùng (mặc định tiếng Việt), ngắn gọn, thân thiện. Dùng danh sách gạch đầu dòng khi liệt kê lựa chọn, in đậm tên dịch vụ, không dùng bảng hay tiêu đề lớn.`;

// ---------- tools ----------

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : undefined);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const strList = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 6) : undefined);
const json = (v: unknown) => JSON.stringify(v);

const tools = [
  betaTool({
    name: 'search_ships',
    description:
      'Tìm du thuyền Hạ Long theo tên, điểm đến, khoảng giá (VND mỗi khách), điểm đánh giá tối thiểu và tiện ích. Trả về tổng số kết quả và danh sách rút gọn kèm link và slug.',
    eager_input_streaming: true,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Một phần tên du thuyền, ví dụ "Ambassador"' },
        destination: { type: 'string', description: 'Vịnh Hạ Long, Vịnh Lan Hạ hoặc Đảo Cát Bà' },
        min_price: { type: 'number', description: 'Giá tối thiểu mỗi khách (VND)' },
        max_price: { type: 'number', description: 'Giá tối đa mỗi khách (VND)' },
        min_rating: { type: 'number', description: 'Điểm đánh giá tối thiểu, 0-5' },
        amenities: { type: 'array', items: { type: 'string' }, description: 'Tiện ích cần có, ví dụ ["bể sục", "bể bơi"]' },
        sort: { type: 'string', enum: ['price_asc', 'price_desc', 'rating'] },
        limit: { type: 'number', description: 'Số kết quả, tối đa 10 (mặc định 5)' },
      },
      additionalProperties: false,
    },
    run: (i) =>
      json(
        searchShips({
          query: str(i.query),
          destination: str(i.destination),
          min_price: num(i.min_price),
          max_price: num(i.max_price),
          min_rating: num(i.min_rating),
          amenities: strList(i.amenities),
          sort: i.sort === 'price_asc' || i.sort === 'price_desc' || i.sort === 'rating' ? i.sort : undefined,
          limit: num(i.limit),
        }),
      ),
  }),
  betaTool({
    name: 'get_ship_details',
    description: 'Lấy chi tiết một du thuyền: cảng xuất phát, lịch trình, hành trình, các loại phòng và giá, tiện ích, điểm nổi bật, mô tả.',
    eager_input_streaming: true,
    inputSchema: {
      type: 'object',
      properties: { slug: { type: 'string', description: 'Trường slug lấy từ search_ships' } },
      required: ['slug'],
      additionalProperties: false,
    },
    run: (i) => {
      const slug = str(i.slug);
      return json(slug ? shipDetails(slug) : { error: 'Thiếu slug' });
    },
  }),
  betaTool({
    name: 'search_hotels',
    description:
      'Tìm khách sạn theo tên, thành phố (Hạ Long, Đà Nẵng, Nha Trang, Phú Quốc, Sapa, Hội An...), khoảng giá (VND mỗi phòng mỗi đêm), hạng sao và tiện ích.',
    eager_input_streaming: true,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Một phần tên khách sạn' },
        city: { type: 'string', description: 'Tên thành phố' },
        min_price: { type: 'number' },
        max_price: { type: 'number' },
        stars: { type: 'number', description: 'Hạng sao: 3, 4 hoặc 5' },
        amenities: { type: 'array', items: { type: 'string' } },
        sort: { type: 'string', enum: ['price_asc', 'price_desc'] },
        limit: { type: 'number', description: 'Số kết quả, tối đa 10 (mặc định 5)' },
      },
      additionalProperties: false,
    },
    run: (i) =>
      json(
        searchHotels({
          query: str(i.query),
          city: str(i.city),
          min_price: num(i.min_price),
          max_price: num(i.max_price),
          stars: num(i.stars),
          amenities: strList(i.amenities),
          sort: i.sort === 'price_asc' || i.sort === 'price_desc' ? i.sort : undefined,
          limit: num(i.limit),
        }),
      ),
  }),
  betaTool({
    name: 'get_hotel_details',
    description: 'Lấy chi tiết một khách sạn: địa chỉ, hạng sao, các loại phòng và giá, tiện ích, mô tả.',
    eager_input_streaming: true,
    inputSchema: {
      type: 'object',
      properties: { slug: { type: 'string', description: 'Trường slug lấy từ search_hotels' } },
      required: ['slug'],
      additionalProperties: false,
    },
    run: (i) => {
      const slug = str(i.slug);
      return json(slug ? hotelDetails(slug) : { error: 'Thiếu slug' });
    },
  }),
  betaTool({
    name: 'search_help',
    description:
      'Tra cứu hướng dẫn sử dụng website, câu hỏi thường gặp, quy định chung, chính sách huỷ/đổi, hình thức thanh toán, điều khoản và thông tin liên hệ.',
    eager_input_streaming: true,
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Chủ đề cần tra, ví dụ "huỷ phòng", "thanh toán chuyển khoản", "trẻ em"' } },
      required: ['query'],
      additionalProperties: false,
    },
    run: (i) => json(searchHelp(str(i.query, 300) ?? '')),
  }),
];

// ---------- request validation and rate limiting ----------

type ChatTurn = { role: 'user' | 'assistant'; content: string };

function parseHistory(body: unknown): ChatTurn[] | string {
  const raw = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(raw) || raw.length === 0) return 'Thiếu nội dung tin nhắn.';
  const turns = raw.slice(-MAX_MESSAGES).filter(
    (m): m is ChatTurn =>
      !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim().length > 0,
  );
  while (turns.length && turns[0].role !== 'user') turns.shift();
  const last = turns[turns.length - 1];
  if (!last || last.role !== 'user') return 'Tin nhắn cuối phải là câu hỏi của bạn.';
  if (last.content.length > MAX_CHARS) return `Tin nhắn quá dài (tối đa ${MAX_CHARS} ký tự).`;
  return turns.map((t) => ({ role: t.role, content: t.content.slice(0, MAX_CHARS * 2) }));
}

const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT.max;
}

async function readBody(req: IncomingMessage, limit = 64_000): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new Error('too large');
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

// ---------- Claude ----------

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

/** True when the failure means "no usable credentials", so basic mode can answer. */
function isCredentialError(err: unknown): boolean {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return true;
  return err instanceof Anthropic.AnthropicError && !(err instanceof Anthropic.APIError) && /auth|api key|credential/i.test(err.message);
}

async function streamClaude(history: ChatTurn[], send: (e: object) => void, signal: AbortSignal): Promise<void> {
  const anthropic = getClient();
  const params = {
    model: MODEL,
    max_tokens: 8000,
    // Chat answers with tool lookups: low effort keeps replies fast; raise it if answers get shallow.
    output_config: { effort: 'low' as const },
    // Re-route policy refusals to a fallback model instead of failing the turn.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default' as const,
    cache_control: { type: 'ephemeral' as const },
    system: SYSTEM_PROMPT,
    tools,
    messages: history.map((t) => ({ role: t.role, content: t.content })),
    stream: true as const,
  };

  let runner = anthropic.beta.messages.toolRunner(params, { signal });
  let wroteText = false;

  for (let attempt = 0; ; attempt++) {
    try {
      for await (const messageStream of runner) {
        for await (const event of messageStream) {
          if (event.type === 'content_block_start') {
            if (event.content_block.type === 'tool_use') send({ type: 'tool', name: event.content_block.name });
            if (event.content_block.type === 'text' && wroteText) send({ type: 'text', text: '\n\n' });
          } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            wroteText = true;
            send({ type: 'text', text: event.delta.text });
          }
        }
        const message = await messageStream.finalMessage();
        attempt = 0;
        if (message.stop_reason === 'refusal') {
          send({ type: 'text', text: (wroteText ? '\n\n' : '') + 'Xin lỗi, mình không thể hỗ trợ yêu cầu này. Bạn có thể hỏi về du thuyền, khách sạn hoặc cách đặt dịch vụ trên Mixivivu.' });
          return;
        }
        if (message.stop_reason === 'max_tokens' && message.content.some((b) => b.type === 'tool_use')) {
          throw new Error('Câu trả lời quá dài, bạn thử hỏi ngắn gọn hơn nhé.');
        }
      }
      return;
    } catch (err) {
      // Only an unparseable streamed tool input is retried; API errors propagate.
      if (err instanceof Anthropic.APIError || !(err instanceof Anthropic.AnthropicError) || attempt >= 2) throw err;
      runner = anthropic.beta.messages.toolRunner({ ...runner.params, stream: true }, { signal });
    }
  }
}

// ---------- HTTP handler ----------

export async function handleChat(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end();
    return;
  }
  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const reply = (status: number, message: string) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: message }));
  };
  if (rateLimited(ip)) return reply(429, 'Bạn gửi quá nhiều tin nhắn. Vui lòng thử lại sau ít phút.');

  let history: ChatTurn[] | string;
  try {
    history = parseHistory(await readBody(req));
  } catch {
    return reply(400, 'Yêu cầu không hợp lệ.');
  }
  if (typeof history === 'string') return reply(400, history);

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  const send = (e: object) => res.write(`${JSON.stringify(e)}\n`);

  const abort = new AbortController();
  res.on('close', () => abort.abort());
  let sentAnything = false;
  const tracked = (e: object) => {
    sentAnything = true;
    send(e);
  };

  try {
    if (process.env.MIXIVIVU_CHAT_MODE === 'basic') throw new Anthropic.AuthenticationError(401, undefined, 'basic mode forced', new Headers());
    await streamClaude(history, tracked, abort.signal);
    send({ type: 'done', mode: 'ai' });
  } catch (err) {
    if (abort.signal.aborted) return;
    if (!sentAnything && isCredentialError(err)) {
      send({ type: 'text', text: basicAnswer(history[history.length - 1].content) });
      send({ type: 'done', mode: 'basic' });
    } else {
      console.error('[chat]', err);
      const message =
        err instanceof Anthropic.RateLimitError
          ? 'Hệ thống đang bận, bạn thử lại sau ít phút nhé.'
          : err instanceof Anthropic.APIConnectionError
            ? 'Không kết nối được tới máy chủ AI. Vui lòng thử lại.'
            : 'Trợ lý gặp sự cố. Bạn có thể gọi hotline 0922222016 để được hỗ trợ.';
      send({ type: 'error', message });
    }
  } finally {
    res.end();
  }
}
