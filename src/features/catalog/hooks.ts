import { useCallback, useMemo } from 'react';
import { useAsync } from '@/hooks/useAsync';
import { catalogService } from '@/services/catalogService';
import type { Category, Feature } from '@/types/models';

export interface ShipLookups {
  categories: Category[];
  features: Feature[];
  categoryName: (id: string) => string | undefined;
  featureText: (id: string) => string | undefined;
}

/** Categories + ship/room features with id→label helpers. */
export function useShipLookups() {
  const state = useAsync(() => Promise.all([catalogService.categories(), catalogService.shipFeatures()]), []);
  const [categories, features] = state.data ?? [[], []];

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const featMap = useMemo(() => new Map(features.map((f) => [f.id, f.text])), [features]);
  const categoryName = useCallback((id: string) => catMap.get(id), [catMap]);
  const featureText = useCallback((id: string) => featMap.get(id), [featMap]);

  const lookups: ShipLookups = { categories, features, categoryName, featureText };
  return { ...state, lookups };
}

export function useHotelLookups() {
  const state = useAsync(() => Promise.all([catalogService.cities(), catalogService.hotelFeatures()]), []);
  const [cities, features] = state.data ?? [[], []];
  const featMap = useMemo(() => new Map(features.map((f) => [f.id, f.text])), [features]);
  const featureText = useCallback((id: string) => featMap.get(id), [featMap]);
  return { ...state, cities, features, featureText };
}
