import { Link } from 'react-router-dom';
import { Icon } from '@/components/common/Icon';
import { cx } from '@/utils/cx';
import type { Citation, ResultCard, ToolStep } from '../types';

const DONE = new Set(['succeeded']);
const FAILED = new Set(['failed', 'rejected']);

/** Tool execution timeline ("Đang tìm du thuyền…" → "Đã tìm thấy 3 du thuyền"). */
export function ToolSteps({ steps }: { steps: ToolStep[] }) {
  if (!steps.length) return null;
  return (
    <ul className="flex flex-col gap-1" aria-label="Các bước đã thực hiện">
      {steps.map((s) => {
        const running = s.status === 'running';
        return (
          <li key={s.callId} className="flex items-center gap-2 text-[13px] leading-5 text-gray-500">
            <span
              className={cx(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                running && 'border-2 border-primary border-t-transparent motion-safe:animate-spin',
                DONE.has(s.status) && 'bg-success-light text-success-dark',
                FAILED.has(s.status) && 'bg-error-light text-error-dark',
                (s.status === 'awaiting_confirmation' || s.status === 'cancelled') && 'bg-warning-light text-warning-dark',
              )}
              aria-hidden="true"
            >
              {DONE.has(s.status) && <Icon name="check" size={10} strokeWidth={3} />}
              {FAILED.has(s.status) && <Icon name="close" size={10} strokeWidth={3} />}
              {(s.status === 'awaiting_confirmation' || s.status === 'cancelled') && <span className="h-1 w-1 rounded-full bg-current" />}
            </span>
            <span className={cx(running && 'text-gray-700')}>{running ? s.label : s.summary || s.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function ResultCards({ cards, onNavigate }: { cards: ResultCard[]; onNavigate?: () => void }) {
  if (!cards.length) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {cards.map((c, i) => {
        const body = (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-dark">{c.subtitle || c.kind}</p>
            <p className="mt-0.5 font-semibold leading-5 text-gray-900">{c.title}</p>
            {!!c.fields?.length && (
              <dl className="mt-2 space-y-1 text-[13px]">
                {c.fields.map((f) => (
                  <div key={f.label} className="flex gap-2">
                    <dt className="shrink-0 text-gray-500">{f.label}:</dt>
                    <dd className="min-w-0 truncate text-gray-800">{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </>
        );
        const cls = 'block rounded-2xl border border-gray-200 bg-white p-3 text-sm shadow-xs';
        return c.link ? (
          <Link key={i} to={c.link} onClick={onNavigate} className={cx(cls, 'transition-colors hover:border-primary')}>
            {body}
          </Link>
        ) : (
          <div key={i} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

const SOURCE_LABEL: Record<Citation['sourceType'], string> = { blog: 'Blog', help: 'Hướng dẫn', upload: 'Tài liệu của bạn', web: 'Internet', catalog: 'Mixivivu' };

export function Citations({ citations, onNavigate }: { citations: Citation[]; onNavigate?: () => void }) {
  if (!citations.length) return null;
  return (
    <div className="border-t border-gray-100 pt-2">
      <p className="mb-1.5 text-xs font-semibold text-gray-500">Nguồn tham khảo</p>
      <ol className="flex flex-col gap-1">
        {citations.map((c) => {
          const label = (
            <>
              <span className="mr-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded bg-gray-100 px-1 text-[10px] font-semibold text-gray-600">{c.n}</span>
              <span className="text-gray-800">{c.title}</span>
              <span className={cx('ml-1.5 text-[11px]', c.sourceType === 'web' ? 'text-info-base' : 'text-gray-400')}>· {SOURCE_LABEL[c.sourceType]}</span>
            </>
          );
          const external = c.link && /^https?:/.test(c.link);
          return (
            <li key={c.n} id={`cite-${c.n}`} className="text-[13px] leading-5">
              {c.link ? (
                external ? (
                  <a href={c.link} target="_blank" rel="noopener noreferrer nofollow" className="hover:underline">
                    {label}
                  </a>
                ) : (
                  <Link to={c.link} onClick={onNavigate} className="hover:underline">
                    {label}
                  </Link>
                )
              ) : (
                label
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
