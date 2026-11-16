import type { ReactNode } from 'react';
import { cx } from '@/utils/cx';

type Tone = 'default' | 'primary' | 'warning' | 'error' | 'success' | 'info';

const TONES: Record<Tone, string> = {
  default: 'bg-gray-100 text-gray-700 [&_svg]:text-gray-500',
  primary: 'bg-primary-light text-primary-dark [&_svg]:text-primary',
  warning: 'bg-warning-light text-warning-dark [&_svg]:text-warning',
  error: 'bg-error-light text-error-dark [&_svg]:text-error',
  success: 'bg-success-light text-success-dark [&_svg]:text-success',
  info: 'bg-info-light text-info-dark [&_svg]:text-info',
};

const SIZES = {
  sm: 'px-2 py-0.5 text-xs leading-[18px]',
  md: 'px-2.5 py-0.5 text-sm leading-5',
  lg: 'px-3 py-1 text-sm leading-5',
};

interface BadgeProps {
  tone?: Tone;
  size?: keyof typeof SIZES;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = 'default', size = 'sm', icon, className, children }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex w-fit max-w-full items-center gap-1 rounded-2xl font-medium [&_svg]:h-3 [&_svg]:w-3 [&_svg]:shrink-0',
        TONES[tone],
        SIZES[size],
        className,
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}
