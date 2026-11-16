import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { Dropdown } from '@/components/forms/Dropdown';
import { PRICE_RANGES } from '@/data/content';
import { useClickOutside } from '@/hooks/useClickOutside';
import { normalizeText } from '@/utils/format';
import { cx } from '@/utils/cx';
import { buildSearchQuery, type CatalogQuery } from '../query';

export interface SearchSuggestion {
  title: string;
  to: string;
}

interface SearchBoxProps {
  title: string;
  description: string;
  placeholder: string;
  /** Route that receives the query string. */
  searchPath: string;
  locations: { id: string; name: string }[];
  suggestions: SearchSuggestion[];
  initial?: Partial<CatalogQuery>;
  /** Listing pages apply the search in place instead of navigating away. */
  onSearch?: (query: Partial<CatalogQuery>) => void;
  className?: string;
  /** Home/landing variant is narrower (1008px); listing variant is full width. */
  variant?: 'hero' | 'listing';
  locationKey?: 'category' | 'city';
}

export function SearchBox({
  title,
  description,
  placeholder,
  searchPath,
  locations,
  suggestions,
  initial,
  onSearch,
  className,
  variant = 'hero',
  locationKey = 'category',
}: SearchBoxProps) {
  const navigate = useNavigate();
  const [text, setText] = useState(initial?.title ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [price, setPrice] = useState(
    PRICE_RANGES.findIndex((r) => r.min === initial?.minPrice && r.max === initial?.maxPrice),
  );
  const [suggestOpen, setSuggestOpen] = useState(false);
  const suggestRef = useClickOutside<HTMLDivElement>(() => setSuggestOpen(false), suggestOpen);

  const matches = useMemo(() => {
    const q = normalizeText(text);
    if (!q) return [];
    return suggestions.filter((s) => normalizeText(s.title).includes(q)).slice(0, 8);
  }, [text, suggestions]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const range = PRICE_RANGES[price] ?? PRICE_RANGES[0];
    const query: Partial<CatalogQuery> = {
      title: text.trim() || undefined,
      location: location || undefined,
      minPrice: range.min,
      maxPrice: range.max,
    };
    setSuggestOpen(false);
    if (onSearch) onSearch(query);
    else navigate(`${searchPath}?${buildSearchQuery(query, locationKey)}`);
  };

  const locationOptions = [{ label: 'Tất cả địa điểm', value: '' }, ...locations.map((l) => ({ label: l.name, value: l.id }))];
  const priceOptions = PRICE_RANGES.map((r, i) => ({ label: r.label, value: i }));

  return (
    <Card className={cx('mx-auto flex w-[95%] flex-col gap-4 p-4 lg:gap-0 lg:px-6 lg:pb-6 lg:pt-10', variant === 'hero' ? 'lg:w-[1008px]' : 'lg:w-full', className)}>
      <div className="flex flex-col items-center gap-2 text-center lg:gap-4">
        <h4 className="m-0 mx-auto max-w-[90%] text-2xl leading-8 lg:max-w-none lg:text-[36px] lg:leading-[44px]">{title}</h4>
        <p className="md !text-base lg:!text-lg" style={{ opacity: 0.6, color: 'var(--gray-900)' }}>
          {description}
        </p>
      </div>
      <form onSubmit={submit} role="search" className="flex flex-col gap-2 lg:mt-10 lg:flex-row lg:items-center lg:gap-5">
        <div ref={suggestRef} className="relative flex-1">
          <div className="flex items-center gap-2 rounded-input border border-gray-200 bg-white px-5 py-4 shadow-xs focus-within:border-primary focus-within:shadow-[0_0_0_4px_var(--primary-light)]">
            <Icon name="search" size={20} className="shrink-0 text-gray-400" />
            <input
              aria-label={placeholder}
              value={text}
              placeholder={placeholder}
              onChange={(e) => {
                setText(e.target.value);
                setSuggestOpen(true);
              }}
              onFocus={() => setSuggestOpen(true)}
              className="h-6 w-0 flex-grow border-none bg-transparent text-base text-gray-800 outline-none placeholder:text-gray-400"
            />
          </div>
          {suggestOpen && matches.length > 0 && (
            <ul className="absolute left-0 right-0 top-[calc(100%+12px)] z-dropdown max-h-80 overflow-auto rounded-lg border border-gray-100 bg-white py-1 text-left shadow-dropdown">
              {matches.map((m) => (
                <li key={m.to}>
                  <Link to={m.to} className="block px-[30px] py-[15px] text-gray-900 hover:bg-gray-50">
                    {m.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Dropdown
          ariaLabel="Địa điểm"
          options={locationOptions}
          value={location}
          onChange={setLocation}
          icon={<Icon name="location" size={20} />}
          className="w-full lg:w-[210px]"
          menuClassName="lg:min-w-[300px]"
        />
        <Dropdown
          ariaLabel="Mức giá"
          options={priceOptions}
          value={Math.max(price, 0)}
          onChange={setPrice}
          icon={<Icon name="coin" size={20} />}
          className="w-full lg:w-[210px]"
          menuClassName="lg:min-w-[300px]"
        />
        <Button type="submit" className="w-full lg:w-auto">
          Tìm kiếm
        </Button>
      </form>
    </Card>
  );
}
