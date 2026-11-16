import { useEffect, useState } from 'react';
import { SectionHeader } from '@/components/common/SectionHeader';
import { publicAsset } from '@/utils/assets';
import { cx } from '@/utils/cx';
import type { Testimonial } from '@/types/models';

interface TestimonialsProps {
  title: string;
  description: string;
  items: Testimonial[];
  tinted?: boolean;
}

/** Quote block with reviewer chips; rotates automatically every 6s. */
export function Testimonials({ title, description, items, tinted = true }: TestimonialsProps) {
  const [index, setIndex] = useState(items.length - 1);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || items.length < 2) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % items.length), 6000);
    return () => window.clearInterval(t);
  }, [paused, items.length]);

  const current = items[index];

  return (
    <section
      className={cx('section-bg py-16 lg:py-20', tinted && 'bg-[#f5feff] [background-blend-mode:multiply]')}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="container-page flex flex-col gap-10 px-4 lg:gap-20 lg:px-8">
        <SectionHeader title={title} description={description} />
        <figure className="m-0 flex flex-col gap-6 lg:flex-row lg:gap-10" aria-live="polite">
          <img src={publicAsset('assets/icons/quote.svg')} alt="" className="h-[34px] w-[34px] shrink-0" />
          <div className="flex flex-1 flex-col gap-6 text-gray-900">
            <blockquote className="m-0 flex flex-col gap-2 text-lg leading-7">
              {current.title && <p className="font-semibold">{current.title}</p>}
              {current.content.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </blockquote>
            <figcaption className="text-base font-semibold uppercase">{current.name} -</figcaption>
          </div>
        </figure>
        <div className="flex flex-wrap gap-4 lg:gap-6" role="tablist" aria-label="Khách hàng">
          {items.map((t, i) => (
            <button
              key={t.name}
              type="button"
              role="tab"
              aria-selected={i === index}
              onClick={() => setIndex(i)}
              className={cx(
                'rounded-full border px-2 py-2 text-base leading-6 text-gray-800 shadow-xs transition-colors lg:px-2',
                i === index ? 'border-primary bg-white' : 'border-gray-200 bg-[#fef6f6] hover:bg-white',
              )}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
