import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { cx } from '@/utils/cx';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}

/** Centered dialog with overlay; closes on overlay click, Escape and ✕. */
export function Modal({ open, onClose, title, children, className, ariaLabel }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-gray-900/60 p-4" onMouseDown={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? (typeof title === 'string' ? title : undefined)}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className={cx(
          'relative max-h-[90vh] w-full max-w-[810px] overflow-y-auto rounded-[24px] bg-white p-6 outline-none lg:p-[28px]',
          className,
        )}
      >
        {title && (
          <div className="mb-6 border-b border-gray-200 pb-6 pr-10">
            <h5 className="text-2xl leading-8">{title}</h5>
          </div>
        )}
        <button
          type="button"
          aria-label="Đóng"
          onClick={onClose}
          className="absolute right-6 top-6 flex h-7 items-center justify-center !shadow-none text-gray-900"
        >
          <Icon name="close" size={22} />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
