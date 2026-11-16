import { Link, useParams } from 'react-router-dom';
import { Icon } from '@/components/common/Icon';
import { ErrorState, Loading } from '@/components/feedback/States';
import { ROUTES } from '@/constants/routes';
import { useHotelLookups } from '@/features/catalog/hooks';
import { ProductDetailView } from '@/features/detail/components/ProductDetailView';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { catalogService } from '@/services/catalogService';
import { NotFoundError } from '@/services/http';
import { NotFoundPage } from './NotFoundPage';

export function HotelDetailPage() {
  const { slug = '' } = useParams();
  const hotel = useAsync(() => catalogService.hotel(slug), [slug]);
  const { featureText } = useHotelLookups();
  useDocumentTitle(hotel.data?.title);

  if (hotel.error instanceof NotFoundError) return <NotFoundPage />;
  if (hotel.error) return <ErrorState error={hotel.error} onRetry={hotel.reload} />;
  if (!hotel.data || hotel.data.slug !== slug) return <Loading className="min-h-[60vh]" />;

  const h = hotel.data;
  const breadcrumb = (
    <nav aria-label="Breadcrumb" className="border-b border-gray-200">
      <ol className="container-page flex items-center gap-3 px-4 py-4 text-base text-gray-600 lg:px-8">
        <li>
          <Link to={ROUTES.home} aria-label="Trang chủ" className="flex text-gray-700 hover:text-primary">
            <Icon name="home" size={22} />
          </Link>
        </li>
        <li aria-hidden="true">
          <Icon name="chevronRight" size={16} className="text-gray-300" />
        </li>
        <li>
          <Link to={ROUTES.hotelSearch} className="hover:text-primary">
            Tìm khách sạn
          </Link>
        </li>
        <li aria-hidden="true">
          <Icon name="chevronRight" size={16} className="text-gray-300" />
        </li>
        <li aria-current="page" className="truncate text-primary-dark">
          {h.title}
        </li>
      </ol>
    </nav>
  );

  return (
    <ProductDetailView
      product={h}
      config={{
        kind: 'hotel',
        label: 'khách sạn',
        unit: 'phòng',
        price: h.price,
        originalPrice: h.originalPrice,
        ratingDecimals: 0,
        breadcrumb,
        infoTitle: 'Thông tin khách sạn',
        infoRows: [
          { icon: 'bed', label: 'Số phòng', value: h.spec.totalRooms },
          { icon: 'briefcase', label: 'Điều hành', value: h.spec.admin },
        ],
        rulesPath: ROUTES.hotelRules,
        faqPath: ROUTES.hotelFaq,
        mapLabel: 'Xem bản đồ và địa chỉ',
        amenities: h.features.map((id) => featureText(id)).filter((t): t is string => !!t).map((text) => ({ text })),
        roomFeatureLabels: (room) => room.features,
      }}
    />
  );
}
