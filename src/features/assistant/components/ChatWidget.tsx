import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from '@/components/common/Icon';
import { publicAsset } from '@/utils/assets';
import { cx } from '@/utils/cx';
import { useChat } from '../hooks/useChat';
import { ASSISTANT_ROUTES } from '../routes';
import { ChatView } from './ChatView';

const STORAGE_KEY = 'mixivivu:assistant:widget-conversation';

const readStored = () => {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

/**
 * Floating assistant on every site page. Same agent and history as the
 * full-screen page (/tro-ly); it also tells the agent which page the user
 * is on so "chiếc tàu này" can be resolved.
 */
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(readStored);
  const location = useLocation();

  useEffect(() => {
    try {
      if (conversationId) sessionStorage.setItem(STORAGE_KEY, conversationId);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage unavailable: the widget still works for this page view.
    }
  }, [conversationId]);

  const appContext = useCallback(() => ({ path: location.pathname, title: document.title }), [location.pathname]);
  const chat = useChat({ conversationId, onConversationCreated: setConversationId, appContext });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // A stale id (deleted elsewhere) starts a fresh conversation.
  useEffect(() => {
    if (chat.error === 'Không tìm thấy cuộc trò chuyện.') {
      setConversationId(null);
      chat.setError(null);
    }
  }, [chat]);

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
          className="fixed inset-0 z-[45] flex h-[100dvh] flex-col overflow-hidden bg-white sm:inset-auto sm:bottom-24 sm:right-4 sm:h-[min(640px,calc(100vh-120px))] sm:w-[420px] sm:rounded-[24px] sm:border sm:border-gray-200 sm:shadow-image lg:right-6"
        >
          <header className="flex shrink-0 items-center gap-2 border-b border-gray-100 bg-[#effcfc] px-3 pb-2.5 pt-[max(10px,env(safe-area-inset-top))]">
            <img src={publicAsset('assets/illustrations/mixi_transparent.png')} alt="" className="h-9 w-9 rounded-full bg-white object-contain p-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold leading-5 text-gray-900">Trợ lý Mixivivu</p>
              <p className="truncate text-xs text-primary-dark">{chat.mode === 'basic' ? 'Chế độ cơ bản' : 'Tìm dịch vụ, lên kế hoạch, ghi chú'}</p>
            </div>
            <Link to={conversationId ? ASSISTANT_ROUTES.conversation(conversationId) : ASSISTANT_ROUTES.home} onClick={() => setOpen(false)} aria-label="Mở toàn màn hình" title="Mở toàn màn hình" className="rounded-full p-2 text-gray-700 hover:bg-white">
              <Icon name="expand" size={18} />
            </Link>
            <button type="button" onClick={() => (chat.stop(), setConversationId(null))} aria-label="Cuộc trò chuyện mới" title="Cuộc trò chuyện mới" className="rounded-full p-2 text-gray-700 hover:bg-white">
              <Icon name="plus" size={20} />
            </button>
            <button type="button" onClick={() => setOpen(false)} aria-label="Đóng trợ lý" className="rounded-full p-2 text-gray-700 hover:bg-white">
              <Icon name="close" size={20} />
            </button>
          </header>
          <ChatView
            chat={chat}
            compact
            greeting="Xin chào! Mình là trợ lý Mixivivu."
            onNavigate={() => window.innerWidth < 481 && setOpen(false)}
          />
        </section>
      )}
    </>
  );
}
