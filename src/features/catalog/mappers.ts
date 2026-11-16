import { ROUTES } from '@/constants/routes';
import type { HotelSummary, ShipSummary } from '@/types/models';
import type { ProductCardData } from './components/ProductCard';

export function shipSpecLine(ship: Pick<ShipSummary, 'spec'>): string {
  const { launch, shell, cabin } = ship.spec;
  return [launch && `Hạ thuỷ ${launch}`, shell && `Tàu vỏ ${shell}`, cabin && `${cabin} phòng`].filter(Boolean).join(' - ');
}

/** Ship tags follow the global amenity order, like the source listing. */
export function shipToCard(ship: ShipSummary, categoryName: string | undefined, features: { id: string; text: string }[]): ProductCardData {
  return {
    to: ROUTES.shipDetail(ship.slug),
    title: ship.title,
    thumbnail: ship.thumbnail,
    location: categoryName,
    description: shipSpecLine(ship),
    descriptionIcon: 'ship',
    price: ship.price,
    unit: 'khách',
    score: ship.score,
    numReviews: ship.numReviews,
    tags: features.filter((f) => ship.features.includes(f.id)).map((f) => f.text),
  };
}

export function hotelToCard(hotel: HotelSummary, featureText: (id: string) => string | undefined): ProductCardData {
  return {
    to: ROUTES.hotelDetail(hotel.slug),
    title: hotel.title,
    thumbnail: hotel.thumbnail,
    location: hotel.cityName,
    description: hotel.spec.totalRooms ? `${hotel.spec.totalRooms} phòng` : '',
    descriptionIcon: 'bed',
    price: hotel.price,
    originalPrice: hotel.originalPrice,
    unit: 'phòng',
    score: hotel.standard ?? hotel.score,
    numReviews: hotel.numReviews,
    tags: hotel.features.map(featureText).filter((t): t is string => !!t),
  };
}
