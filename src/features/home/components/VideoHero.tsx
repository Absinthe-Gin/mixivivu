import type { ReactNode } from 'react';
import { publicAsset } from '@/utils/assets';
import { cx } from '@/utils/cx';

interface VideoHeroProps {
  src: string;
  /** Content overlapping the bottom edge (search box). */
  children: ReactNode;
  overlap?: 'search' | 'flight';
}

/**
 * Rounded hero with an autoplaying muted video. The search card overlaps
 * the bottom of the video by ~120px on desktop, like the source.
 */
export function VideoHero({ src, children, overlap = 'search' }: VideoHeroProps) {
  return (
    <section className="relative">
      <div className="mx-0 overflow-hidden lg:mx-8 lg:rounded-b-[32px] lg:rounded-t-[32px]">
        <video
          className="block h-[420px] w-full object-cover lg:h-[775px]"
          src={src}
          poster={publicAsset('assets/images/thumb.png')}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        />
      </div>
      <div className={cx('relative z-[1]', overlap === 'search' ? '-mt-[300px] lg:-mt-[120px]' : '-mt-[300px] lg:-mt-[152px]')}>
        {children}
      </div>
    </section>
  );
}
