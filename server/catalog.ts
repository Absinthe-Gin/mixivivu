/**
 * Read-only access to the mock API in public/data, used by the chatbot's
 * tools. Everything here runs on the server (Vite middleware or serve.ts).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SITE_GUIDE } from './siteGuide.ts';

const DATA_DIR = join(process.cwd(), 'public', 'data');
const cache = new Map<string, unknown>();

function load<T>(rel: string): T | null {
  if (!cache.has(rel)) {
    try {
      cache.set(rel, JSON.parse(readFileSync(join(DATA_DIR, rel), 'utf8')));
    } catch {
      cache.set(rel, null);
    }
  }
  return cache.get(rel) as T | null;
}

export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

const formatVnd = (n: number) => `${new Intl.NumberFormat('en-US').format(n)}đ`;

interface Named {
  id: string;
  name?: string;
  text?: string;
}
interface ShipRow {
  id: string;
  slug: string;
  title: string;
  categoryId: string;
  price: number;
  features: string[];
  score: number;
  numReviews: number;
  spec: { launch?: string; cabin?: number; shell?: string; trip?: string };
}
interface HotelRow {
  id: string;
  slug: string;
  title: string;
  cityId?: string;
  cityName?: string;
  price: number;
  originalPrice: number;
  standard?: number;
  features: string[];
  score: number;
  numReviews: number;
  spec: { totalRooms?: number };
}
interface Room {
  title: string;
  size: number | null;
  maxPersons: number | null;
  price: number;
  salePrice: number;
  features: string[];
}
interface Block {
  type: string;
  text?: string;
  items?: string[];
}

const ships = () => load<ShipRow[]>('ships.json') ?? [];
const hotels = () => load<HotelRow[]>('hotels.json') ?? [];
const categories = () => load<Named[]>('categories.json') ?? [];
const shipFeatures = () => load<Named[]>('features.json') ?? [];
const hotelFeatures = () => load<Named[]>('hotel-features.json') ?? [];

const nameOf = (list: Named[], id: string) => list.find((x) => x.id === id)?.name ?? list.find((x) => x.id === id)?.text;
const matches = (haystack: string, needle?: string) => !needle || normalize(haystack).includes(normalize(needle));

/** Resolve free-text amenity names ("bể bơi", "jacuzzi") to feature ids. */
function featureIds(list: Named[], wanted: string[] | undefined): string[] | null {
  if (!wanted?.length) return [];
  const ids: string[] = [];
  for (const w of wanted) {
    const hit = list.find((f) => normalize(f.text ?? '').includes(normalize(w)));
    if (!hit) return null;
    ids.push(hit.id);
  }
  return ids;
}

export interface ShipSearch {
  query?: string;
  destination?: string;
  min_price?: number;
  max_price?: number;
  min_rating?: number;
  amenities?: string[];
  sort?: 'price_asc' | 'price_desc' | 'rating';
  limit?: number;
}

export function searchShips(p: ShipSearch) {
  const cat = p.destination ? categories().find((c) => matches(c.name ?? '', p.destination)) : undefined;
  if (p.destination && !cat) {
    return { total: 0, note: `Không có điểm đến "${p.destination}". Các điểm đến: ${categories().map((c) => c.name).join(', ')}.`, results: [] };
  }
  const ids = featureIds(shipFeatures(), p.amenities);
  if (ids === null) {
    return { total: 0, note: `Không nhận ra tiện ích. Tiện ích có sẵn: ${shipFeatures().map((f) => f.text).join(', ')}.`, results: [] };
  }
  let rows = ships().filter(
    (s) =>
      matches(s.title, p.query) &&
      (!cat || s.categoryId === cat.id) &&
      (p.min_price === undefined || s.price >= p.min_price) &&
      (p.max_price === undefined || s.price <= p.max_price) &&
      (p.min_rating === undefined || s.score >= p.min_rating) &&
      ids.every((id) => s.features.includes(id)),
  );
  if (p.sort === 'price_asc') rows = [...rows].sort((a, b) => a.price - b.price);
  if (p.sort === 'price_desc') rows = [...rows].sort((a, b) => b.price - a.price);
  if (p.sort === 'rating') rows = [...rows].sort((a, b) => b.score - a.score || b.numReviews - a.numReviews);
  const limit = Math.min(Math.max(p.limit ?? 5, 1), 10);
  return {
    total: rows.length,
    results: rows.slice(0, limit).map((s) => ({
      title: s.title,
      link: `/du-thuyen/${encodeURIComponent(s.slug)}`,
      slug: s.slug,
      price_per_guest: formatVnd(s.price),
      rating: s.numReviews ? `${s.score.toFixed(1)}/5 (${s.numReviews} đánh giá)` : 'chưa có đánh giá',
      destination: nameOf(categories(), s.categoryId),
      launched: s.spec.launch,
      cabins: s.spec.cabin,
      route: s.spec.trip,
      amenities: s.features.map((id) => nameOf(shipFeatures(), id)).filter(Boolean).slice(0, 8),
    })),
  };
}

export interface HotelSearch {
  query?: string;
  city?: string;
  min_price?: number;
  max_price?: number;
  stars?: number;
  amenities?: string[];
  sort?: 'price_asc' | 'price_desc';
  limit?: number;
}

export function searchHotels(p: HotelSearch) {
  const ids = featureIds(hotelFeatures(), p.amenities);
  if (ids === null) {
    return { total: 0, note: `Không nhận ra tiện ích. Tiện ích có sẵn: ${hotelFeatures().map((f) => f.text).join(', ')}.`, results: [] };
  }
  let rows = hotels().filter(
    (h) =>
      matches(h.title, p.query) &&
      matches(h.cityName ?? '', p.city) &&
      (p.min_price === undefined || h.price >= p.min_price) &&
      (p.max_price === undefined || h.price <= p.max_price) &&
      (p.stars === undefined || h.standard === p.stars) &&
      ids.every((id) => h.features.includes(id)),
  );
  if (p.sort === 'price_asc') rows = [...rows].sort((a, b) => a.price - b.price);
  if (p.sort === 'price_desc') rows = [...rows].sort((a, b) => b.price - a.price);
  const limit = Math.min(Math.max(p.limit ?? 5, 1), 10);
  const cities = [...new Set(hotels().map((h) => h.cityName).filter(Boolean))];
  return {
    total: rows.length,
    ...(rows.length === 0 && p.city ? { note: `Thành phố có khách sạn: ${cities.join(', ')}.` } : {}),
    results: rows.slice(0, limit).map((h) => ({
      title: h.title,
      link: `/tim-khach-san/${encodeURIComponent(h.slug)}`,
      slug: h.slug,
      city: h.cityName,
      stars: h.standard,
      price_per_room: formatVnd(h.price),
      original_price: h.originalPrice > h.price ? formatVnd(h.originalPrice) : undefined,
      rooms: h.spec.totalRooms,
      amenities: h.features.map((id) => nameOf(hotelFeatures(), id)).filter(Boolean),
    })),
  };
}

const blocksToText = (blocks: Block[], max = 1500) =>
  blocks
    .map((b) => (b.type === 'list' ? (b.items ?? []).map((i) => `- ${i}`).join('\n') : b.text ?? ''))
    .join('\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .slice(0, max);

function roomsOut(rooms: Room[], featureName?: (id: string) => string | undefined) {
  return rooms.map((r) => ({
    name: r.title,
    size_m2: r.size,
    max_guests: r.maxPersons,
    price: formatVnd(r.salePrice > 0 && r.salePrice < r.price ? r.salePrice : r.price),
    amenities: featureName ? r.features.map(featureName).filter(Boolean) : r.features,
  }));
}

export function shipDetails(slug: string) {
  const s = load<ShipRow & { address: string; schedule?: string; highlights: string[]; rooms: Room[]; content: Block[]; spec: { admin?: string } }>(
    `ships/${encodeURIComponent(slug)}.json`,
  );
  if (!s) return { error: `Không tìm thấy du thuyền có mã "${slug}". Hãy dùng search_ships để lấy đúng slug.` };
  return {
    title: s.title,
    link: `/du-thuyen/${encodeURIComponent(s.slug)}`,
    price_from_per_guest: formatVnd(s.price),
    rating: s.numReviews ? `${s.score.toFixed(1)}/5 (${s.numReviews} đánh giá)` : 'chưa có đánh giá',
    departure_port: s.address,
    schedule: s.schedule,
    launched: s.spec.launch,
    cabins: s.spec.cabin,
    hull: s.spec.shell,
    route: s.spec.trip,
    operator: s.spec.admin,
    highlights: s.highlights,
    amenities: s.features.map((id) => nameOf(shipFeatures(), id)).filter(Boolean),
    rooms: roomsOut(s.rooms, (id) => nameOf(shipFeatures(), id)),
    description: blocksToText(s.content),
  };
}

export function hotelDetails(slug: string) {
  const h = load<HotelRow & { address: string; highlights: string[]; rooms: Room[]; content: Block[]; spec: { admin?: string } }>(
    `hotels/${encodeURIComponent(slug)}.json`,
  );
  if (!h) return { error: `Không tìm thấy khách sạn có mã "${slug}". Hãy dùng search_hotels để lấy đúng slug.` };
  return {
    title: h.title,
    link: `/tim-khach-san/${encodeURIComponent(h.slug)}`,
    city: h.cityName,
    stars: h.standard,
    address: h.address,
    price_from_per_room: formatVnd(h.price),
    original_price: h.originalPrice > h.price ? formatVnd(h.originalPrice) : undefined,
    rooms_total: h.spec.totalRooms,
    operator: h.spec.admin,
    highlights: h.highlights,
    amenities: h.features.map((id) => nameOf(hotelFeatures(), id)).filter(Boolean),
    rooms: roomsOut(h.rooms),
    description: blocksToText(h.content),
  };
}

// ---------- help / site guide ----------

interface HelpChunk {
  source: string;
  link: string;
  text: string;
}

const PAGES: [string, string, string][] = [
  ['quy-dinh-chung-va-luu-y', 'Quy định chung và lưu ý (du thuyền)', '/quy-dinh-chung-va-luu-y'],
  ['khach-san-quy-dinh-chung-va-luu-y', 'Quy định chung và lưu ý (khách sạn)', '/khach-san/quy-dinh-chung-va-luu-y'],
  ['hinh-thuc-thanh-toan', 'Hình thức thanh toán', '/hinh-thuc-thanh-toan'],
  ['huong-dan-su-dung', 'Hướng dẫn sử dụng', '/huong-dan-su-dung'],
  ['dieu-khoan-va-dieu-kien', 'Điều khoản và điều kiện', '/dieu-khoan-va-dieu-kien'],
  ['chinh-sach-rieng-tu', 'Chính sách riêng tư', '/chinh-sach-rieng-tu'],
];

let helpIndex: HelpChunk[] | null = null;

function buildHelpIndex(): HelpChunk[] {
  const chunks: HelpChunk[] = SITE_GUIDE.map((g) => ({ source: `Hướng dẫn: ${g.title}`, link: g.link, text: `${g.title}\n${g.text}` }));
  for (const [kind, link] of [['ship', '/cau-hoi-thuong-gap'], ['hotel', '/khach-san/cau-hoi-thuong-gap']] as const) {
    for (const f of load<{ question: string; answer: string }[]>(`pages/faq-${kind}.json`) ?? []) {
      chunks.push({
        source: `Câu hỏi thường gặp (${kind === 'ship' ? 'du thuyền' : 'khách sạn'})`,
        link,
        text: `${f.question}\n${f.answer.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`,
      });
    }
  }
  for (const [key, title, link] of PAGES) {
    const page = load<{ html: string }>(`pages/${key}.json`);
    if (!page) continue;
    const text = page.html
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<\/(p|div|li|h\d)>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/\n{2,}/g, '\n');
    // ~700-character chunks on line boundaries keep results focused.
    let buf = '';
    for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
      if (buf.length + line.length > 700) {
        chunks.push({ source: title, link, text: buf.trim() });
        buf = '';
      }
      buf += `${line}\n`;
    }
    if (buf.trim()) chunks.push({ source: title, link, text: buf.trim() });
  }
  return chunks;
}

const STOP = new Set(['co', 'khong', 'la', 'va', 'cua', 'cho', 'toi', 'minh', 'the', 'nao', 'gi', 'duoc', 'nhu', 'voi', 'thi', 'o', 'tai', 'mot', 'cac', 'nhung', 'bao', 'lam', 'sao']);

export function searchHelp(query: string, limit = 4) {
  helpIndex ??= buildHelpIndex();
  const index = helpIndex;
  const terms = normalize(query).split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !STOP.has(t));
  if (terms.length === 0) return { results: index.slice(0, limit) };
  const docs = index.map((c) => ` ${normalize(c.text).replace(/[^a-z0-9]+/g, ' ')} `);
  const heads = index.map((c) => ` ${normalize(c.text.split('\n')[0]).replace(/[^a-z0-9]+/g, ' ')} `);
  // IDF so common words ("du", "thuyen") weigh less than distinctive ones ("tre", "huy").
  const idf = (phrase: string) => {
    const df = docs.filter((d) => d.includes(` ${phrase} `)).length;
    return df ? Math.log((index.length + 1) / df) : 0;
  };
  const phrases = [...terms, ...terms.slice(1).map((t, i) => `${terms[i]} ${t}`)];
  const weights = new Map(phrases.map((p) => [p, idf(p) * (p.includes(' ') ? 2 : 1)]));
  const scored = index
    .map((c, i) => ({
      c,
      score: phrases.reduce((s, p) => s + (docs[i].includes(` ${p} `) ? weights.get(p)! * (heads[i].includes(` ${p} `) ? 1.5 : 1) : 0), 0),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.c);
  return scored.length ? { results: scored } : { results: [], note: 'Không tìm thấy nội dung phù hợp trong tài liệu hướng dẫn.' };
}

// ---------- lookups and aggregates used by agent tools ----------

/** Title and base price of a catalog item, or null when the slug is unknown. */
export function lookupItem(type: 'ship' | 'hotel', slug: string): { title: string; price: number } | null {
  const row = type === 'ship' ? ships().find((s) => s.slug === slug) : hotels().find((h) => h.slug === slug);
  return row ? { title: row.title, price: row.price } : null;
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

export type StatsGroup = 'destination' | 'rating_band' | 'city' | 'stars';

/** Price statistics computed in code (never by the model), grouped as requested. */
export function catalogStats(kind: 'ship' | 'hotel', groupBy?: StatsGroup) {
  const rows: { group: string; price: number; score: number }[] =
    kind === 'ship'
      ? ships().map((s) => ({
          group:
            groupBy === 'rating_band'
              ? s.numReviews
                ? `${Math.floor(s.score)}-${Math.floor(s.score) + 1} điểm`
                : 'chưa có đánh giá'
              : groupBy === 'destination'
                ? (nameOf(categories(), s.categoryId) ?? 'khác')
                : 'tất cả',
          price: s.price,
          score: s.score,
        }))
      : hotels().map((h) => ({
          group: groupBy === 'city' ? (h.cityName ?? 'khác') : groupBy === 'stars' ? (h.standard ? `${h.standard} sao` : 'chưa xếp hạng') : 'tất cả',
          price: h.price,
          score: h.score,
        }));
  const groups = new Map<string, number[]>();
  for (const r of rows) if (r.price > 0) groups.set(r.group, [...(groups.get(r.group) ?? []), r.price]);
  return {
    kind,
    group_by: groupBy ?? 'none',
    unit: kind === 'ship' ? 'VND/khách' : 'VND/phòng/đêm',
    total_items: rows.length,
    groups: [...groups.entries()]
      .map(([group, prices]) => ({
        group,
        count: prices.length,
        min: Math.min(...prices),
        max: Math.max(...prices),
        average: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
        median: median(prices),
      }))
      .sort((a, b) => b.count - a.count),
  };
}

export interface CorpusDoc {
  sourceType: 'blog' | 'help';
  ref: string;
  title: string;
  link: string;
  text: string;
  metadata?: Record<string, unknown>;
}

/** Public site content for the RAG index: blog articles plus help/FAQ/policy chunks. */
export function publicCorpus(): CorpusDoc[] {
  const docs: CorpusDoc[] = [];
  for (const b of load<{ slug: string; title: string; description: string; date: string; type: string }[]>('blogs.json') ?? []) {
    const detail = load<{ content: Block[] }>(`blogs/${b.slug}.json`);
    const body = detail ? blocksToText(detail.content, 20_000) : '';
    docs.push({
      sourceType: 'blog',
      ref: b.slug,
      title: b.title,
      link: `/blog-detail/${encodeURIComponent(b.slug)}`,
      text: `${b.title}\n${b.description}\n${body}`,
      metadata: { date: b.date, category: b.type },
    });
  }
  helpIndex ??= buildHelpIndex();
  helpIndex.forEach((c, i) => docs.push({ sourceType: 'help', ref: `help-${i}`, title: c.source, link: c.link, text: c.text }));
  return docs;
}
