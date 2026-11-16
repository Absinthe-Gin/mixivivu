import { cx } from '@/utils/cx';

export interface TabItem<V extends string> {
  value: V;
  label: string;
  count?: number;
}

interface TabsProps<V extends string> {
  items: TabItem<V>[];
  value: V;
  onChange: (value: V) => void;
  className?: string;
  ariaLabel: string;
}

/** Segmented tab bar on a gray-50 rail (blog filters, detail page anchors). */
export function Tabs<V extends string>({ items, value, onChange, className, ariaLabel }: TabsProps<V>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cx('flex gap-2 overflow-x-auto rounded-lg border border-gray-100 bg-gray-50 p-1.5', className)}
    >
      {items.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cx(
              'flex shrink-0 items-center gap-2 !rounded-md px-3 py-2 text-sm leading-5 transition-colors',
              active ? 'bg-white font-medium text-gray-700 shadow-sm' : 'text-gray-500 !shadow-none hover:text-gray-700',
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
