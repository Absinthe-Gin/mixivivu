import { Card } from '@/components/common/Card';
import { Checkbox } from '@/components/forms/Checkbox';
import { STAR_OPTIONS } from '@/data/content';

interface FilterSidebarProps {
  stars: number[];
  features: string[];
  featureOptions: { id: string; text: string }[];
  onToggleStar: (star: number, checked: boolean) => void;
  onToggleFeature: (id: string, checked: boolean) => void;
  onReset: () => void;
}

export function FilterSidebar({ stars, features, featureOptions, onToggleStar, onToggleFeature, onReset }: FilterSidebarProps) {
  return (
    <Card className="overflow-hidden" aria-label="Lọc kết quả">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
        <span className="subheading md" style={{ color: 'var(--gray-900)' }}>
          Lọc kết quả
        </span>
        <button type="button" onClick={onReset} className="text-sm font-medium text-primary-dark hover:text-primary">
          Đặt lại
        </button>
      </div>
      <div role="group" aria-labelledby="filter-stars" className="flex flex-col gap-4 px-6 pt-6">
        <p id="filter-stars" className="mb-2 text-base font-medium text-gray-900">Xếp hạng sao</p>
        {STAR_OPTIONS.map((s) => (
          <Checkbox key={s} label={`${s} sao`} checked={stars.includes(s)} onChange={(c) => onToggleStar(s, c)} />
        ))}
      </div>
      {featureOptions.length > 0 && (
        <div role="group" aria-labelledby="filter-features" className="flex flex-col gap-4 px-6 pb-6 pt-10">
          <p id="filter-features" className="mb-2 text-base font-medium text-gray-900">Tiện ích</p>
          {featureOptions.map((f) => (
            <Checkbox key={f.id} label={f.text} checked={features.includes(f.id)} onChange={(c) => onToggleFeature(f.id, c)} />
          ))}
        </div>
      )}
    </Card>
  );
}
