import { publicAsset } from '@/utils/assets';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type ChatEvent =
  | { type: 'text'; text: string }
  | { type: 'tool'; name: string }
  | { type: 'done'; mode: 'ai' | 'basic' }
  | { type: 'error'; message: string };

/** POST the conversation and yield streamed NDJSON events from /api/chat. */
export async function* streamChat(messages: ChatMessage[], signal: AbortSignal): AsyncGenerator<ChatEvent> {
  const res = await fetch(publicAsset('api/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    signal,
  });
  if (!res.ok || !res.body) {
    let message = 'Không gửi được tin nhắn. Vui lòng thử lại.';
    try {
      message = ((await res.json()) as { error?: string }).error ?? message;
    } catch {
      // Non-JSON error body: keep the generic message.
    }
    yield { type: 'error', message };
    return;
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) yield JSON.parse(line) as ChatEvent;
    }
  }
}

export const TOOL_STATUS: Record<string, string> = {
  search_ships: 'Đang tìm du thuyền…',
  get_ship_details: 'Đang xem chi tiết du thuyền…',
  search_hotels: 'Đang tìm khách sạn…',
  get_hotel_details: 'Đang xem chi tiết khách sạn…',
  search_help: 'Đang tra cứu hướng dẫn…',
};
