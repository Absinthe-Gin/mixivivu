import { ButtonLink } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { SectionHeader } from '@/components/common/SectionHeader';
import { ErrorState, Loading } from '@/components/feedback/States';
import { SITE } from '@/config/site';
import { ROUTES } from '@/constants/routes';
import { HOME_COPY, SHIP_PARTNERS } from '@/data/content';
import { SHIP_TESTIMONIALS } from '@/data/testimonials';
import { BlogCard } from '@/features/blog/components/BlogCard';
import { ProductCard } from '@/features/catalog/components/ProductCard';
import { SearchBox } from '@/features/catalog/components/SearchBox';
import { useShipLookups } from '@/features/catalog/hooks';
import { shipToCard } from '@/features/catalog/mappers';
import { CategoryCard } from '@/features/home/components/CategoryCard';
import { PartnerLogos } from '@/features/home/components/PartnerLogos';
import { Testimonials } from '@/features/home/components/Testimonials';
import { VideoHero } from '@/features/home/components/VideoHero';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { catalogService } from '@/services/catalogService';

/** The source home page shows six featured ships (its "popularShips"). */
const FEATURED_SHIP_SLUGS = [
  'president-cruises-halong',
  'du-thuyen-essencegrand',
  'du-thuyen-scarlet pearl1',
  'duthuyenlyragrandeur',
  'du-thuyen-celina',
  'duthuyen-calistahalong',
];

export function HomePage() {
  useDocumentTitle();
  const copy = HOME_COPY.ship;
  const { lookups } = useShipLookups();
  const ships = useAsync(() => catalogService.ships(), []);
  const blogs = useAsync(() => catalogService.blogs(), []);

  const featured = FEATURED_SHIP_SLUGS.map((slug) => ships.data?.find((s) => s.slug === slug)).filter(
    (s): s is NonNullable<typeof s> => !!s,
  );
  const suggestions = (ships.data ?? []).map((s) => ({ title: s.title, to: ROUTES.shipDetail(s.slug) }));

  return (
    <>
      <VideoHero src={SITE.heroVideos.ship}>
        <SearchBox
          title={copy.searchTitle}
          description={copy.searchDescription}
          placeholder="Nhập tên du thuyền"
          searchPath={ROUTES.shipSearch}
          locations={lookups.categories}
          suggestions={suggestions}
        />
      </VideoHero>

      <section className="container-page flex flex-col gap-10 px-4 py-16 lg:gap-16 lg:px-8 lg:py-20">
        <SectionHeader title={copy.popularTitle} description={copy.popularDescription} />
        {ships.loading && !ships.data ? (
          <Loading />
        ) : ships.error ? (
          <ErrorState error={ships.error} onRetry={ships.reload} />
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((s) => (
              <ProductCard key={s.id} data={shipToCard(s, lookups.categoryName(s.categoryId), lookups.features)} />
            ))}
          </div>
        )}
        <div className="flex justify-center">
          <ButtonLink to={ROUTES.shipSearch} variant="outline" iconRight={<Icon name="arrowRight" />}>
            {copy.viewAll}
          </ButtonLink>
        </div>
      </section>

      <Testimonials title={copy.reviewsTitle} description={copy.reviewsDescription} items={SHIP_TESTIMONIALS} />

      <section className="container-page flex flex-col gap-10 px-4 py-16 lg:gap-16 lg:px-8 lg:py-20">
        <SectionHeader layout="center" title={copy.destinationsTitle} description={copy.destinationsDescription} />
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {lookups.categories.map((c) => (
            <CategoryCard key={c.id} category={c} />
          ))}
        </div>
      </section>

      <PartnerLogos title={copy.partnersTitle} description={copy.partnersDescription} logos={SHIP_PARTNERS} />

      <section className="container-page flex flex-col gap-10 px-4 py-16 lg:gap-16 lg:px-8 lg:py-20">
        <SectionHeader title={HOME_COPY.blog.title} description={HOME_COPY.blog.description} />
        {blogs.error ? (
          <ErrorState error={blogs.error} onRetry={blogs.reload} />
        ) : !blogs.data ? (
          <Loading />
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {blogs.data.slice(0, 3).map((b) => (
              <BlogCard key={b.id} blog={b} />
            ))}
          </div>
        )}
        <div className="flex justify-center">
          <ButtonLink to={ROUTES.blog} variant="outline" iconRight={<Icon name="arrowRight" />}>
            Xem tất cả
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
