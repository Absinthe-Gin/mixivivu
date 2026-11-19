/** Read-only tools over the public ship/hotel catalog and site help. */
import { catalogStats, hotelDetails, searchHelp, searchHotels, searchShips, shipDetails, type StatsGroup } from '../../catalog.ts';
import type { AnyTool, ToolDefinition } from './types.ts';

const CATEGORY = 'Du thuyền & khách sạn';

const searchShipsTool: ToolDefinition<{ query?: string; destination?: string; min_price?: number; max_price?: number; min_rating?: number; amenities?: string[]; sort?: 'price_asc' | 'price_desc' | 'rating'; limit?: number }> = {
  name: 'search_ships',
  category: CATEGORY,
  label: 'Đang tìm du thuyền…',
  description:
    'Search Ha Long Bay cruise ships by name, destination, price range (VND per guest), minimum rating and amenities. Returns the total count and a short list with link and slug.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', maxLength: 100, description: 'Part of the ship name, e.g. "Ambassador"' },
      destination: { type: 'string', maxLength: 60, description: 'Vịnh Hạ Long, Vịnh Lan Hạ or Đảo Cát Bà' },
      min_price: { type: 'number', minimum: 0, description: 'Minimum price per guest in VND (full number: "3 triệu" = 3000000)' },
      max_price: { type: 'number', minimum: 0, description: 'Maximum price per guest in VND (full number: "4 triệu" = 4000000)' },
      min_rating: { type: 'number', minimum: 0, maximum: 5 },
      amenities: { type: 'array', maxItems: 6, items: { type: 'string', maxLength: 40 }, description: 'Required amenities, e.g. ["bể sục", "bể bơi"]' },
      sort: { type: 'string', enum: ['price_asc', 'price_desc', 'rating'] },
      limit: { type: 'integer', minimum: 1, maximum: 10 },
    },
    additionalProperties: false,
  },
  risk: 'read',
  confirmation: 'never',
  execute: (a) => {
    const r = searchShips(a);
    return { data: r, summary: `Đã tìm thấy ${r.total} du thuyền` };
  },
};

const shipDetailsTool: ToolDefinition<{ slug: string }> = {
  name: 'get_ship_details',
  category: CATEGORY,
  label: 'Đang xem chi tiết du thuyền…',
  description: 'Details of one cruise ship: port, schedule, itinerary, cabin types with prices, amenities, highlights, description.',
  parameters: { type: 'object', properties: { slug: { type: 'string', maxLength: 200, description: 'slug from search_ships' } }, required: ['slug'], additionalProperties: false },
  risk: 'read',
  confirmation: 'never',
  execute: (a) => {
    const d = shipDetails(a.slug);
    return { data: d, summary: 'error' in d ? 'Không tìm thấy du thuyền' : `Đã xem ${d.title}` };
  },
};

const searchHotelsTool: ToolDefinition<{ query?: string; city?: string; min_price?: number; max_price?: number; stars?: number; amenities?: string[]; sort?: 'price_asc' | 'price_desc'; limit?: number }> = {
  name: 'search_hotels',
  category: CATEGORY,
  label: 'Đang tìm khách sạn…',
  description: 'Search hotels by name, city (Hạ Long, Đà Nẵng, Nha Trang, Phú Quốc, Sapa, Hội An...), price range (VND per room per night), star rating and amenities.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', maxLength: 100 },
      city: { type: 'string', maxLength: 60 },
      min_price: { type: 'number', minimum: 0, description: 'VND per night, full number ("2 triệu" = 2000000)' },
      max_price: { type: 'number', minimum: 0, description: 'VND per night, full number ("2 triệu" = 2000000)' },
      stars: { type: 'integer', minimum: 1, maximum: 5 },
      amenities: { type: 'array', maxItems: 6, items: { type: 'string', maxLength: 40 } },
      sort: { type: 'string', enum: ['price_asc', 'price_desc'] },
      limit: { type: 'integer', minimum: 1, maximum: 10 },
    },
    additionalProperties: false,
  },
  risk: 'read',
  confirmation: 'never',
  execute: (a) => {
    const r = searchHotels(a);
    return { data: r, summary: `Đã tìm thấy ${r.total} khách sạn` };
  },
};

const hotelDetailsTool: ToolDefinition<{ slug: string }> = {
  name: 'get_hotel_details',
  category: CATEGORY,
  label: 'Đang xem chi tiết khách sạn…',
  description: 'Details of one hotel: address, stars, room types with prices, amenities, description.',
  parameters: { type: 'object', properties: { slug: { type: 'string', maxLength: 200, description: 'slug from search_hotels' } }, required: ['slug'], additionalProperties: false },
  risk: 'read',
  confirmation: 'never',
  execute: (a) => {
    const d = hotelDetails(a.slug);
    return { data: d, summary: 'error' in d ? 'Không tìm thấy khách sạn' : `Đã xem ${d.title}` };
  },
};

const helpTool: ToolDefinition<{ query: string }> = {
  name: 'search_help',
  category: 'Hướng dẫn & tài liệu',
  label: 'Đang tra cứu hướng dẫn…',
  description: 'Look up how to use the website, FAQs, general rules, cancellation/change policy, payment methods, terms and contact information.',
  parameters: { type: 'object', properties: { query: { type: 'string', minLength: 2, maxLength: 300 } }, required: ['query'], additionalProperties: false },
  risk: 'read',
  confirmation: 'never',
  execute: (a) => {
    const r = searchHelp(a.query);
    return {
      data: r,
      summary: `Đã tìm thấy ${r.results.length} mục hướng dẫn`,
      sources: r.results.map((c) => ({ title: c.source, link: c.link, sourceType: 'help' as const, snippet: c.text.slice(0, 160) })),
    };
  },
};

const statsTool: ToolDefinition<{ kind: 'ship' | 'hotel'; group_by?: StatsGroup }> = {
  name: 'catalog_statistics',
  category: CATEGORY,
  label: 'Đang tính thống kê…',
  description:
    'Exact price statistics (count, min, max, average, median) computed by the server over the whole catalog. Use for counting, comparing or summarising prices instead of estimating. Ships group by destination or rating_band; hotels by city or stars.',
  parameters: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['ship', 'hotel'] },
      group_by: { type: 'string', enum: ['destination', 'rating_band', 'city', 'stars'] },
    },
    required: ['kind'],
    additionalProperties: false,
  },
  risk: 'read',
  confirmation: 'never',
  execute: (a) => {
    const r = catalogStats(a.kind, a.group_by);
    return { data: r, summary: `Đã thống kê ${r.total_items} ${a.kind === 'ship' ? 'du thuyền' : 'khách sạn'}` };
  },
};

const compareTool: ToolDefinition<{ kind: 'ship' | 'hotel'; slugs: string[] }> = {
  name: 'compare_items',
  category: CATEGORY,
  label: 'Đang so sánh…',
  description: 'Side-by-side facts for 2-4 ships or hotels (price, rating, rooms, amenities) so you can present a comparison table.',
  parameters: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['ship', 'hotel'] },
      slugs: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'string', maxLength: 200 } },
    },
    required: ['kind', 'slugs'],
    additionalProperties: false,
  },
  risk: 'read',
  confirmation: 'never',
  execute: (a) => {
    const rows = a.slugs.map((slug) => {
      const d = a.kind === 'ship' ? shipDetails(slug) : hotelDetails(slug);
      if ('error' in d) return { slug, error: d.error };
      const { description: _d, rooms, ...rest } = d as typeof d & { description?: string; rooms: unknown[] };
      return { ...rest, room_types: rooms.length };
    });
    return { data: { items: rows }, summary: `Đã so sánh ${rows.length} lựa chọn` };
  },
};

export const catalogTools: AnyTool[] = [searchShipsTool, shipDetailsTool, searchHotelsTool, hotelDetailsTool, helpTool, statsTool, compareTool];
