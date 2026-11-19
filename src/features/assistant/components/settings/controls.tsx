import type { ReactNode } from 'react';
import { cx } from '@/utils/cx';

export function Section({ title, description, children, action }: { title: string; description?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[17px] font-bold leading-6 text-gray-900">{title}</p>
          {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Row({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-gray-100 py-3 first:border-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {hint && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx('relative h-6 w-11 rounded-full transition-colors disabled:opacity-50', checked ? 'bg-primary-dark' : 'bg-gray-300')}
    >
      <span className={cx('absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </button>
  );
}

export function Select<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)} className="min-h-[40px] w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-primary sm:w-56">
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx('min-h-[40px] w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-primary', props.className)} />;
}

export function SmallButton({ children, onClick, danger, primary, disabled, type = 'button' }: { children: ReactNode; onClick?: () => void; danger?: boolean; primary?: boolean; disabled?: boolean; type?: 'button' | 'submit' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'min-h-[36px] rounded-full px-4 text-sm font-semibold transition-colors disabled:opacity-50',
        primary ? 'bg-primary-dark text-white hover:bg-gray-900' : danger ? 'border border-error-light text-error-dark hover:bg-[#fef3f2]' : 'border border-gray-300 text-gray-800 hover:bg-gray-50',
      )}
    >
      {children}
    </button>
  );
}

export const RISK_BADGE: Record<'A' | 'B' | 'C', { label: string; cls: string }> = {
  A: { label: 'Chỉ đọc', cls: 'bg-gray-100 text-gray-700' },
  B: { label: 'Ghi dữ liệu', cls: 'bg-info-light text-info-dark' },
  C: { label: 'Xoá / tác động lớn', cls: 'bg-[#fef3f2] text-error-dark' },
};
