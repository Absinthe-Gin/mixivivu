import type {
  BlogDetail,
  BlogSummary,
  Category,
  City,
  Faq,
  Feature,
  HotelDetail,
  HotelSummary,
  ShipDetail,
  ShipSummary,
  StaticPage,
} from '@/types/models';
import { getJson } from './http';

export const catalogService = {
  categories: () => getJson<Category[]>('categories.json'),
  shipFeatures: () => getJson<Feature[]>('features.json'),
  hotelFeatures: () => getJson<{ id: string; text: string }[]>('hotel-features.json'),
  cities: () => getJson<City[]>('cities.json'),

  ships: () => getJson<ShipSummary[]>('ships.json'),
  ship: (slug: string) => getJson<ShipDetail>(`ships/${encodeURIComponent(slug)}.json`),

  hotels: () => getJson<HotelSummary[]>('hotels.json'),
  hotel: (slug: string) => getJson<HotelDetail>(`hotels/${encodeURIComponent(slug)}.json`),

  blogs: () => getJson<BlogSummary[]>('blogs.json'),
  blog: (slug: string) => getJson<BlogDetail>(`blogs/${encodeURIComponent(slug)}.json`),

  page: (key: string) => getJson<StaticPage>(`pages/${key}.json`),
  faqs: (kind: 'ship' | 'hotel') => getJson<Faq[]>(`pages/faq-${kind}.json`),
};
