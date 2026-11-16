import { Icon } from './Icon';
import { cx } from '@/utils/cx';

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label: string;
  className?: string;
}

/** − value + pill used for room quantities and guests. */
export function Stepper({ value, onChange, min = 0, max = 99, label, className }: StepperProps) {
  return (
    <div
      className={cx('flex items-center gap-4 rounded-full border border-gray-200 bg-white px-5 py-3 shadow-xs', className)}
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        aria-label={`Giảm ${label}`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex items-center !shadow-none text-gray-900 disabled:text-gray-300"
      >
        <Icon name="minus" size={20} />
      </button>
      <span className="w-6 text-center text-base font-medium text-gray-900" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label={`Tăng ${label}`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex items-center !shadow-none text-gray-900 disabled:text-gray-300"
      >
        <Icon name="plus" size={20} />
      </button>
    </div>
  );
}
