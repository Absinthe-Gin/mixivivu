import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Icon, type IconName } from '@/components/common/Icon';
import { useClickOutside } from '@/hooks/useClickOutside';
import { publicAsset } from '@/utils/assets';
import { cx } from '@/utils/cx';
import type { useConversations } from '../hooks/useConversations';
import type { AuthUser, Conversation } from '../types';
import { ASSISTANT_ROUTES } from '../routes';

interface Props {
  list: ReturnType<typeof useConversations>;
  activeId: string | null;
  user: AuthUser | null;
  onNewChat: () => void;
  onAccount: () => void;
  onLogout: () => void;
  onDeleted: (id: string) => void;
  onNavigate?: () => void;
}

export function ConversationSidebar({ list, activeId, user, onNewChat, onAccount, onLogout, onDeleted, onNavigate }: Props) {
  const pinned = list.items.filter((c) => c.pinned);
  const recent = list.items.filter((c) => !c.pinned);
  return (
    <div className="flex h-full flex-col bg-gray-50">
      <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-[max(16px,env(safe-area-inset-top))]">
        <Link to="/" className="flex items-center gap-2" aria-label="Về trang chủ Mixivivu">
          <img src={publicAsset('assets/illustrations/mixi_transparent.png')} alt="" className="h-8 w-8" />
          <span className="text-[15px] font-bold text-gray-900">Trợ lý Mixivivu</span>
        </Link>
      </div>
      <div className="px-3">
        <button type="button" onClick={onNewChat} className="flex w-full items-center gap-2 rounded-xl bg-primary-dark px-3 py-2.5 text-sm font-semibold text-white hover:bg-gray-900">
          <Icon name="plus" size={18} /> Cuộc trò chuyện mới
        </button>
        <label className="mt-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus-within:border-primary">
          <Icon name="search" size={16} className="text-gray-400" />
          <input value={list.query} onChange={(e) => list.setQuery(e.target.value)} placeholder="Tìm cuộc trò chuyện" aria-label="Tìm cuộc trò chuyện" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-gray-400" />
        </label>
      </div>

      <nav aria-label="Cuộc trò chuyện" className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {list.error && <p className="px-2 text-sm text-error-dark">{list.error}</p>}
        {!list.loading && !list.items.length && (
          <p className="px-3 py-6 text-center text-sm text-gray-500">{list.query ? 'Không tìm thấy cuộc trò chuyện.' : list.archived ? 'Chưa có cuộc trò chuyện lưu trữ.' : 'Chưa có cuộc trò chuyện nào.'}</p>
        )}
        {!!pinned.length && <Group title="Đã ghim" items={pinned} {...{ activeId, list, onDeleted, onNavigate }} />}
        {!!recent.length && <Group title={list.archived ? 'Lưu trữ' : 'Gần đây'} items={recent} {...{ activeId, list, onDeleted, onNavigate }} />}
      </nav>

      <div className="border-t border-gray-200 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
        <button type="button" onClick={() => list.setArchived(!list.archived)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-gray-700 hover:bg-gray-100" aria-pressed={list.archived}>
          <Icon name="archive" size={16} /> {list.archived ? 'Xem cuộc trò chuyện gần đây' : 'Cuộc trò chuyện lưu trữ'}
        </button>
        <NavLink to={ASSISTANT_ROUTES.settings} onClick={onNavigate} className={({ isActive }) => cx('flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-gray-100', isActive ? 'font-semibold text-gray-900' : 'text-gray-700')}>
          <Icon name="settings" size={16} /> Cài đặt
        </NavLink>
        <div className="mt-1 flex items-center gap-2 rounded-lg px-2 py-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-sm font-bold uppercase text-primary-dark">{(user?.displayName ?? user?.username ?? 'K').slice(0, 1)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">{user?.isGuest ? 'Khách' : (user?.displayName ?? user?.username)}</p>
            <p className="truncate text-xs text-gray-500">{user?.isGuest ? 'Dữ liệu lưu trên thiết bị này' : user?.role === 'admin' ? 'Quản trị viên' : 'Đã đăng nhập'}</p>
          </div>
          {user?.isGuest ? (
            <button type="button" onClick={onAccount} className="rounded-full border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-800 hover:bg-white">
              Đăng nhập
            </button>
          ) : (
            <button type="button" onClick={onLogout} aria-label="Đăng xuất" title="Đăng xuất" className="rounded-full p-1.5 text-gray-500 hover:bg-white hover:text-gray-900">
              <Icon name="logout" size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Group({ title, items, activeId, list, onDeleted, onNavigate }: { title: string; items: Conversation[]; activeId: string | null; list: Props['list']; onDeleted: (id: string) => void; onNavigate?: () => void }) {
  return (
    <div className="mb-3">
      <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{title}</p>
      <ul className="flex flex-col gap-0.5">
        {items.map((c) => (
          <Item key={c.id} c={c} active={c.id === activeId} list={list} onDeleted={onDeleted} onNavigate={onNavigate} />
        ))}
      </ul>
    </div>
  );
}

function Item({ c, active, list, onDeleted, onNavigate }: { c: Conversation; active: boolean; list: Props['list']; onDeleted: (id: string) => void; onNavigate?: () => void }) {
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [title, setTitle] = useState(c.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeMenu = useCallback(() => {
    setMenu(false);
    setConfirmDelete(false);
  }, []);
  const ref = useClickOutside<HTMLLIElement>(closeMenu, menu);
  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);

  const saveTitle = async () => {
    setRenaming(false);
    if (title.trim() && title.trim() !== c.title) await list.update(c.id, { title: title.trim() });
    else setTitle(c.title);
  };

  const action = (icon: IconName, label: string, fn: () => void, danger = false) => (
    <button type="button" role="menuitem" onClick={fn} className={cx('flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-gray-100', danger ? 'text-error-dark' : 'text-gray-800')}>
      <Icon name={icon} size={15} /> {label}
    </button>
  );

  return (
    <li ref={ref} className="group relative">
      {renaming ? (
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void saveTitle()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void saveTitle();
            if (e.key === 'Escape') {
              setTitle(c.title);
              setRenaming(false);
            }
          }}
          aria-label="Tên cuộc trò chuyện"
          maxLength={120}
          className="w-full rounded-lg border border-primary bg-white px-2.5 py-2 text-sm outline-none"
        />
      ) : (
        <Link
          to={ASSISTANT_ROUTES.conversation(c.id)}
          onClick={onNavigate}
          aria-current={active ? 'page' : undefined}
          className={cx('flex items-center gap-1.5 rounded-lg py-2 pl-2.5 pr-9 text-sm', active ? 'bg-white font-semibold text-gray-900 shadow-xs' : 'text-gray-700 hover:bg-gray-100')}
        >
          {c.pinned && <Icon name="pin" size={12} className="shrink-0 text-gray-400" />}
          <span className="truncate">{c.title}</span>
        </Link>
      )}
      {!renaming && (
        <button
          type="button"
          aria-label={`Tuỳ chọn cho ${c.title}`}
          aria-haspopup="menu"
          aria-expanded={menu}
          onClick={() => setMenu((m) => !m)}
          className={cx('absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-500 hover:bg-gray-200', menu || active ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100')}
        >
          <Icon name="more" size={16} strokeWidth={2.5} />
        </button>
      )}
      {menu && (
        <div role="menu" className="absolute right-1 top-full z-dropdown mt-1 w-48 rounded-xl border border-gray-200 bg-white p-1 shadow-dropdown">
          {confirmDelete ? (
            <div className="p-2">
              <p className="text-sm text-gray-800">Xoá cuộc trò chuyện này?</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    setMenu(false);
                    await list.remove(c.id);
                    onDeleted(c.id);
                  }}
                  className="flex-1 rounded-full bg-error-base py-1.5 text-xs font-semibold text-white"
                >
                  Xoá
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="flex-1 rounded-full border border-gray-300 py-1.5 text-xs font-semibold">
                  Không
                </button>
              </div>
            </div>
          ) : (
            <>
              {action('edit', 'Đổi tên', () => {
                setMenu(false);
                setRenaming(true);
              })}
              {action('pin', c.pinned ? 'Bỏ ghim' : 'Ghim', () => {
                setMenu(false);
                void list.update(c.id, { pinned: !c.pinned });
              })}
              {action('archive', c.archived ? 'Bỏ lưu trữ' : 'Lưu trữ', () => {
                setMenu(false);
                void list.update(c.id, { archived: !c.archived });
              })}
              {action('trash', 'Xoá', () => setConfirmDelete(true), true)}
            </>
          )}
        </div>
      )}
    </li>
  );
}
