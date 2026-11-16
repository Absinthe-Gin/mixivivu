import { useMemo } from 'react';
import { ROUTES } from '@/constants/routes';
import { HOME_COPY } from '@/data/content';
import { CatalogListing } from '@/features/catalog/components/CatalogListing';
import { SearchBox } from '@/features/catalog/components/SearchBox';
import { useHotelLookups } from '@/features/catalog/hooks';
import { hotelToCard } from '@/features/catalog/mappers';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { catalogService } from '@/services/catalogService';
import type { HotelSummary } from '@/types/models';

const hotelStars = (h: HotelSummary) => h.standard ?? 0;
const hotelLocation = (h: HotelSummary) => h.cityId;

/** Cities that actually have hotels, for the location dropdown. */
export function useHotelCities(hotels: HotelSummary[] | undefined) {
  return useMemo(() => {
    const seen = new Map<string, string>();
    hotels?.forEach((h) => h.cityId && h.cityName && seen.set(h.cityId, h.cityName));
    return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [hotels]);
}

export function HotelSearchPage() {
  useDocumentTitle('Tìm khách sạn');
  const hotels = useAsync(() => catalogService.hotels(), []);
  const { features, featureText } = useHotelLookups();
  const cities = useHotelCities(hotels.data);
  const suggestions = (hotels.data ?? []).map((h) => ({ title: h.title, to: ROUTES.hotelDetail(h.slug) }));

  return (
    <CatalogListing
      items={hotels.data}
      loading={hotels.loading}
      error={hotels.error}
      onRetry={hotels.reload}
      locationKey="city"
      locationOf={hotelLocation}
      starsOf={hotelStars}
      toCard={(h) => ({ ...hotelToCard(h, featureText), ratingDecimals: 0 })}
      featureOptions={features}
      renderSearch={(query, apply) => (
        <SearchBox
          key={JSON.stringify([query.title, query.location, query.minPrice, query.maxPrice])}
          variant="listing"
          title={HOME_COPY.hotel.searchTitle}
          description={HOME_COPY.hotel.listingSearchDescription}
          placeholder="Nhập tên khách sạn"
          searchPath={ROUTES.hotelSearch}
          locationKey="city"
          locations={cities}
          suggestions={suggestions}
          initial={query}
          onSearch={apply}
        />
      )}
    />
  );
}
