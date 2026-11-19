import { useState, type FormEvent } from 'react';
import { Modal } from '@/components/common/Modal';
import { TextField } from '@/components/forms/TextField';
import { cx } from '@/utils/cx';
import type { useAuth } from '../hooks/useAuth';

/** Sign in, or turn the current guest account into a named one (keeps its chats). */
export function AccountDialog({ open, onClose, auth }: { open: boolean; onClose: () => void; auth: ReturnType<typeof useAuth> }) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') await auth.login(username.trim(), password);
      else await auth.register(username.trim(), password, displayName.trim() || undefined);
      setPassword('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thành công.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} ariaLabel="Tài khoản" className="max-w-[440px]">
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-xl font-bold text-gray-900">{mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</p>
          <p className="mt-1 text-sm text-gray-600">
            {mode === 'login' ? 'Dùng lại lịch sử trò chuyện và kế hoạch trên mọi thiết bị.' : 'Các cuộc trò chuyện và kế hoạch hiện tại sẽ được giữ trong tài khoản mới.'}
          </p>
        </div>
        <div className="flex rounded-full bg-gray-100 p-1 text-sm font-semibold" role="tablist">
          {(['register', 'login'] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cx('flex-1 rounded-full py-2', mode === m ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500')}>
              {m === 'login' ? 'Đăng nhập' : 'Đăng ký'}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <TextField label="Tên đăng nhập" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required minLength={3} maxLength={32} />
          {mode === 'register' && <TextField label="Tên hiển thị (không bắt buộc)" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} />}
          <TextField label="Mật khẩu" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8} />
          {error && (
            <p role="alert" className="text-sm text-error-dark">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="min-h-[44px] rounded-full bg-primary-dark font-semibold text-white hover:bg-gray-900 disabled:opacity-60">
            {busy ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
          </button>
        </form>
      </div>
    </Modal>
  );
}
