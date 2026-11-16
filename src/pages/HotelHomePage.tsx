import { ButtonLink } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { SectionHeader } from '@/components/common/SectionHeader';
import { ErrorState, Loading } from '@/components/feedback/States';
import { SITE } from '@/config/site';
import { ROUTES } from '@/constants/routes';
import { HOME_COPY, SHIP_PARTNERS } from '@/data/content';
import { BlogCard } from '@/features/blog/components/BlogCard';
import { buildSearchQuery } from '@/features/catalog/query';
import { CategoryCard } from '@/features/home/components/CategoryCard';
import { PartnerLogos } from '@/features/home/components/PartnerLogos';
import { HOTEL_TESTIMONIALS } from '@/data/testimonials';
import { ProductCard } from '@/features/catalog/components/ProductCard';
import { SearchBox } from '@/features/catalog/components/SearchBox';
import { useHotelLookups } from '@/features/catalog/hooks';
import { hotelToCard } from '@/features/catalog/mappers';
import { Testimonials } from '@/features/home/components/Testimonials';
import { VideoHero } from '@/features/home/components/VideoHero';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { catalogService } from '@/services/catalogService';
import { useHotelCities } from './HotelSearchPage';

/** The six "popular hotels" listed on the source /khach-san page. */
const FEATURED_HOTEL_SLUGS = [
  'citadines-marina-halong',
  'anya-hotel-quy-nhon',
  'Grand-tourane-hotel-danang',
  'nha-trang-marriott-resort-and-spa',
  'sol-by-melia-phu-quoc',
  'sapa-jade-hill-resort-and-spa',
];

export function HotelHomePage() {
  useDocumentTitle('Khách sạn');
  const copy = HOME_COPY.hotel;
  const hotels = useAsync(() => catalogService.hotels(), []);
  const blogs = useAsync(() => catalogService.blogs(), []);
  const { featureText } = useHotelLookups();
  const cities = useHotelCities(hotels.data);
  const featured = FEATURED_HOTEL_SLUGS.map((slug) => hotels.data?.find((h) => h.slug.toLowerCase() === slug.toLowerCase())).filter(
    (h): h is NonNullable<typeof h> => !!h,
  );
  const shown = featured.length ? featured : (hotels.data ?? []).slice(0, 6);

  return (
    <>
      <VideoHero src={SITE.heroVideos.hotel}>
        <SearchBox
          title={copy.searchTitle}
          description={copy.searchDescription}
          placeholder="Nhập tên khách sạn"
          searchPath={ROUTES.hotelSearch}
          locationKey="city"
          locations={cities}
          suggestions={(hotels.data ?? []).map((h) => ({ title: h.title, to: ROUTES.hotelDetail(h.slug) }))}
        />
      </VideoHero>

      <section className="container-page flex flex-col gap-10 px-4 py-16 lg:gap-16 lg:px-8 lg:py-20">
        <SectionHeader title={copy.popularTitle} description={copy.popularDescription} />
        {hotels.error ? (
          <ErrorState error={hotels.error} onRetry={hotels.reload} />
        ) : !hotels.data ? (
          <Loading />
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {shown.map((h) => (
              <ProductCard key={h.id} data={hotelToCard(h, featureText)} />
            ))}
          </div>
        )}
        <div className="flex justify-center">
          <ButtonLink to={ROUTES.hotelSearch} variant="outline" iconRight={<Icon name="arrowRight" />}>
            {copy.viewAll}
          </ButtonLink>
        </div>
      </section>

      <Testimonials title={HOME_COPY.ship.reviewsTitle} description={HOME_COPY.ship.reviewsDescription} items={HOTEL_TESTIMONIALS} />

      <section className="container-page flex flex-col gap-10 px-4 py-16 lg:gap-16 lg:px-8 lg:py-20">
        <SectionHeader layout="center" title={HOME_COPY.ship.destinationsTitle} description={copy.destinationsDescription} />
        <div className="flex flex-wrap justify-center gap-8 [&>*]:w-full md:[&>*]:w-[calc(50%-16px)] lg:[&>*]:w-[calc(33.333%-22px)]">
          {copy.destinations.map((c) => (
            <CategoryCard key={c.id} name={c.name} image={c.image} to={`${ROUTES.hotelSearch}?${buildSearchQuery({ location: c.id }, 'city')}`} />
          ))}
        </div>
      </section>

      <PartnerLogos title={copy.partnersTitle} description={copy.partnersDescription} logos={SHIP_PARTNERS} />

      <section className="container-page flex flex-col gap-10 px-4 py-16 lg:gap-16 lg:px-8 lg:py-20">
        <SectionHeader title={copy.blogTitle} description={copy.blogDescription} />
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {(blogs.data ?? []).filter((b) => b.type === 'hotel').slice(0, 3).map((b) => (
            <BlogCard key={b.id} blog={b} />
          ))}
        </div>
        <div className="flex justify-center">
          <ButtonLink to={`${ROUTES.blog}?type=hotel`} variant="outline" iconRight={<Icon name="arrowRight" />}>
            Xem tất cả
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
