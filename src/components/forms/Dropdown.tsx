import { useState, type ReactNode } from 'react';
import { Icon } from '@/components/common/Icon';
import { useClickOutside } from '@/hooks/useClickOutside';
import { cx } from '@/utils/cx';

export interface DropdownOption<V> {
  label: string;
  value: V;
}

interface DropdownProps<V> {
  options: DropdownOption<V>[];
  value: V;
  onChange: (value: V) => void;
  icon?: ReactNode;
  className?: string;
  menuClassName?: string;
  align?: 'left' | 'right';
  ariaLabel: string;
}

/** Pill trigger with a floating option list (search box, sort selector). */
export function Dropdown<V>({ options, value, onChange, icon, className, menuClassName, align = 'left', ariaLabel }: DropdownProps<V>) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), open);
  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <div ref={ref} className={cx('relative', className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={cx(
          'flex w-full items-center gap-2 rounded-input border bg-white px-5 py-4 text-left text-base leading-6 text-gray-800 shadow-xs transition-shadow',
          open ? 'border-primary shadow-[0_0_0_4px_var(--primary-light)]' : 'border-gray-200',
        )}
      >
        {icon && <span className="flex shrink-0 text-gray-400">{icon}</span>}
        <span className="flex-grow truncate">{current?.label}</span>
        <Icon name="chevronDown" size={20} className={cx('shrink-0 text-gray-500 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className={cx(
            'absolute top-[calc(100%+12px)] z-dropdown max-h-80 min-w-full overflow-auto rounded-lg border border-gray-100 bg-white py-1 shadow-dropdown',
            align === 'right' ? 'right-0' : 'left-0',
            menuClassName,
          )}
        >
          {options.map((o) => (
            <li key={o.label} role="option" aria-selected={o.value === value}>
              <button
                type="button"
                className={cx(
                  'w-full whitespace-nowrap px-[30px] py-[15px] text-left text-base leading-6 text-gray-900 hover:bg-gray-50',
                  o.value === value && 'bg-gray-50',
                )}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
