import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cx } from '@/utils/cx';

interface FieldShellProps {
  id: string;
  label?: string;
  required?: boolean;
  error?: string;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Pill input frame with the label sitting on the top border (source style). */
export function FieldShell({ id, label, required, error, icon, className, children }: FieldShellProps) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <div
        className={cx(
          'relative flex items-center gap-2 rounded-input border bg-white px-5 py-4 shadow-xs transition-shadow',
          error
            ? 'border-error focus-within:shadow-[0_0_0_4px_var(--error-light)]'
            : 'border-gray-200 focus-within:border-primary focus-within:shadow-[0_0_0_4px_var(--primary-light)]',
        )}
      >
        {label && (
          <label htmlFor={id} className="label-sm absolute left-4 top-0 -translate-y-1/2 bg-white px-1 text-gray-600">
            {label}
            {required && <span className="text-[red]"> *</span>}
          </label>
        )}
        {icon && <span className="flex shrink-0 text-gray-400">{icon}</span>}
        {children}
      </div>
      {error && (
        <p className="sm text-error" role="alert" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

const inputClass =
  'w-0 min-w-0 flex-grow border-none bg-transparent text-base leading-6 text-gray-800 outline-none placeholder:text-gray-400';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
  wrapperClassName?: string;
}

export function TextField({ label, error, icon, required, wrapperClassName, id, ...rest }: TextFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} required={required} error={error} icon={icon} className={wrapperClassName}>
      <input
        id={fieldId}
        aria-invalid={!!error}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        className={cx(inputClass, 'h-6')}
        {...rest}
      />
    </FieldShell>
  );
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  wrapperClassName?: string;
}

export function TextArea({ label, error, required, wrapperClassName, id, ...rest }: TextAreaProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} required={required} error={error} className={wrapperClassName}>
      <textarea
        id={fieldId}
        aria-invalid={!!error}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        className={cx(inputClass, 'h-[140px] resize-y')}
        {...rest}
      />
    </FieldShell>
  );
}
