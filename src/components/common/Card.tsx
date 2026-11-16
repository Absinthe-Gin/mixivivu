import type { HTMLAttributes } from 'react';
import { cx } from '@/utils/cx';

/** White rounded surface (32px radius, gray-200 border, small shadow). */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('rounded-card border border-gray-200 bg-white shadow-sm', className)} {...rest} />;
}
