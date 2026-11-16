import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/common/Icon';
import { HeadingBorder } from '@/components/common/SectionHeader';

/** Anchor target with the h4 + border heading used on detail pages. */
export function DetailSection({ id, title, children }: { id?: string; title?: string; children: ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-[170px] flex-col gap-10">
      {title && (
        <div className="flex flex-col gap-6">
          <h4 className="m-0 text-[30px] leading-[38px] lg:text-[36px] lg:leading-[44px]">{title}</h4>
          <HeadingBorder />
        </div>
      )}
      {children}
    </section>
  );
}

export function SeeMoreLink({ label, to }: { label: string; to: string }) {
  return (
    <p className="-mt-6 text-base text-gray-900">
      Bạn có thể xem {label}:{' '}
      <Link to={to} className="inline-flex items-center gap-2 text-primary-dark hover:text-primary">
        Tại đây <Icon name="arrowRight" size={18} />
      </Link>
    </p>
  );
}
