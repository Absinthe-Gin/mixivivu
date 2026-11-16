import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { cx } from '@/utils/cx';

/** Page numbers with ellipses, mirroring the source: 1 2 3 … 17 18 19. */
export function pageItems(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3 || current >= total - 2) return [1, 2, 3, '…', total - 2, total - 1, total];
  return [1, '…', current - 1, current, current + 1, '…', total];
}

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [sizeDraft, setSizeDraft] = useState(String(pageSize));
  useEffect(() => {
    setSizeDraft(String(pageSize));
  }, [pageSize]);

  const commitSize = () => {
    const n = Math.min(Math.max(parseInt(sizeDraft, 10) || pageSize, 1), 50);
    setSizeDraft(String(n));
    if (n !== pageSize) onPageSizeChange?.(n);
  };

  const item = 'flex h-10 items-center justify-center border-r border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:pointer-events-none disabled:text-gray-300 !shadow-none !rounded-none';

  return (
    <nav aria-label="Phân trang" className="flex items-center justify-center gap-4 border-t border-gray-200 px-0 py-3 lg:justify-between lg:px-6 lg:pb-4">
      {onPageSizeChange && (
        <div className="hidden items-center gap-3 text-sm text-gray-700 lg:flex">
          <span>Đang xem:</span>
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 bg-white shadow-xs">
            <input
              aria-label="Số mục mỗi trang"
              type="number"
              min={1}
              max={50}
              value={sizeDraft}
              onChange={(e) => setSizeDraft(e.target.value)}
              onBlur={commitSize}
              onKeyDown={(e) => e.key === 'Enter' && commitSize()}
              className="h-6 w-[30px] border-none text-center text-base font-medium text-gray-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
          </span>
          <span>của {total}</span>
        </div>
      )}
      <ul className="flex w-fit overflow-hidden rounded-full border border-gray-300 shadow-xs">
        <li>
          <button
            type="button"
            className={cx(item, 'gap-2 px-2 lg:px-4')}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Trang trước"
          >
            <Icon name="arrowLeft" size={20} />
            <span className="hidden text-sm font-medium lg:inline">Trước</span>
          </button>
        </li>
        {pageItems(page, totalPages).map((p, i) =>
          p === '…' ? (
            <li key={`dots-${i}`} className={cx(item, 'w-[35px] lg:w-10 hover:bg-white')}>
              …
            </li>
          ) : (
            <li key={p}>
              <button
                type="button"
                aria-current={p === page ? 'page' : undefined}
                className={cx(item, 'w-[35px] text-sm font-medium lg:w-10', p === page && 'bg-gray-50')}
                onClick={() => onPageChange(p)}
              >
                {p}
              </button>
            </li>
          ),
        )}
        <li>
          <button
            type="button"
            className={cx(item, 'gap-2 border-r-0 px-2 lg:px-4')}
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Trang sau"
          >
            <span className="hidden text-sm font-medium lg:inline">Tiếp</span>
            <Icon name="arrowRight" size={20} />
          </button>
        </li>
      </ul>
    </nav>
  );
}
