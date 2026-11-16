import type { SortOrder } from '@/data/content';
import { normalizeText } from '@/utils/format';

/**
 * Catalog search state. URL parameter names follow the source site:
 * title, category, greater_defaultPrice, lower_defaultPrice.
 * Hotels use `city` instead of `category`.
 */
export interface CatalogQuery {
  title?: string;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  stars: number[];
  features: string[];
  sort: SortOrder;
  page: number;
  size: number;
}

export const DEFAULT_PAGE_SIZE = 5;

export function parseSearchQuery(params: URLSearchParams, locationKey: 'category' | 'city' = 'category'): CatalogQuery {
  const num = (k: string) => {
    const v = params.get(k);
    return v && !Number.isNaN(Number(v)) ? Number(v) : undefined;
  };
  const sort = params.get('sort');
  return {
    title: params.get('title') ?? undefined,
    location: params.get(locationKey) ?? undefined,
    minPrice: num('greater_defaultPrice'),
    maxPrice: num('lower_defaultPrice'),
    stars: params.getAll('star').map(Number).filter(Boolean),
    features: params.getAll('feature'),
    sort: sort === 'ASC' || sort === 'DESC' ? sort : '',
    page: Math.max(1, num('page') ?? 1),
    size: Math.min(50, Math.max(1, num('size') ?? DEFAULT_PAGE_SIZE)),
  };
}

export function buildSearchQuery(q: Partial<CatalogQuery>, locationKey: 'category' | 'city' = 'category'): string {
  const p = new URLSearchParams();
  if (q.title) p.set('title', q.title);
  if (q.location) p.set(locationKey, q.location);
  if (q.minPrice !== undefined) p.set('greater_defaultPrice', String(q.minPrice));
  if (q.maxPrice !== undefined) p.set('lower_defaultPrice', String(q.maxPrice));
  q.stars?.forEach((s) => p.append('star', String(s)));
  q.features?.forEach((f) => p.append('feature', f));
  if (q.sort) p.set('sort', q.sort);
  if (q.page && q.page > 1) p.set('page', String(q.page));
  if (q.size && q.size !== DEFAULT_PAGE_SIZE) p.set('size', String(q.size));
  return p.toString();
}

export interface Filterable {
  title: string;
  price: number;
  features: string[];
}

/** Apply text, location, price, star, feature filters and sort. */
export function applyCatalogQuery<T extends Filterable>(
  items: T[],
  q: CatalogQuery,
  accessors: { location: (item: T) => string | undefined; stars: (item: T) => number },
): T[] {
  const text = q.title ? normalizeText(q.title) : '';
  const filtered = items.filter(
    (item) =>
      (!text || normalizeText(item.title).includes(text)) &&
      (!q.location || accessors.location(item) === q.location) &&
      (q.minPrice === undefined || item.price >= q.minPrice) &&
      (q.maxPrice === undefined || item.price <= q.maxPrice) &&
      (q.stars.length === 0 || q.stars.includes(accessors.stars(item))) &&
      q.features.every((f) => item.features.includes(f)),
  );
  if (q.sort) {
    const dir = q.sort === 'ASC' ? 1 : -1;
    return [...filtered].sort((a, b) => (a.price - b.price) * dir);
  }
  return filtered;
}
