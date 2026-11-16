import { useEffect, useState } from 'react';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { cdnImage } from '@/utils/assets';
import { cx } from '@/utils/cx';

/** Center image with neighbour peeks, arrow buttons and a thumbnail strip. */
export function Gallery({ images, title }: { images: string[]; title: string }) {
  const [index, setIndex] = useState(0);
  const count = images.length;
  useEffect(() => {
    setIndex(0);
  }, [images]);
  if (count === 0) return null;

  const at = (offset: number) => images[(index + offset + count) % count];
  const go = (delta: number) => setIndex((i) => (i + delta + count) % count);
  const thumbs = Array.from({ length: Math.min(5, count) }, (_, i) => (index - Math.min(2, Math.floor((Math.min(5, count) - 1) / 2)) + i + count) % count);

  return (
    <section aria-label={`Hình ảnh ${title}`} className="relative">
      <div className="flex h-[260px] items-stretch gap-8 px-0 lg:h-[450px] lg:px-6">
        <img src={cdnImage(at(-1))} alt="" aria-hidden="true" className="hidden h-full w-[160px] shrink-0 rounded-r-[32px] object-cover lg:block lg:rounded-l-[32px]" />
        <div className="relative h-full flex-1 overflow-hidden">
          <img key={index} src={cdnImage(at(0))} alt={`${title} - ảnh ${index + 1}/${count}`} className="h-full w-full object-cover" />
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
            {thumbs.map((i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ảnh ${i + 1}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={cx(
                  'h-10 w-12 overflow-hidden rounded-lg border-2 !shadow-none lg:h-16 lg:w-16',
                  i === index ? 'border-primary shadow-[0_0_0_4px_var(--primary-light)]' : 'border-white',
                )}
              >
                <img src={cdnImage(images[i])} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
        <img src={cdnImage(at(1))} alt="" aria-hidden="true" className="hidden h-full w-[160px] shrink-0 rounded-l-[32px] object-cover lg:block lg:rounded-r-[32px]" />
      </div>
      <Button variant="outline" iconOnly aria-label="Ảnh trước" onClick={() => go(-1)} className="absolute left-4 top-1/2 -translate-y-1/2 lg:left-11">
        <Icon name="arrowLeft" />
      </Button>
      <Button variant="outline" iconOnly aria-label="Ảnh sau" onClick={() => go(1)} className="absolute right-4 top-1/2 -translate-y-1/2 lg:right-11">
        <Icon name="arrowRight" />
      </Button>
    </section>
  );
}
