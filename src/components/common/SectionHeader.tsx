import type { ReactNode } from 'react';
import { cx } from '@/utils/cx';
import { publicAsset } from '@/utils/assets';

export function HeadingBorder({ className }: { className?: string }) {
  return <img src={publicAsset('assets/images/heading-border.png')} alt="" width={80} height={8} className={className} />;
}

interface SectionHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  layout?: 'row' | 'center' | 'column';
  as?: 'h1' | 'h4';
  className?: string;
}

/** Title + decorative border with an optional description on the right/below. */
export function SectionHeader({ title, description, layout = 'row', as: Tag = 'h4', className }: SectionHeaderProps) {
  return (
    <div
      className={cx(
        'flex flex-grow gap-6 lg:gap-4',
        layout === 'row' && 'flex-col items-start lg:flex-row',
        layout === 'center' && 'flex-col items-center text-center',
        layout === 'column' && 'flex-col items-start',
      )}
    >
      <div className={cx('flex flex-1 flex-col gap-6', layout === 'center' && 'items-center', className)}>
        <Tag className="m-0 whitespace-pre-line text-[30px] font-bold leading-[38px] text-gray-900 lg:text-[36px] lg:leading-[44px]">
          {title}
        </Tag>
        {layout !== 'center' && <HeadingBorder />}
      </div>
      {description && (
        <p
          className={cx(
            'lg text-base text-gray-600 lg:text-lg',
            layout === 'row' && 'w-full lg:w-[488px] lg:shrink-0',
            layout === 'center' && 'max-w-[488px]',
          )}
          style={{ color: 'var(--gray-600)' }}
        >
          {description}
        </p>
      )}
      {layout === 'center' && <HeadingBorder />}
    </div>
  );
}
