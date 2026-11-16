import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/common/Button';
import { HeadingBorder } from '@/components/common/SectionHeader';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, Loading } from '@/components/feedback/States';
import { Dropdown } from '@/components/forms/Dropdown';
import { Modal } from '@/components/common/Modal';
import { SORT_OPTIONS, type SortOrder } from '@/data/content';
import { applyCatalogQuery, buildSearchQuery, parseSearchQuery, type CatalogQuery, type Filterable } from '../query';
import { FilterSidebar } from './FilterSidebar';
import { ProductCard, type ProductCardData } from './ProductCard';

interface CatalogListingProps<T extends Filterable & { id: string }> {
  items: T[] | undefined;
  loading: boolean;
  error?: Error;
  onRetry: () => void;
  locationKey: 'category' | 'city';
  locationOf: (item: T) => string | undefined;
  starsOf: (item: T) => number;
  toCard: (item: T) => ProductCardData;
  featureOptions: { id: string; text: string }[];
  /** Search box rendered above the results; receives the query and an apply callback. */
  renderSearch: (query: CatalogQuery, apply: (q: Partial<CatalogQuery>) => void) => ReactNode;
}

/** Search results page body: search box, count, sort, filters, list, pagination. */
export function CatalogListing<T extends Filterable & { id: string }>({
  items,
  loading,
  error,
  onRetry,
  locationKey,
  locationOf,
  starsOf,
  toCard,
  featureOptions,
  renderSearch,
}: CatalogListingProps<T>) {
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => parseSearchQuery(params, locationKey), [params, locationKey]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const update = (patch: Partial<CatalogQuery>, resetPage = true) => {
    const next = { ...query, ...patch, ...(resetPage ? { page: 1 } : {}) };
    setParams(buildSearchQuery(next, locationKey), { replace: false });
  };

  const results = useMemo(
    () => (items ? applyCatalogQuery(items, query, { location: locationOf, stars: starsOf }) : []),
    [items, query, locationOf, starsOf],
  );
  const totalPages = Math.max(1, Math.ceil(results.length / query.size));
  const page = Math.min(query.page, totalPages);
  const pageItems = results.slice((page - 1) * query.size, page * query.size);

  const toggle = <K extends 'stars' | 'features'>(key: K, value: CatalogQuery[K][number], checked: boolean) => {
    const list = query[key] as (typeof value)[];
    update({ [key]: checked ? [...list, value] : list.filter((v) => v !== value) } as Partial<CatalogQuery>);
  };

  const sidebar = (
    <FilterSidebar
      stars={query.stars}
      features={query.features}
      featureOptions={featureOptions}
      onToggleStar={(s, c) => toggle('stars', s, c)}
      onToggleFeature={(f, c) => toggle('features', f, c)}
      onReset={() => update({ stars: [], features: [] })}
    />
  );

  return (
    <div className="section-bg">
      <div className="container-page flex flex-col gap-10 px-4 pb-20 pt-10 lg:gap-20 lg:px-8 lg:pt-40">
        {renderSearch(query, (q) => update({ ...q }))}

        <div className="flex flex-col gap-10 lg:gap-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-4">
              <h4 className="m-0 text-[30px] leading-[38px] lg:text-[36px] lg:leading-[44px]" aria-live="polite">
                {loading && !items ? 'Đang tìm kiếm…' : `Tìm thấy ${results.length} kết quả`}
              </h4>
              <HeadingBorder />
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setFiltersOpen(true)}>
                Lọc kết quả
              </Button>
              <Dropdown<SortOrder>
                ariaLabel="Sắp xếp"
                options={SORT_OPTIONS}
                value={query.sort}
                onChange={(sort) => update({ sort })}
                align="right"
                className="w-[180px]"
                menuClassName="min-w-[200px]"
              />
            </div>
          </div>

          <div className="flex items-start gap-8">
            <aside className="hidden w-[280px] shrink-0 lg:block">{sidebar}</aside>
            <div className="flex min-w-0 flex-1 flex-col gap-8">
              {error ? (
                <ErrorState error={error} onRetry={onRetry} />
              ) : loading && !items ? (
                <Loading />
              ) : results.length === 0 ? (
                <EmptyState
                  title="Không tìm thấy kết quả phù hợp"
                  description="Hãy thử thay đổi từ khóa, địa điểm, mức giá hoặc bộ lọc."
                  action={
                    <Button variant="outline" size="sm" onClick={() => setParams('')}>
                      Xóa tất cả bộ lọc
                    </Button>
                  }
                />
              ) : (
                <>
                  {pageItems.map((item) => (
                    <ProductCard key={item.id} layout="list" data={toCard(item)} />
                  ))}
                  <Pagination
                    page={page}
                    pageSize={query.size}
                    total={results.length}
                    onPageChange={(p) => {
                      update({ page: p }, false);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    onPageSizeChange={(size) => update({ size })}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Lọc kết quả" className="!p-4">
        {sidebar}
        <Button fullWidth className="mt-4" onClick={() => setFiltersOpen(false)}>
          Xem {results.length} kết quả
        </Button>
      </Modal>
    </div>
  );
}
