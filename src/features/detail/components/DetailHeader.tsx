import { Badge } from '@/components/common/Badge';
import { Icon } from '@/components/common/Icon';
import { RatingBadge } from '@/components/common/RatingBadge';
import { HeadingBorder } from '@/components/common/SectionHeader';
import { formatNumber } from '@/utils/format';

interface DetailHeaderProps {
  title: string;
  price: number;
  originalPrice?: number;
  unit: string;
  score: number;
  numReviews: number;
  ratingDecimals?: number;
  address: string;
  addressIcon: 'anchor' | 'location';
  mapLabel: string;
}

export function DetailHeader(props: DetailHeaderProps) {
  const { title, price, originalPrice, unit, score, numReviews, ratingDecimals, address, addressIcon, mapLabel } = props;
  return (
    <div className="container-page flex flex-col gap-6 px-4 pb-10 pt-10 lg:flex-row lg:items-start lg:justify-between lg:px-8 lg:pb-20 lg:pt-12">
      <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
        <h1 className="m-0 text-[30px] font-bold leading-[38px] text-gray-900 lg:text-[36px] lg:leading-[44px]">{title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <RatingBadge score={score} count={numReviews} size="md" decimals={ratingDecimals} />
          <Badge size="md" icon={<Icon name={addressIcon} />} className="!whitespace-normal [&>span]:whitespace-normal">
            {address}{' '}
            <a href="#ban-do" className="text-primary underline">
              {mapLabel}
            </a>
          </Badge>
        </div>
        <HeadingBorder />
      </div>
      <div className="flex shrink-0 flex-col lg:items-end">
        <span className="text-[30px] font-bold leading-[38px] text-primary-dark lg:text-[36px] lg:leading-[44px]">
          {formatNumber(price)} đ/ {unit}
        </span>
        {originalPrice !== undefined && originalPrice > price && (
          <span className="text-xl font-bold uppercase leading-[30px] text-gray-400 line-through lg:text-2xl">
            {formatNumber(originalPrice)} đ/ {unit}
          </span>
        )}
      </div>
    </div>
  );
}
