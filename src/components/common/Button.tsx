import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cx } from '@/utils/cx';

export type ButtonVariant = 'primary' | 'outline' | 'link';
export type ButtonSize = 'sm' | 'md';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary border border-primary text-primary-dark hover:bg-primary-dark hover:border-primary-dark hover:text-white focus-visible:shadow-[0_0_0_4px_var(--primary-light)] disabled:bg-primary-light disabled:border-primary-light disabled:pointer-events-none',
  outline:
    'bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 hover:text-gray-700 focus-visible:shadow-[0_0_0_4px_var(--gray-100)] disabled:text-gray-200 disabled:pointer-events-none',
  link: 'text-primary-dark hover:text-primary !p-0 !shadow-none bg-transparent',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-4 py-2.5 text-sm leading-5 font-medium',
  md: 'px-5 py-4 text-base leading-6 font-medium',
};

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  iconOnly?: boolean;
}

const classesFor = ({ variant = 'primary', size = 'md', fullWidth, iconOnly }: CommonProps, className?: string) =>
  cx(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full shadow-xs transition-colors outline-none',
    VARIANTS[variant],
    iconOnly ? (size === 'sm' ? 'p-2.5' : 'p-3') : SIZES[size],
    fullWidth && 'w-full',
    className,
  );

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, fullWidth, iconLeft, iconRight, iconOnly, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={classesFor({ variant, size, fullWidth, iconOnly }, className)}
      {...rest}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
});

interface ButtonLinkProps extends CommonProps {
  to: string;
  className?: string;
  children?: ReactNode;
  external?: boolean;
}

export function ButtonLink({ to, className, children, iconLeft, iconRight, external, ...style }: ButtonLinkProps) {
  const cls = classesFor(style, className);
  if (external) {
    return (
      <a href={to} className={cls}>
        {iconLeft}
        {children}
        {iconRight}
      </a>
    );
  }
  return (
    <Link to={to} className={cls}>
      {iconLeft}
      {children}
      {iconRight}
    </Link>
  );
}
