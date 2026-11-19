import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '@/components/common/Icon';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { cx } from '@/utils/cx';
import { AccountDialog } from '../components/AccountDialog';
import { ChatView } from '../components/ChatView';
import { ConversationSidebar } from '../components/ConversationSidebar';
import { useAuth } from '../hooks/useAuth';
import { useChat } from '../hooks/useChat';
import { useConversations } from '../hooks/useConversations';
import { ASSISTANT_ROUTES } from '../routes';
import { assistantApi } from '../services/assistantApi';

/** Full-screen assistant: conversation sidebar (drawer on mobile) + chat. */
export function AssistantPage() {
  const { conversationId = null } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const list = useConversations();
  const [drawer, setDrawer] = useState(false);
  const [account, setAccount] = useState(false);
  const [streaming, setStreaming] = useState(true);

  useEffect(() => {
    assistantApi
      .getSettings()
      .then(({ settings }) => setStreaming(settings.streaming))
      .catch(() => undefined);
  }, []);

  const chat = useChat({
    conversationId,
    streaming,
    onConversationCreated: useCallback((id: string) => navigate(ASSISTANT_ROUTES.conversation(id), { replace: !conversationId }), [navigate, conversationId]),
    onActivity: list.refresh,
  });
  const active = list.items.find((c) => c.id === conversationId);
  useDocumentTitle(active?.title ?? 'Trợ lý');

  // The drawer locks page scroll on mobile while open.
  useEffect(() => {
    if (!drawer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [drawer]);

  const newChat = () => {
    setDrawer(false);
    navigate(ASSISTANT_ROUTES.home);
  };

  const clearContext = async () => {
    if (!conversationId) return;
    await assistantApi.clearContext(conversationId);
    chat.setError(null);
    void list.refresh();
  };

  const sidebar = (
    <ConversationSidebar
      list={list}
      activeId={conversationId}
      user={auth.user}
      onNewChat={newChat}
      onAccount={() => setAccount(true)}
      onLogout={async () => {
        await auth.logout();
        navigate(ASSISTANT_ROUTES.home);
        void list.refresh();
      }}
      onDeleted={(id) => id === conversationId && navigate(ASSISTANT_ROUTES.home)}
      onNavigate={() => setDrawer(false)}
    />
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-white">
      <aside className="hidden w-[280px] shrink-0 border-r border-gray-200 md:block">{sidebar}</aside>

      {/* Mobile drawer */}
      <div className={cx('fixed inset-0 z-modal md:hidden', drawer ? 'pointer-events-auto' : 'pointer-events-none')} aria-hidden={!drawer}>
        <div className={cx('absolute inset-0 bg-[rgb(16_24_40/0.4)] transition-opacity duration-200', drawer ? 'opacity-100' : 'opacity-0')} onClick={() => setDrawer(false)} />
        <aside
          role="dialog"
          aria-label="Danh sách cuộc trò chuyện"
          className={cx('absolute inset-y-0 left-0 w-[86%] max-w-[320px] shadow-image transition-transform duration-200 ease-out', drawer ? 'translate-x-0' : '-translate-x-full')}
        >
          {drawer && sidebar}
        </aside>
      </div>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-gray-100 px-2 pt-[env(safe-area-inset-top)] sm:px-4">
          <button type="button" onClick={() => setDrawer(true)} aria-label="Mở danh sách cuộc trò chuyện" className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 md:hidden">
            <Icon name="menu" size={20} />
          </button>
          <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-gray-900">{active?.title ?? 'Cuộc trò chuyện mới'}</p>
          {conversationId && (
            <button type="button" onClick={() => void clearContext()} title="Trợ lý sẽ không dùng các tin nhắn trước làm ngữ cảnh" className="hidden rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 sm:block">
              Xoá ngữ cảnh
            </button>
          )}
          <button type="button" onClick={newChat} aria-label="Cuộc trò chuyện mới" className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 md:hidden">
            <Icon name="plus" size={20} />
          </button>
          <Link to="/" className="hidden rounded-full px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 md:block">
            Về trang chủ
          </Link>
        </header>
        {active?.contextResetAt && <p className="border-b border-gray-100 bg-gray-50 px-4 py-1.5 text-center text-xs text-gray-500">Ngữ cảnh đã được xoá: trợ lý chỉ dùng các tin nhắn sau thời điểm này.</p>}
        <ChatView chat={chat} greeting={auth.user && !auth.user.isGuest ? `Chào ${auth.user.displayName ?? auth.user.username}, hôm nay bạn muốn đi đâu?` : undefined} />
      </main>

      <AccountDialog
        open={account}
        onClose={() => {
          setAccount(false);
          void list.refresh();
        }}
        auth={auth}
      />
    </div>
  );
}
