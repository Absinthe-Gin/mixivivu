import { useEffect, useRef } from 'react';
import { publicAsset } from '@/utils/assets';
import { cx } from '@/utils/cx';
import type { useChat } from '../hooks/useChat';
import { Composer } from './Composer';
import { MessageList } from './MessageList';

export const SUGGESTIONS = [
  { title: 'Tìm du thuyền', text: 'Du thuyền có bể sục, giá dưới 4 triệu' },
  { title: 'Lên kế hoạch', text: 'Tạo kế hoạch chuyến đi Hạ Long 2 ngày 1 đêm cho 2 người' },
  { title: 'So sánh', text: 'So sánh giá trung bình khách sạn theo thành phố' },
  { title: 'Hướng dẫn', text: 'Chính sách huỷ phòng du thuyền thế nào?' },
];

interface Props {
  chat: ReturnType<typeof useChat>;
  compact?: boolean;
  greeting?: string;
  onNavigate?: () => void;
}

/** Message list + composer + welcome screen; used by the full page and the widget. */
export function ChatView({ chat, compact, greeting, onNavigate }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  // Follow the stream only while the user is at the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [chat.messages, chat.status]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const empty = !chat.messages.length && !chat.loading;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
        <div className={cx('mx-auto w-full', compact ? 'px-4 py-4' : 'max-w-3xl px-4 py-6 sm:px-6')}>
          {empty ? (
            <Welcome compact={compact} greeting={greeting} onPick={(t) => void chat.send(t)} />
          ) : (
            <MessageList messages={chat.messages} busy={chat.busy} status={chat.status} compact={compact} onDecide={(id, d) => void chat.decide(id, d)} onNavigate={onNavigate} />
          )}
          {chat.error && (
            <p role="alert" className="mt-4 rounded-xl bg-[#fef3f2] px-3 py-2 text-sm text-error-dark">
              {chat.error}
            </p>
          )}
        </div>
      </div>
      <div className={cx('shrink-0 bg-white', compact ? 'border-t border-gray-100 p-2.5' : 'px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 sm:px-6')}>
        <div className={cx('mx-auto w-full', !compact && 'max-w-3xl')}>
          <Composer busy={chat.busy} onSend={chat.send} onStop={chat.stop} compact={compact} autoFocus={!compact} />
          {!compact && <p className="mt-2 text-center text-[11px] text-gray-400">Trợ lý AI có thể nhầm lẫn. Hãy kiểm tra lại giá và chính sách trước khi đặt.</p>}
        </div>
      </div>
    </div>
  );
}

function Welcome({ compact, greeting, onPick }: { compact?: boolean; greeting?: string; onPick: (text: string) => void }) {
  return (
    <div className={cx('flex flex-col', compact ? 'gap-4' : 'gap-8 pt-[8vh]')}>
      <div className={cx('flex flex-col', compact ? 'gap-2' : 'items-center gap-3 text-center')}>
        <img src={publicAsset('assets/illustrations/mixi_transparent.png')} alt="" className={compact ? 'h-12 w-12' : 'h-16 w-16'} />
        <p className={cx('font-bold text-gray-900', compact ? 'text-lg' : 'text-2xl sm:text-[28px] sm:leading-9')}>{greeting ?? 'Hôm nay bạn muốn đi đâu?'}</p>
        <p className="max-w-md text-[15px] text-gray-600">Mình tìm du thuyền, khách sạn, lên kế hoạch chuyến đi, ghi chú và trả lời từ tài liệu của bạn.</p>
      </div>
      <div className={cx('grid gap-2', !compact && 'sm:grid-cols-2')}>
        {SUGGESTIONS.map((s) => (
          <button key={s.text} type="button" onClick={() => onPick(s.text)} className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:border-primary hover:bg-[#effcfc]">
            <span className="block text-xs font-semibold text-primary-dark">{s.title}</span>
            <span className="block text-sm text-gray-800">{s.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
