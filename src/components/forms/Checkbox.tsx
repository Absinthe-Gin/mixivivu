import { useId } from 'react';
import { Icon } from '@/components/common/Icon';
import { cx } from '@/utils/cx';

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  shape?: 'square' | 'round';
  className?: string;
}

export function Checkbox({ label, checked, onChange, shape = 'square', className }: CheckboxProps) {
  const id = useId();
  return (
    <label htmlFor={id} className={cx('flex cursor-pointer items-start gap-2 text-sm leading-5 text-gray-700', className)}>
      <span className="relative mt-0.5 flex h-4 w-4 shrink-0">
        <input
          id={id}
          type={shape === 'round' ? 'radio' : 'checkbox'}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 h-4 w-4 cursor-pointer opacity-0"
        />
        <span
          className={cx(
            'flex h-4 w-4 items-center justify-center border transition-colors peer-focus-visible:shadow-[0_0_0_4px_var(--primary-light)]',
            shape === 'round' ? 'rounded-full' : 'rounded',
            checked ? 'border-primary-dark bg-primary-light text-primary-dark' : 'border-gray-300 bg-white',
          )}
        >
          {checked &&
            (shape === 'round' ? (
              <span className="h-1.5 w-1.5 rounded-full bg-primary-dark" />
            ) : (
              <Icon name="check" size={12} strokeWidth={2.5} />
            ))}
        </span>
      </span>
      <span>{label}</span>
    </label>
  );
}
