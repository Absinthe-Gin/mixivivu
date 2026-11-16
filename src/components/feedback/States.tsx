import type { ReactNode } from 'react';
import { Button } from '@/components/common/Button';
import { publicAsset } from '@/utils/assets';
import { cx } from '@/utils/cx';

export function Loading({ className, label = 'Đang tải…' }: { className?: string; label?: string }) {
  return (
    <div role="status" className={cx('flex flex-col items-center justify-center gap-4 py-20', className)}>
      <svg viewBox="0 0 32 32" className="h-16 w-16 fill-primary" aria-hidden="true">
        {[2, 8, 14, 20, 26].map((x, i) => (
          <rect key={x} x={x} y={12} width={4} height={8}>
            <animate attributeName="y" values="12;4;12;12" dur="1.2s" begin={`${i * 0.2}s`} repeatCount="indefinite" />
            <animate attributeName="height" values="8;24;8;8" dur="1.2s" begin={`${i * 0.2}s`} repeatCount="indefinite" />
          </rect>
        ))}
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );
}

interface MessageProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className }: MessageProps) {
  return (
    <div className={cx('flex flex-col items-center gap-4 py-16 text-center', className)}>
      <img src={publicAsset('assets/illustrations/mixi_transparent.png')} alt="" className="h-28 w-auto opacity-90" />
      <p className="subheading md">{title}</p>
      {description && <p className="md max-w-md">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error?: Error; onRetry?: () => void; className?: string }) {
  return (
    <EmptyState
      className={className}
      title="Đã có lỗi xảy ra"
      description={error?.message ?? 'Không thể tải dữ liệu. Vui lòng thử lại.'}
      action={
        onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Thử lại
          </Button>
        )
      }
    />
  );
}
