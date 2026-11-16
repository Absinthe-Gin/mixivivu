import { useParams } from 'react-router-dom';
import { ErrorState, Loading } from '@/components/feedback/States';
import { ROUTES } from '@/constants/routes';
import { useShipLookups } from '@/features/catalog/hooks';
import { ProductDetailView } from '@/features/detail/components/ProductDetailView';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { catalogService } from '@/services/catalogService';
import { NotFoundError } from '@/services/http';
import { NotFoundPage } from './NotFoundPage';

export function ShipDetailPage() {
  const { slug = '' } = useParams();
  const ship = useAsync(() => catalogService.ship(slug), [slug]);
  const { lookups } = useShipLookups();
  useDocumentTitle(ship.data?.title);

  if (ship.error instanceof NotFoundError) return <NotFoundPage />;
  if (ship.error) return <ErrorState error={ship.error} onRetry={ship.reload} />;
  if (!ship.data || ship.data.slug !== slug) return <Loading className="min-h-[60vh]" />;

  const s = ship.data;
  const iconFor = (id: string) => lookups.features.find((f) => f.id === id);
  const amenities = s.features
    .map(iconFor)
    .filter((f): f is NonNullable<typeof f> => !!f && f.type === 'ship')
    .map((f) => ({ text: f.text, icon: f.icon }));

  return (
    <ProductDetailView
      product={s}
      config={{
        kind: 'ship',
        label: 'du thuyền',
        unit: 'khách',
        price: s.price,
        infoTitle: 'Thông tin du thuyền',
        infoRows: [
          { icon: 'anchor', label: 'Hạ thuỷ', value: s.spec.launch },
          { icon: 'bed', label: 'Cabin', value: s.spec.cabin },
          { icon: 'ship', label: 'Thân vỏ', value: s.spec.shell },
          { icon: 'location', label: 'Hành trình', value: s.spec.trip },
          { icon: 'briefcase', label: 'Điều hành', value: s.spec.admin },
        ],
        rulesPath: ROUTES.shipRules,
        faqPath: ROUTES.shipFaq,
        mapLabel: 'Xem bản đồ và lịch trình',
        mapNotice: s.schedule && (
          <>
            Bạn có thể xem chi tiết lịch trình {s.schedule}{' '}
            {s.scheduleLink && (
              <a href={s.scheduleLink} target="_blank" rel="noopener noreferrer" className="text-primary-dark underline">
                tại đây
              </a>
            )}
            .
          </>
        ),
        amenities,
        roomFeatureLabels: (room) => room.features.map((id) => lookups.featureText(id)).filter((t): t is string => !!t),
      }}
    />
  );
}
