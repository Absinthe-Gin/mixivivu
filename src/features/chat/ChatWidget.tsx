import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '@/components/common/Icon';
import { publicAsset } from '@/utils/assets';
import { cx } from '@/utils/cx';
import { streamChat, TOOL_STATUS, type ChatMessage } from './chatService';
import { Markdown } from './Markdown';

const STORAGE_KEY = 'mixivivu-clone:chat';
const GREETING: ChatMessage = {
  role: 'assistant',
  content:
    'Xin chào! Mình là trợ lý Mixivivu. Mình có thể giúp bạn **tìm du thuyền, khách sạn** phù hợp và **hướng dẫn đặt dịch vụ** trên website. Bạn cần gì nào?',
};
const SUGGESTIONS = [
  'Du thuyền có bể sục, giá dưới 4 triệu',
  'Khách sạn 5 sao ở Đà Nẵng',
  'Cách đặt phòng du thuyền?',
  'Có những hình thức thanh toán nào?',
];

function loadHistory(): ChatMessage[] {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null') as ChatMessage[] | null;
    return Array.isArray(saved) && saved.length ? saved : [GREETING];
  } catch {
    return [GREETING];
  }
}

/** Floating assistant: service search and how-to help, answers streamed from /api/chat. */
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'ai' | 'basic' | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // Storage unavailable: the chat still works for this page view.
    }
  }, [messages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, status, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    setInput('');
    setError(null);
    const history: ChatMessage[] = [...messages, { role: 'user', content: question }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setBusy(true);
    setStatus('Đang suy nghĩ…');
    const controller = new AbortController();
    abortRef.current = controller;

    let answer = '';
    const update = (content: string) =>
      setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content }]);
    try {
      // The server drops the UI-only greeting (conversations must start with a user turn).
      for await (const event of streamChat(history.filter((m) => m.content), controller.signal)) {
        if (event.type === 'text') {
          answer += event.text;
          setStatus(null);
          update(answer);
        } else if (event.type === 'tool') {
          setStatus(TOOL_STATUS[event.name] ?? 'Đang tra cứu…');
        } else if (event.type === 'done') {
          setMode(event.mode);
        } else if (event.type === 'error') {
          setError(event.message);
        }
      }
    } catch {
      if (!controller.signal.aborted) setError('Mất kết nối. Vui lòng thử lại.');
    } finally {
      // Drop an empty assistant bubble (error or stop before any text).
      if (!answer) setMessages((prev) => prev.slice(0, -1));
      setBusy(false);
      setStatus(null);
      abortRef.current = null;
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const reset = () => {
    abortRef.current?.abort();
    setMessages([GREETING]);
    setError(null);
  };

  const showSuggestions = messages.length === 1 && !busy;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Đóng trợ lý Mixivivu' : 'Mở trợ lý Mixivivu'}
        aria-expanded={open}
        aria-controls="mixivivu-chat"
        className={cx(
          'fixed bottom-4 right-4 z-[45] flex h-14 items-center gap-2 rounded-full border border-primary bg-primary pl-2 pr-5 text-primary-dark shadow-image transition-transform hover:-translate-y-0.5 lg:bottom-6 lg:right-6',
          open && 'max-sm:hidden',
        )}
      >
        <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-white">
          {open ? <Icon name="close" size={22} /> : <img src={publicAsset('assets/illustrations/mixi_transparent.png')} alt="" className="h-10 w-10 object-contain" />}
        </span>
        <span className="text-sm font-semibold">{open ? 'Đóng' : 'Hỏi Mixivivu'}</span>
      </button>

      {open && (
        <section
          id="mixivivu-chat"
          role="dialog"
          aria-label="Trợ lý Mixivivu"
          className="fixed inset-0 z-[45] flex flex-col overflow-hidden bg-white sm:inset-auto sm:bottom-24 sm:right-4 sm:h-[min(620px,calc(100vh-120px))] sm:w-[400px] sm:rounded-[24px] sm:border sm:border-gray-200 sm:shadow-image lg:right-6"
        >
          <header className="flex items-center gap-3 border-b border-gray-200 bg-primary-light px-4 py-3">
            <img src={publicAsset('assets/illustrations/mixi_transparent.png')} alt="" className="h-10 w-10 rounded-full bg-white object-contain p-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold leading-6 text-gray-900">Trợ lý Mixivivu</p>
              <p className="truncate text-xs text-primary-dark">
                {mode === 'basic' ? 'Chế độ cơ bản' : 'Tìm dịch vụ & hướng dẫn sử dụng'}
              </p>
            </div>
            <button type="button" onClick={reset} aria-label="Cuộc trò chuyện mới" title="Cuộc trò chuyện mới" className="rounded-full p-2 text-gray-700 hover:bg-white">
              <Icon name="plus" size={20} />
            </button>
            <button type="button" onClick={() => setOpen(false)} aria-label="Đóng trợ lý" className="rounded-full p-2 text-gray-700 hover:bg-white">
              <Icon name="close" size={20} />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-gray-50 px-4 py-4" aria-live="polite">
            {messages.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary-dark px-4 py-2.5 text-sm leading-5 text-white">
                  {m.content}
                </div>
              ) : m.content ? (
                <div key={i} className="max-w-[90%] rounded-2xl rounded-bl-md border border-gray-200 bg-white px-4 py-2.5 text-sm leading-[22px] text-gray-800 shadow-xs">
                  <Markdown text={m.content} onNavigate={() => window.innerWidth < 481 && setOpen(false)} />
                </div>
              ) : null,
            )}
            {status && (
              <div role="status" className="flex items-center gap-2 text-sm text-gray-500">
                <span className="flex gap-1" aria-hidden="true">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </span>
                {status}
              </div>
            )}
            {error && (
              <p role="alert" className="rounded-xl bg-error-light px-3 py-2 text-sm text-error-dark">
                {error}
              </p>
            )}
            {showSuggestions && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="rounded-full border border-primary bg-white px-3 py-1.5 text-left text-sm text-primary-dark hover:bg-primary-light"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-gray-200 bg-white p-3">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              maxLength={2000}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="Nhập câu hỏi của bạn…"
              aria-label="Câu hỏi cho trợ lý"
              className="max-h-28 min-h-[44px] flex-1 resize-none rounded-[22px] border border-gray-200 px-4 py-2.5 text-sm leading-5 text-gray-800 outline-none placeholder:text-gray-400 focus:border-primary focus:shadow-[0_0_0_4px_var(--primary-light)]"
            />
            {busy ? (
              <button type="button" onClick={() => abortRef.current?.abort()} aria-label="Dừng trả lời" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-800">
                <span className="h-3.5 w-3.5 rounded-sm bg-gray-800" />
              </button>
            ) : (
              <button type="submit" disabled={!input.trim()} aria-label="Gửi câu hỏi" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-dark hover:bg-primary-dark hover:text-white disabled:bg-primary-light disabled:text-gray-400">
                <Icon name="arrowRight" size={20} />
              </button>
            )}
          </form>
          <p className="bg-white px-4 pb-2 text-center text-[11px] text-gray-400">Trợ lý AI có thể nhầm lẫn. Vui lòng kiểm tra lại giá và chính sách trước khi đặt.</p>
        </section>
      )}
    </>
  );
}
