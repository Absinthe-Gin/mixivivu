export interface Category {
  id: string;
  name: string;
  image: string;
}

export interface Feature {
  id: string;
  text: string;
  icon?: string;
  type: 'ship' | 'room';
}

export interface City {
  id: string;
  name: string;
}

export interface Rating {
  numReviews: number;
  score: number;
  starCount: Record<string, number>;
}

export type ContentBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'header'; level: number; text: string }
  | { type: 'image'; url: string; caption?: string }
  | { type: 'list'; style: 'ordered' | 'unordered'; items: string[] };

export interface Room {
  id: string;
  title: string;
  size: number | null;
  maxPersons: number | null;
  price: number;
  salePrice: number;
  /** Feature ids (ships) or feature labels (hotels). */
  features: string[];
  images: string[];
}

export interface Review {
  id: string;
  name: string;
  score: number;
  comment: string;
  date: string | null;
}

export interface ShipSummary extends Rating {
  id: string;
  slug: string;
  title: string;
  thumbnail: string;
  categoryId: string;
  price: number;
  features: string[];
  spec: { launch?: string; cabin?: number; shell?: string; trip?: string; admin?: string };
}

export interface ProductDetailExtras {
  address: string;
  mapLink?: string;
  mapIframeLink?: string;
  images: string[];
  highlights: string[];
  content: ContentBlock[];
  rooms: Room[];
  reviews: Review[];
}

export interface ShipDetail extends ShipSummary, ProductDetailExtras {
  schedule?: string;
  scheduleLink?: string;
}

export interface HotelSummary extends Rating {
  id: string;
  slug: string;
  title: string;
  thumbnail: string;
  cityId?: string;
  cityName?: string;
  price: number;
  originalPrice: number;
  standard?: number;
  features: string[];
  spec: { totalRooms?: number; admin?: string };
}

export type HotelDetail = HotelSummary & ProductDetailExtras;

export type BlogType = 'travel' | 'hotel' | 'ship';

export interface BlogSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  thumbnail: string;
  type: BlogType;
  date: string | null;
}

export interface BlogDetail extends BlogSummary {
  content: ContentBlock[];
}

export interface StaticPage {
  title: string;
  html: string;
}

export interface Faq {
  question: string;
  answer: string;
}

export interface Testimonial {
  name: string;
  title?: string;
  content: string;
}
