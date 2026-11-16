import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon, type IconName } from '@/components/common/Icon';
import { RatingBadge } from '@/components/common/RatingBadge';
import { cdnImage } from '@/utils/assets';
import { formatNumber } from '@/utils/format';
import { cx } from '@/utils/cx';

export interface ProductCardData {
  to: string;
  title: string;
  thumbnail: string;
  location?: string;
  description: string;
  descriptionIcon: IconName;
  price: number;
  originalPrice?: number;
  unit: string;
  score: number;
  numReviews: number;
  ratingDecimals?: number;
  tags?: string[];
}

interface ProductCardProps {
  data: ProductCardData;
  layout?: 'grid' | 'list';
  /** Number of tags shown before the "+N" chip (list layout). */
  maxTags?: number;
}

/** Ship/hotel card in grid (home) or list (search results) layout. */
export function ProductCard({ data, layout = 'grid', maxTags = 5 }: ProductCardProps) {
  const navigate = useNavigate();
  const shownTags = data.tags?.slice(0, maxTags) ?? [];
  const extra = (data.tags?.length ?? 0) - shownTags.length;
  const isList = layout === 'list';

  return (
    <Card
      className={cx(
        'group flex cursor-pointer transition-shadow hover:shadow-image',
        isList ? 'flex-col items-stretch gap-0 lg:flex-row lg:items-center lg:gap-5' : 'flex-col gap-5',
      )}
      onClick={() => navigate(data.to)}
    >
      <div className={cx('relative p-4', !isList && 'pb-0', isList && 'pb-0 lg:pb-4 lg:w-[384px] lg:shrink-0')}>
        <div className={cx('overflow-hidden rounded-image shadow-image', isList ? 'aspect-[352/264] lg:h-[264px] lg:aspect-auto' : 'h-[216px]')}>
          <img
            src={cdnImage(data.thumbnail)}
            alt={data.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
        <RatingBadge
          score={data.score}
          count={data.numReviews}
          decimals={data.ratingDecimals}
          className="absolute left-7 top-7 !pl-1.5"
        />
      </div>

      <div className={cx('flex min-w-0 flex-grow flex-col', isList && 'px-6 pb-6 lg:px-0 lg:pb-0 lg:pr-5')}>
        <div className={cx('flex flex-col items-start gap-2', !isList && 'px-6')}>
          {data.location && (
            <Badge icon={<Icon name="location" />} className="text-gray-700">
              {data.location}
            </Badge>
          )}
          <Link
            to={data.to}
            onClick={(e) => e.stopPropagation()}
            className={cx(
              'max-w-full truncate text-gray-900 hover:text-primary-dark',
              isList ? 'text-xl font-bold leading-[30px] lg:text-2xl lg:leading-8' : 'text-lg font-bold leading-7',
            )}
          >
            {data.title}
          </Link>
          <p className="flex max-w-full items-center gap-2 text-sm leading-5 text-gray-600">
            <Icon name={data.descriptionIcon} size={18} className="shrink-0" />
            <span className="truncate">{data.description}</span>
          </p>
        </div>

        {isList && shownTags.length > 0 && (
          <div className="my-6 flex flex-wrap gap-2">
            {shownTags.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
            {extra > 0 && <Badge>+ {extra}</Badge>}
          </div>
        )}

        <div
          className={cx(
            'flex items-center justify-between gap-2',
            isList ? 'border-t border-gray-200 pt-5' : 'px-6 pb-6 pt-5',
            isList && shownTags.length === 0 && 'mt-6',
          )}
        >
          <PriceTag price={data.price} originalPrice={data.originalPrice} unit={data.unit} />
          <Button size="sm" className="!px-4" onClick={(e) => (e.stopPropagation(), navigate(data.to))}>
            Đặt ngay
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function PriceTag({ price, originalPrice, unit, size = 'md' }: { price: number; originalPrice?: number; unit: string; size?: 'md' | 'lg' }): ReactNode {
  return (
    <div className="flex flex-col">
      {originalPrice !== undefined && originalPrice > price && (
        <span className="text-xs font-semibold uppercase leading-4 tracking-[0.96px] text-gray-400 line-through">
          {formatNumber(originalPrice)}đ / {unit}
        </span>
      )}
      <span className={cx('font-bold text-primary-dark', size === 'lg' ? 'text-[36px] leading-[44px]' : 'text-lg leading-7')}>
        {formatNumber(price)}đ / {unit}
      </span>
    </div>
  );
}
