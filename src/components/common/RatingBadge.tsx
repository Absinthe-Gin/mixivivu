import { Badge } from './Badge';
import { Icon } from './Icon';

interface RatingBadgeProps {
  score: number;
  count: number;
  size?: 'sm' | 'md';
  className?: string;
  /** Hotels show "5 (2) đánh giá"; ships show "5.0 (3) đánh giá". */
  decimals?: number;
}

export function RatingBadge({ score, count, size = 'sm', className, decimals = 1 }: RatingBadgeProps) {
  return (
    <Badge tone="warning" size={size} className={className} icon={<Icon name="star" />}>
      {score.toFixed(decimals)} ({count}) đánh giá
    </Badge>
  );
}

export function Stars({ value, size = 20 }: { value: number; size?: number }) {
  return (
    <span className="flex gap-1 text-warning" aria-label={`${value} sao`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name="star" size={size} className={i <= value ? '' : 'text-gray-300'} />
      ))}
    </span>
  );
}
