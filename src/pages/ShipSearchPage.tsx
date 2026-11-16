import { useCallback } from 'react';
import { ROUTES } from '@/constants/routes';
import { HOME_COPY } from '@/data/content';
import { CatalogListing } from '@/features/catalog/components/CatalogListing';
import { SearchBox } from '@/features/catalog/components/SearchBox';
import { useShipLookups } from '@/features/catalog/hooks';
import { shipToCard } from '@/features/catalog/mappers';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { catalogService } from '@/services/catalogService';
import type { ShipSummary } from '@/types/models';

/** Star filter matches the integer part of the review score (source behaviour). */
const shipStars = (s: ShipSummary) => Math.floor(s.score);
const shipLocation = (s: ShipSummary) => s.categoryId;

export function ShipSearchPage() {
  useDocumentTitle('Tìm du thuyền');
  const ships = useAsync(() => catalogService.ships(), []);
  const { lookups } = useShipLookups();
  const toCard = useCallback(
    (s: ShipSummary) => shipToCard(s, lookups.categoryName(s.categoryId), lookups.features),
    [lookups.categoryName, lookups.features],
  );
  const suggestions = (ships.data ?? []).map((s) => ({ title: s.title, to: ROUTES.shipDetail(s.slug) }));

  return (
    <CatalogListing
      items={ships.data}
      loading={ships.loading}
      error={ships.error}
      onRetry={ships.reload}
      locationKey="category"
      locationOf={shipLocation}
      starsOf={shipStars}
      toCard={toCard}
      featureOptions={lookups.features}
      renderSearch={(query, apply) => (
        <SearchBox
          key={JSON.stringify([query.title, query.location, query.minPrice, query.maxPrice])}
          variant="listing"
          title={HOME_COPY.ship.searchTitle}
          description={HOME_COPY.ship.searchDescription}
          placeholder="Nhập tên du thuyền"
          searchPath={ROUTES.shipSearch}
          locations={lookups.categories}
          suggestions={suggestions}
          initial={query}
          onSearch={apply}
        />
      )}
    />
  );
}
