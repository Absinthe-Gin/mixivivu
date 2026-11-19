import { Icon } from '@/components/common/Icon';
import { cx } from '@/utils/cx';
import type { ConfirmationView } from '../types';

const STATUS_TEXT: Record<ConfirmationView['status'], string> = {
  pending: '',
  executing: 'Đang thực hiện…',
  confirmed: 'Đã xác nhận và thực hiện',
  cancelled: 'Đã huỷ — không có thay đổi nào',
  expired: 'Đã hết hạn — không có thay đổi nào',
};

/**
 * Confirmation card for an action the assistant wants to perform. The
 * action only runs when the server receives this card's decision.
 */
export function ActionCard({ confirmation, onDecide, disabled }: { confirmation: ConfirmationView; onDecide: (id: string, d: 'confirm' | 'cancel') => void; disabled?: boolean }) {
  const { preview, status } = confirmation;
  const destructive = preview.risk === 'destructive';
  const pending = status === 'pending';
  const expired = pending && new Date(confirmation.expiresAt).getTime() < Date.now();

  return (
    <section
      aria-label={`Xác nhận: ${preview.title}`}
      className={cx('rounded-2xl border bg-white p-4 shadow-xs', destructive ? 'border-error-light' : 'border-gray-200', !pending && 'opacity-80')}
    >
      <div className="flex items-start gap-3">
        <span className={cx('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', destructive ? 'bg-[#fef3f2] text-error-dark' : 'bg-primary-light text-primary-dark')}>
          <Icon name={destructive ? 'alert' : 'edit'} size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-6 text-gray-900">{preview.title}</p>
          {preview.target && <p className="truncate text-sm text-gray-600">{preview.target}</p>}
        </div>
      </div>

      {!!preview.changes?.length && (
        <dl className="mt-3 divide-y divide-gray-100 rounded-xl bg-gray-50 px-3 text-sm">
          {preview.changes.map((c, i) => (
            <div key={i} className="grid grid-cols-[96px_1fr] gap-2 py-2 sm:grid-cols-[120px_1fr]">
              <dt className="text-gray-500">{c.field}</dt>
              <dd className="min-w-0 break-words text-gray-900">
                {c.before != null && c.before !== c.after && (
                  <>
                    <span className="text-gray-400 line-through">{c.before || '—'}</span>
                    <span className="mx-1.5 text-gray-400" aria-label="thành">→</span>
                  </>
                )}
                <span className="font-medium">{c.after || '—'}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}

      <p className={cx('mt-3 text-sm', destructive ? 'text-error-dark' : 'text-gray-600')}>{preview.consequence}</p>

      {pending && !expired ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onDecide(confirmation.id, 'confirm')}
            className={cx(
              'min-h-[40px] rounded-full px-5 text-sm font-semibold transition-colors disabled:opacity-50',
              destructive ? 'bg-error-base text-white hover:bg-error-dark' : 'bg-primary-dark text-white hover:bg-gray-900',
            )}
          >
            {destructive ? 'Xác nhận xoá' : 'Xác nhận'}
          </button>
          <button type="button" disabled={disabled} onClick={() => onDecide(confirmation.id, 'cancel')} className="min-h-[40px] rounded-full border border-gray-300 px-5 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50">
            Huỷ
          </button>
        </div>
      ) : (
        <p role="status" className="mt-3 flex items-center gap-1.5 text-sm font-medium text-gray-600">
          {status === 'confirmed' && <Icon name="check" size={16} className="text-success-base" />}
          {expired ? STATUS_TEXT.expired : STATUS_TEXT[status]}
        </p>
      )}
    </section>
  );
}
