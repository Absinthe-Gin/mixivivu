import { useLocation, useSearchParams } from 'react-router-dom';
import { ButtonLink } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { SectionHeader } from '@/components/common/SectionHeader';
import { EmptyState } from '@/components/feedback/States';
import { SITE } from '@/config/site';
import { ROUTES } from '@/constants/routes';
import { AIRPORTS, airportLabel } from '@/features/flight/airports';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatDate } from '@/utils/format';

/**
 * The source queries a live fare provider here. No fare data can be
 * reproduced offline, so the clone shows the search summary and hands the
 * request to the hotline instead of inventing prices.
 */
export function FlightResultPage() {
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const cheapest = pathname.endsWith('ve-re-nhat-thang');
  useDocumentTitle(cheapest ? 'Vé rẻ nhất tháng' : 'Kết quả tìm chuyến bay');

  const find = (code: string | null) => AIRPORTS.find((a) => a.code === code);
  const from = find(params.get('from'));
  const to = find(params.get('to'));
  const rows: [string, string | undefined][] = [
    ['Điểm đi', from && airportLabel(from)],
    ['Điểm đến', to && airportLabel(to)],
    ['Ngày đi', formatDate(params.get('depart'))],
    ['Ngày về', params.get('return') ? formatDate(params.get('return')) : 'Một chiều'],
    ['Hành khách', `${params.get('adults') ?? 1} người lớn, ${params.get('children') ?? 0} trẻ em, ${params.get('infants') ?? 0} em bé`],
  ];

  return (
    <div className="container-page flex flex-col gap-10 px-4 py-16 lg:px-8 lg:py-20">
      <SectionHeader title={cheapest ? 'Vé rẻ nhất tháng' : 'Kết quả tìm chuyến bay'} />
      {from && to ? (
        <Card className="flex flex-col gap-6 p-6 lg:p-8">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {rows.map(([k, v]) => (
              <div key={k} className="flex flex-col gap-1">
                <dt className="text-sm text-gray-500">{k}</dt>
                <dd className="m-0 text-base font-medium text-gray-900">{v}</dd>
              </div>
            ))}
          </dl>
          <EmptyState
            title="Giá vé được cập nhật trực tiếp từ hãng bay"
            description={`Bản sao này không kết nối hệ thống giá vé. Vui lòng gọi hotline ${SITE.hotline} để Mixivivu báo giá và giữ chỗ cho hành trình của bạn.`}
            action={
              <div className="flex flex-wrap justify-center gap-4">
                <ButtonLink to={`tel:${SITE.hotline}`} external iconLeft={<Icon name="phone" size={18} />}>
                  Gọi {SITE.hotline}
                </ButtonLink>
                <ButtonLink to={ROUTES.flight} variant="outline">
                  Tìm chuyến khác
                </ButtonLink>
              </div>
            }
          />
        </Card>
      ) : (
        <EmptyState
          title="Thiếu thông tin chuyến bay"
          description="Vui lòng chọn điểm đi, điểm đến và ngày bay."
          action={<ButtonLink to={ROUTES.flight}>Tìm chuyến bay</ButtonLink>}
        />
      )}
    </div>
  );
}
