import { useMemo, useState, type ReactNode } from 'react';
import { Icon } from '@/components/common/Icon';
import { ContentBlocks } from '@/components/common/RichText';
import type { TabItem } from '@/components/common/Tabs';
import type { ProductDetailExtras, Rating, Room } from '@/types/models';
import { cx } from '@/utils/cx';
import { BookingModal, type BookingContext } from './BookingModal';
import { DetailHeader } from './DetailHeader';
import { DetailSection, SeeMoreLink } from './DetailSection';
import { Gallery } from './Gallery';
import { InfoCard, type InfoRow } from './InfoCard';
import { Reviews } from './Reviews';
import { RoomPicker } from './RoomPicker';
import { SectionNav } from './SectionNav';

type SectionId = 'dac-diem' | 'phong-va-gia' | 'gioi-thieu' | 'quy-dinh' | 'danh-gia';

export interface ProductDetailConfig {
  kind: 'ship' | 'hotel';
  /** "du thuyền" / "khách sạn". */
  label: string;
  unit: string;
  infoTitle: string;
  infoRows: InfoRow[];
  rulesPath: string;
  faqPath: string;
  mapLabel: string;
  /** Extra notice for the map section (schedule link for ships). */
  mapNotice?: ReactNode;
  amenities: { text: string; icon?: string }[];
  roomFeatureLabels: (room: Room) => string[];
  price: number;
  originalPrice?: number;
  ratingDecimals?: number;
  breadcrumb?: ReactNode;
}

interface Props {
  product: ProductDetailExtras & Rating & { slug: string; title: string };
  config: ProductDetailConfig;
}

/** Detail page body shared by ships and hotels. */
export function ProductDetailView({ product, config }: Props) {
  const [booking, setBooking] = useState<BookingContext | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(true);

  const tabs = useMemo<TabItem<SectionId>[]>(
    () => [
      { value: 'dac-diem', label: 'Đặc điểm' },
      { value: 'phong-va-gia', label: 'Phòng & giá' },
      { value: 'gioi-thieu', label: 'Giới thiệu' },
      { value: 'quy-dinh', label: 'Quy định' },
      { value: 'danh-gia', label: 'Đánh giá', count: product.reviews.length },
    ],
    [product.reviews.length],
  );

  const contactDetails = { productTitle: product.title, productSlug: product.slug };

  return (
    <>
      {config.breadcrumb}
      <DetailHeader
        title={product.title}
        price={config.price}
        originalPrice={config.originalPrice}
        unit={config.unit}
        score={product.score}
        numReviews={product.numReviews}
        ratingDecimals={config.ratingDecimals}
        address={product.address}
        addressIcon={config.kind === 'ship' ? 'anchor' : 'location'}
        mapLabel={config.mapLabel}
      />
      <Gallery images={product.images} title={product.title} />

      <div className="container-page px-4 pb-20 pt-10 lg:px-8 lg:pt-20">
        <SectionNav items={tabs} />
        <div className="mt-10 flex flex-col gap-10 lg:flex-row lg:gap-8">
          <div className="flex min-w-0 flex-col gap-20 lg:w-[800px] lg:shrink-0">
            <DetailSection id="dac-diem" title="Đặc điểm nổi bật">
              {config.amenities.length > 0 && (
                <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  {config.amenities.map((a) => (
                    <li key={a.text} className="flex items-center gap-3 text-base text-gray-900">
                      {a.icon ? (
                        <img src={a.icon} alt="" className="h-6 w-6" />
                      ) : (
                        <span className="h-6 w-6 rounded-full border-2 border-gray-700" aria-hidden="true" />
                      )}
                      {a.text}
                    </li>
                  ))}
                </ul>
              )}
              <ul className="flex flex-col gap-6">
                {product.highlights.map((h) => (
                  <li key={h} className={cx('flex gap-4 text-base leading-6 text-gray-900', config.kind === 'hotel' && 'pl-8')}>
                    {config.kind === 'ship' && <Icon name="check" size={24} className="shrink-0 text-primary" />}
                    {h}
                  </li>
                ))}
              </ul>
            </DetailSection>

            <DetailSection id="phong-va-gia" title="Các loại phòng & giá">
              <RoomPicker
                rooms={product.rooms}
                unit={config.unit}
                roomFeatureLabels={config.roomFeatureLabels}
                allowRentWhole={config.kind === 'ship'}
                onRentWhole={() => setBooking({ mode: 'rent', ...contactDetails, rooms: [], total: 0 })}
                onBook={(selection, total) =>
                  setBooking({
                    mode: 'book',
                    ...contactDetails,
                    total,
                    rooms: selection.map((s) => ({ title: s.room.title, quantity: s.quantity, price: s.room.price })),
                  })
                }
              />
            </DetailSection>

            <DetailSection id="gioi-thieu" title="Giới thiệu">
              <ContentBlocks blocks={product.content} />
            </DetailSection>

            <DetailSection id="quy-dinh" title="Quy định chung và lưu ý">
              <SeeMoreLink label="Quy định chung và lưu ý" to={config.rulesPath} />
            </DetailSection>

            <DetailSection title="Câu hỏi thường gặp">
              <SeeMoreLink label="Câu hỏi thường gặp" to={config.faqPath} />
            </DetailSection>

            <DetailSection id="ban-do" title={config.kind === 'ship' ? 'Bản đồ và lịch trình' : 'Bản đồ và địa chỉ'}>
              {noticeOpen && (
                <div className="relative flex gap-3 rounded-lg border border-gray-300 bg-gray-100 p-4 pr-12 text-sm text-gray-700">
                  <Icon name="info" size={20} className="shrink-0" />
                  <div className="flex flex-col gap-1">
                    <p>Thông tin cần biết:</p>
                    <ul className="list-disc pl-0">
                      <li>
                        {config.label[0].toUpperCase() + config.label.slice(1)} {product.title} {config.kind === 'ship' ? 'xuất phát từ' : 'có địa chỉ tại'} {product.address}
                      </li>
                      {config.mapNotice && <li>{config.mapNotice}</li>}
                    </ul>
                  </div>
                  <button type="button" aria-label="Đóng thông báo" onClick={() => setNoticeOpen(false)} className="absolute right-4 top-4 !shadow-none text-gray-900">
                    <Icon name="close" size={20} />
                  </button>
                </div>
              )}
              {product.mapIframeLink && (
                <iframe
                  title={`Bản đồ ${product.title}`}
                  src={product.mapIframeLink}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-[300px] w-full rounded-2xl border-0 lg:h-[450px]"
                />
              )}
            </DetailSection>

            <section id="danh-gia" className="scroll-mt-[170px]">
              <Reviews productSlug={product.slug} initial={product.reviews} />
            </section>
          </div>
          <aside className="flex-1">
            <div className="lg:sticky lg:top-[170px]">
              <InfoCard title={config.infoTitle} rows={config.infoRows} />
            </div>
          </aside>
        </div>
      </div>

      <BookingModal context={booking} onClose={() => setBooking(null)} productLabel={config.label} />
    </>
  );
}
