/**
 * Tools over the user's own data: favorites, trip plans and notes.
 * The user id always comes from ctx (the session), never from arguments.
 */
import type { Trip, TripInput, TripStatus } from '../../domain/tripsService.ts';
import type { AnyTool, ToolDefinition } from './types.ts';

const vnd = (n: number | null | undefined) => (n == null ? '—' : `${new Intl.NumberFormat('en-US').format(n)}đ`);
const STATUS_VI: Record<TripStatus, string> = { planning: 'Đang lên kế hoạch', booked: 'Đã đặt', done: 'Đã đi', cancelled: 'Đã huỷ' };

const tripCard = (t: Trip) => ({
  kind: 'trip' as const,
  title: t.title,
  subtitle: [t.destination, t.startDate && `${t.startDate}${t.endDate && t.endDate !== t.startDate ? ` → ${t.endDate}` : ''}`].filter(Boolean).join(' · '),
  fields: [
    { label: 'Trạng thái', value: STATUS_VI[t.status] },
    ...(t.guests ? [{ label: 'Số khách', value: String(t.guests) }] : []),
    ...(t.budget ? [{ label: 'Ngân sách', value: vnd(t.budget) }] : []),
    ...(t.items.length ? [{ label: 'Mục', value: t.items.map((i) => i.title).join(', ') }] : []),
  ],
});

const tripView = (t: Trip) => ({
  id: t.id,
  title: t.title,
  destination: t.destination,
  start_date: t.startDate,
  end_date: t.endDate,
  guests: t.guests,
  budget_vnd: t.budget,
  status: t.status,
  notes: t.notes,
  items: t.items.map((i) => ({ id: i.id, type: i.itemType, title: i.title, link: i.link, date: i.dayDate, price_vnd: i.price })),
  estimated_cost_vnd: t.items.reduce((s, i) => s + (i.price ?? 0) * (i.itemType === 'ship' ? (t.guests ?? 1) : 1), 0) || null,
});

const tripFields = {
  title: { type: 'string', minLength: 1, maxLength: 120 },
  destination: { type: 'string', maxLength: 120 },
  start_date: { type: 'string', format: 'date', description: 'YYYY-MM-DD' },
  end_date: { type: 'string', format: 'date', description: 'YYYY-MM-DD' },
  guests: { type: 'integer', minimum: 1, maximum: 200 },
  budget: { type: 'number', minimum: 0, description: 'Total budget in VND' },
  status: { type: 'string', enum: ['planning', 'booked', 'done', 'cancelled'] },
  notes: { type: 'string', maxLength: 2000 },
};

// ---------- favorites ----------

const listFavorites: ToolDefinition<{ item_type?: 'ship' | 'hotel' }> = {
  name: 'list_favorites',
  category: 'Yêu thích',
  label: 'Đang xem danh sách yêu thích…',
  description: "List the user's saved (favorite) ships and hotels.",
  parameters: { type: 'object', properties: { item_type: { type: 'string', enum: ['ship', 'hotel'] } }, additionalProperties: false },
  risk: 'read',
  confirmation: 'never',
  execute: (a, ctx) => {
    const favs = ctx.services.favorites.list(ctx.userId, a.item_type);
    return { data: { total: favs.length, favorites: favs.map((f) => ({ id: f.id, type: f.itemType, title: f.title, link: f.link, slug: f.slug, note: f.note })) }, summary: `Có ${favs.length} mục yêu thích` };
  },
};

const addFavorite: ToolDefinition<{ item_type: 'ship' | 'hotel'; slug: string; note?: string }> = {
  name: 'add_favorite',
  category: 'Yêu thích',
  label: 'Đang lưu vào yêu thích…',
  description: 'Save a ship or hotel (by slug from search results) to the user favorites.',
  parameters: {
    type: 'object',
    properties: { item_type: { type: 'string', enum: ['ship', 'hotel'] }, slug: { type: 'string', maxLength: 200 }, note: { type: 'string', maxLength: 300 } },
    required: ['item_type', 'slug'],
    additionalProperties: false,
  },
  risk: 'write',
  confirmation: 'significant',
  isSignificant: () => false,
  preview: (a) => ({ title: 'Lưu vào yêu thích', target: a.slug, consequence: 'Mục này sẽ xuất hiện trong danh sách yêu thích của bạn.', risk: 'write' }),
  execute: (a, ctx) => {
    const { favorite, created } = ctx.services.favorites.add(ctx.userId, a.item_type, a.slug, a.note);
    return {
      data: { favorite, already_saved: !created },
      summary: created ? `Đã lưu ${favorite.title}` : `${favorite.title} đã có trong yêu thích`,
      card: { kind: 'favorite', title: favorite.title, subtitle: 'Yêu thích', link: favorite.link },
      episode: created ? `Đã lưu ${favorite.title} vào yêu thích` : undefined,
      auditTarget: favorite.title,
    };
  },
};

const removeFavorite: ToolDefinition<{ favorite_id: string }> = {
  name: 'remove_favorite',
  category: 'Yêu thích',
  label: 'Đang xoá khỏi yêu thích…',
  description: 'Remove one item from favorites (id from list_favorites).',
  parameters: { type: 'object', properties: { favorite_id: { type: 'string', maxLength: 64 } }, required: ['favorite_id'], additionalProperties: false },
  risk: 'destructive',
  confirmation: 'always',
  preview: (a, ctx) => {
    const f = ctx.services.favorites.get(ctx.userId, a.favorite_id);
    return { title: 'Xoá khỏi yêu thích', target: f.title, consequence: 'Mục này sẽ bị xoá khỏi danh sách yêu thích.', risk: 'destructive' };
  },
  execute: (a, ctx) => {
    const f = ctx.services.favorites.remove(ctx.userId, a.favorite_id);
    return { data: { removed: f.title }, summary: `Đã xoá ${f.title} khỏi yêu thích`, episode: `Đã xoá ${f.title} khỏi yêu thích`, auditTarget: f.title };
  },
};

// ---------- trips ----------

const listTrips: ToolDefinition<{ status?: TripStatus; query?: string }> = {
  name: 'list_trips',
  category: 'Kế hoạch chuyến đi',
  label: 'Đang xem các chuyến đi…',
  description: "List the user's trip plans (optionally filtered by status or a title/destination search). Use to find the id of a trip the user refers to.",
  parameters: { type: 'object', properties: { status: tripFields.status, query: { type: 'string', maxLength: 100 } }, additionalProperties: false },
  risk: 'read',
  confirmation: 'never',
  execute: (a, ctx) => {
    const trips = ctx.services.trips.list(ctx.userId, a);
    return { data: { total: trips.length, trips: trips.map(tripView) }, summary: `Đã tìm thấy ${trips.length} chuyến đi` };
  },
};

const getTrip: ToolDefinition<{ trip_id: string }> = {
  name: 'get_trip',
  category: 'Kế hoạch chuyến đi',
  label: 'Đang xem chuyến đi…',
  description: 'Get one trip plan with its items and estimated cost.',
  parameters: { type: 'object', properties: { trip_id: { type: 'string', maxLength: 64 } }, required: ['trip_id'], additionalProperties: false },
  risk: 'read',
  confirmation: 'never',
  execute: (a, ctx) => {
    const t = ctx.services.trips.get(ctx.userId, a.trip_id);
    return { data: tripView(t), summary: `Đã xem ${t.title}`, card: tripCard(t) };
  },
};

const createTrip: ToolDefinition<TripInput & { title: string }> = {
  name: 'create_trip',
  category: 'Kế hoạch chuyến đi',
  label: 'Đang tạo kế hoạch…',
  description: 'Create a trip plan. Ask the user for the title and dates first if they are missing; do not invent dates.',
  parameters: { type: 'object', properties: tripFields, required: ['title'], additionalProperties: false },
  risk: 'write',
  confirmation: 'significant',
  isSignificant: () => true,
  preview: (a) => ({
    title: 'Tạo kế hoạch chuyến đi',
    target: a.title,
    changes: [
      { field: 'Tên', after: a.title },
      ...(a.destination ? [{ field: 'Điểm đến', after: a.destination }] : []),
      ...(a.start_date ? [{ field: 'Ngày đi', after: a.start_date }] : []),
      ...(a.end_date ? [{ field: 'Ngày về', after: a.end_date }] : []),
      ...(a.guests ? [{ field: 'Số khách', after: String(a.guests) }] : []),
      ...(a.budget ? [{ field: 'Ngân sách', after: vnd(a.budget) }] : []),
    ],
    consequence: 'Một kế hoạch mới sẽ được thêm vào tài khoản của bạn. Bạn có thể sửa hoặc xoá sau.',
    risk: 'write',
  }),
  execute: (a, ctx) => {
    const t = ctx.services.trips.create(ctx.userId, a);
    return { data: tripView(t), summary: `Đã tạo ${t.title}`, card: tripCard(t), episode: `Đã tạo kế hoạch chuyến đi "${t.title}"`, auditTarget: t.title };
  },
};

const updateTrip: ToolDefinition<TripInput & { trip_id: string }> = {
  name: 'update_trip',
  category: 'Kế hoạch chuyến đi',
  label: 'Đang cập nhật chuyến đi…',
  description: 'Update fields of an existing trip plan (only the fields given change). Resolve the trip id with list_trips first.',
  parameters: { type: 'object', properties: { trip_id: { type: 'string', maxLength: 64 }, ...tripFields }, required: ['trip_id'], additionalProperties: false },
  risk: 'write',
  confirmation: 'significant',
  isSignificant: () => true,
  preview: (a, ctx) => {
    const t = ctx.services.trips.get(ctx.userId, a.trip_id);
    const rows: [string, string | null | undefined, string | null | undefined][] = [
      ['Tên', t.title, a.title],
      ['Điểm đến', t.destination, a.destination],
      ['Ngày đi', t.startDate, a.start_date],
      ['Ngày về', t.endDate, a.end_date],
      ['Số khách', t.guests?.toString(), a.guests?.toString()],
      ['Ngân sách', t.budget != null ? vnd(t.budget) : null, a.budget != null ? vnd(a.budget) : undefined],
      ['Trạng thái', STATUS_VI[t.status], a.status ? STATUS_VI[a.status] : undefined],
      ['Ghi chú', t.notes, a.notes],
    ];
    return {
      title: 'Cập nhật kế hoạch chuyến đi',
      target: t.title,
      changes: rows.filter(([, , after]) => after !== undefined).map(([field, before, after]) => ({ field, before: before ?? '—', after: after ?? '—' })),
      consequence: 'Thông tin chuyến đi sẽ được thay đổi như trên.',
      risk: 'write',
    };
  },
  execute: (a, ctx) => {
    const { trip_id, ...patch } = a;
    const t = ctx.services.trips.update(ctx.userId, trip_id, patch);
    return { data: tripView(t), summary: `Đã cập nhật ${t.title}`, card: tripCard(t), episode: `Đã cập nhật chuyến đi "${t.title}"`, auditTarget: t.title };
  },
};

const addTripItem: ToolDefinition<{ trip_id: string; item_type: 'ship' | 'hotel' | 'activity'; slug?: string; title?: string; day_date?: string; price?: number }> = {
  name: 'add_trip_item',
  category: 'Kế hoạch chuyến đi',
  label: 'Đang thêm vào chuyến đi…',
  description: 'Add a ship or hotel (by slug) or a free-text activity (by title) to a trip plan.',
  parameters: {
    type: 'object',
    properties: {
      trip_id: { type: 'string', maxLength: 64 },
      item_type: { type: 'string', enum: ['ship', 'hotel', 'activity'] },
      slug: { type: 'string', maxLength: 200, description: 'Required for ship/hotel' },
      title: { type: 'string', maxLength: 200, description: 'Required for activity' },
      day_date: { type: 'string', format: 'date' },
      price: { type: 'number', minimum: 0 },
    },
    required: ['trip_id', 'item_type'],
    additionalProperties: false,
  },
  risk: 'write',
  confirmation: 'significant',
  isSignificant: () => false,
  preview: (a, ctx) => {
    const t = ctx.services.trips.get(ctx.userId, a.trip_id);
    return { title: 'Thêm vào chuyến đi', target: t.title, changes: [{ field: 'Thêm', after: a.slug ?? a.title ?? '' }], consequence: 'Mục này sẽ được thêm vào kế hoạch.', risk: 'write' };
  },
  execute: (a, ctx) => {
    const { trip_id, ...item } = a;
    const t = ctx.services.trips.addItem(ctx.userId, trip_id, item);
    const added = t.items[t.items.length - 1];
    return { data: tripView(t), summary: `Đã thêm vào ${t.title}`, card: tripCard(t), episode: `Đã thêm "${added?.title}" vào chuyến đi "${t.title}"`, auditTarget: t.title };
  },
};

const deleteTrip: ToolDefinition<{ trip_id: string }> = {
  name: 'delete_trip',
  category: 'Kế hoạch chuyến đi',
  label: 'Đang xoá chuyến đi…',
  description: 'Delete a trip plan and its items. Only call when the user explicitly asks to delete it.',
  parameters: { type: 'object', properties: { trip_id: { type: 'string', maxLength: 64 } }, required: ['trip_id'], additionalProperties: false },
  risk: 'destructive',
  confirmation: 'always',
  preview: (a, ctx) => {
    const t = ctx.services.trips.get(ctx.userId, a.trip_id);
    return {
      title: 'Xoá kế hoạch chuyến đi',
      target: t.title,
      changes: [{ field: 'Kế hoạch', before: `${t.title}${t.startDate ? ` (${t.startDate})` : ''}`, after: 'Đã xoá' }, ...(t.items.length ? [{ field: 'Mục kèm theo', before: `${t.items.length} mục`, after: 'Đã xoá' }] : [])],
      consequence: 'Kế hoạch và mọi mục bên trong sẽ bị xoá khỏi danh sách của bạn.',
      risk: 'destructive',
    };
  },
  execute: (a, ctx) => {
    const t = ctx.services.trips.remove(ctx.userId, a.trip_id);
    return { data: { deleted: t.title }, summary: `Đã xoá ${t.title}`, episode: `Đã xoá kế hoạch chuyến đi "${t.title}"`, auditTarget: t.title };
  },
};

// ---------- notes ----------

const noteView = (n: { id: string; title: string; content: string; tags: string[]; updatedAt: string }, full = false) => ({
  id: n.id,
  title: n.title,
  content: full ? n.content : n.content.slice(0, 200),
  tags: n.tags,
  updated_at: n.updatedAt,
});

const searchNotes: ToolDefinition<{ query?: string; tag?: string; limit?: number }> = {
  name: 'search_notes',
  category: 'Ghi chú',
  label: 'Đang tìm ghi chú…',
  description: "Find the user's notes by text or tag (empty query lists the latest). Use to resolve which note the user means.",
  parameters: { type: 'object', properties: { query: { type: 'string', maxLength: 100 }, tag: { type: 'string', maxLength: 40 }, limit: { type: 'integer', minimum: 1, maximum: 50 } }, additionalProperties: false },
  risk: 'read',
  confirmation: 'never',
  execute: (a, ctx) => {
    const r = ctx.services.notes.list(ctx.userId, a);
    return { data: { total: r.total, notes: r.notes.map((n) => noteView(n)) }, summary: `Đã tìm thấy ${r.total} ghi chú` };
  },
};

const getNote: ToolDefinition<{ note_id: string }> = {
  name: 'get_note',
  category: 'Ghi chú',
  label: 'Đang đọc ghi chú…',
  description: 'Read a full note.',
  parameters: { type: 'object', properties: { note_id: { type: 'string', maxLength: 64 } }, required: ['note_id'], additionalProperties: false },
  risk: 'read',
  confirmation: 'never',
  execute: (a, ctx) => {
    const n = ctx.services.notes.get(ctx.userId, a.note_id);
    return { data: noteView(n, true), summary: `Đã đọc "${n.title}"` };
  },
};

const createNote: ToolDefinition<{ title: string; content?: string; tags?: string[] }> = {
  name: 'create_note',
  category: 'Ghi chú',
  label: 'Đang tạo ghi chú…',
  description: 'Create a personal note (packing list, reminders, ideas...).',
  parameters: {
    type: 'object',
    properties: { title: { type: 'string', minLength: 1, maxLength: 120 }, content: { type: 'string', maxLength: 5000 }, tags: { type: 'array', maxItems: 10, items: { type: 'string', maxLength: 30 } } },
    required: ['title'],
    additionalProperties: false,
  },
  risk: 'write',
  confirmation: 'significant',
  isSignificant: () => false,
  preview: (a) => ({ title: 'Tạo ghi chú', target: a.title, changes: [{ field: 'Nội dung', after: (a.content ?? '').slice(0, 300) }], consequence: 'Ghi chú mới sẽ được lưu.', risk: 'write' }),
  execute: (a, ctx) => {
    const n = ctx.services.notes.create(ctx.userId, a);
    return { data: noteView(n, true), summary: `Đã tạo ghi chú "${n.title}"`, card: { kind: 'note', title: n.title, subtitle: n.tags.join(', ') || 'Ghi chú', fields: [{ label: 'Nội dung', value: n.content.slice(0, 160) }] }, episode: `Đã tạo ghi chú "${n.title}"`, auditTarget: n.title };
  },
};

const updateNote: ToolDefinition<{ note_id: string; title?: string; content?: string; tags?: string[] }> = {
  name: 'update_note',
  category: 'Ghi chú',
  label: 'Đang cập nhật ghi chú…',
  description: 'Replace the title, content or tags of a note. To append, read it first and send the full new content.',
  parameters: {
    type: 'object',
    properties: { note_id: { type: 'string', maxLength: 64 }, title: { type: 'string', minLength: 1, maxLength: 120 }, content: { type: 'string', maxLength: 5000 }, tags: { type: 'array', maxItems: 10, items: { type: 'string', maxLength: 30 } } },
    required: ['note_id'],
    additionalProperties: false,
  },
  risk: 'write',
  confirmation: 'significant',
  // Overwriting content loses text, so that always asks; renaming/tagging does not.
  isSignificant: (a) => a.content !== undefined,
  preview: (a, ctx) => {
    const n = ctx.services.notes.get(ctx.userId, a.note_id);
    return {
      title: 'Cập nhật ghi chú',
      target: n.title,
      changes: [
        ...(a.title !== undefined ? [{ field: 'Tiêu đề', before: n.title, after: a.title }] : []),
        ...(a.content !== undefined ? [{ field: 'Nội dung', before: n.content.slice(0, 300), after: a.content.slice(0, 300) }] : []),
        ...(a.tags !== undefined ? [{ field: 'Thẻ', before: n.tags.join(', '), after: a.tags.join(', ') }] : []),
      ],
      consequence: 'Nội dung cũ sẽ được thay bằng nội dung mới.',
      risk: 'write',
    };
  },
  execute: (a, ctx) => {
    const { note_id, ...patch } = a;
    const n = ctx.services.notes.update(ctx.userId, note_id, patch);
    return { data: noteView(n, true), summary: `Đã cập nhật "${n.title}"`, episode: `Đã cập nhật ghi chú "${n.title}"`, auditTarget: n.title };
  },
};

const deleteNotes: ToolDefinition<{ note_ids: string[] }> = {
  name: 'delete_notes',
  category: 'Ghi chú',
  label: 'Đang xoá ghi chú…',
  description: 'Delete one or more notes (ids from search_notes). Only when the user explicitly asks.',
  parameters: { type: 'object', properties: { note_ids: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'string', maxLength: 64 } } }, required: ['note_ids'], additionalProperties: false },
  risk: 'destructive',
  confirmation: 'always',
  preview: (a, ctx) => {
    const notes = a.note_ids.map((id) => ctx.services.notes.get(ctx.userId, id));
    return {
      title: notes.length > 1 ? `Xoá ${notes.length} ghi chú` : 'Xoá ghi chú',
      target: notes.map((n) => n.title).join(', '),
      changes: notes.map((n) => ({ field: n.title, before: n.content.slice(0, 120) || '(trống)', after: 'Đã xoá' })),
      consequence: notes.length > 1 ? `${notes.length} ghi chú sẽ bị xoá.` : 'Ghi chú sẽ bị xoá.',
      risk: 'destructive',
    };
  },
  execute: (a, ctx) => {
    const removed = ctx.services.notes.remove(ctx.userId, a.note_ids);
    const titles = removed.map((n) => n.title).join(', ');
    return { data: { deleted: removed.map((n) => n.title) }, summary: `Đã xoá ${removed.length} ghi chú`, episode: `Đã xoá ghi chú: ${titles}`, auditTarget: titles };
  },
};

// ---------- analysis over the user's data ----------

const summary: ToolDefinition<Record<string, never>> = {
  name: 'my_travel_summary',
  category: 'Kế hoạch chuyến đi',
  label: 'Đang tổng hợp dữ liệu của bạn…',
  description: "Server-computed overview of the user's data: counts of favorites/notes, trips by status, upcoming trips, total budgets and estimated costs.",
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  risk: 'read',
  confirmation: 'never',
  execute: (_a, ctx) => {
    const trips = ctx.services.trips.list(ctx.userId).map(tripView);
    const today = new Date().toISOString().slice(0, 10);
    const byStatus: Record<string, number> = {};
    for (const t of trips) byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
    return {
      data: {
        favorites: ctx.services.favorites.list(ctx.userId).length,
        notes: ctx.services.notes.list(ctx.userId).total,
        trips_total: trips.length,
        trips_by_status: byStatus,
        upcoming: trips.filter((t) => t.start_date && t.start_date >= today && t.status !== 'cancelled').map((t) => ({ id: t.id, title: t.title, start_date: t.start_date })),
        total_budget_vnd: trips.reduce((s, t) => s + (t.budget_vnd ?? 0), 0),
        total_estimated_cost_vnd: trips.reduce((s, t) => s + (t.estimated_cost_vnd ?? 0), 0),
      },
      summary: `Đã tổng hợp ${trips.length} chuyến đi`,
    };
  },
};

export const travelTools: AnyTool[] = [listFavorites, addFavorite, removeFavorite, listTrips, getTrip, createTrip, updateTrip, addTripItem, deleteTrip, searchNotes, getNote, createNote, updateNote, deleteNotes, summary];
