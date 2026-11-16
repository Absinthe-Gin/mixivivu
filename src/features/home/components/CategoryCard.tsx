import { useNavigate } from 'react-router-dom';
import { ButtonLink } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { ROUTES } from '@/constants/routes';
import type { Category } from '@/types/models';
import { cdnImage } from '@/utils/assets';
import { buildSearchQuery } from '@/features/catalog/query';

export function CategoryCard({ category }: { category: Category }) {
  const navigate = useNavigate();
  const to = `${ROUTES.shipSearch}?${buildSearchQuery({ location: category.id })}`;
  return (
    <Card className="flex cursor-pointer flex-col gap-4 pb-6 lg:gap-5" onClick={() => navigate(to)}>
      <div className="mx-4 mt-4 h-[192px] overflow-hidden rounded-image lg:h-[216px]">
        <img src={cdnImage(category.image)} alt={category.name} loading="lazy" className="h-full w-full object-cover" />
      </div>
      <div className="flex flex-col items-center gap-2 px-6">
        <h6 className="m-0 text-lg leading-7 text-gray-900 lg:text-2xl lg:leading-8">{category.name}</h6>
      </div>
      <div className="flex justify-center px-6">
        <ButtonLink to={to} variant="outline" size="sm">
          Xem ngay
        </ButtonLink>
      </div>
    </Card>
  );
}
