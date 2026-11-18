/** Trip plans with their items (ships, hotels, activities). Scoped to `userId`. */
import { type Db, now, transaction } from '../shared/db.ts';
import { newId } from '../shared/crypto.ts';
import { ApiError } from '../shared/http.ts';
import { lookupItem } from '../catalog.ts';

export type TripStatus = 'planning' | 'booked' | 'done' | 'cancelled';

export interface TripItem {
  id: string;
  itemType: 'ship' | 'hotel' | 'activity';
  slug: string | null;
  title: string;
  link: string | null;
  dayDate: string | null;
  price: number | null;
}

export interface Trip {
  id: string;
  title: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  guests: number | null;
  budget: number | null;
  status: TripStatus;
  notes: string | null;
  items: TripItem[];
  createdAt: string;
  updatedAt: string;
}

export interface TripInput {
  title?: string;
  destination?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  guests?: number | null;
  budget?: number | null;
  status?: TripStatus;
  notes?: string | null;
}

interface TripRow {
  id: string;
  title: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  guests: number | null;
  budget: number | null;
  status: TripStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ItemRow {
  id: string;
  item_type: 'ship' | 'hotel' | 'activity';
  slug: string | null;
  title: string;
  day_date: string | null;
  price: number | null;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function checkDate(value: string | null | undefined, field: string) {
  if (value == null) return;
  if (!DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new ApiError(400, `${field} phải có dạng YYYY-MM-DD.`, 'validation');
  }
}

const itemLink = (r: ItemRow) =>
  r.item_type === 'ship' && r.slug ? `/du-thuyen/${encodeURIComponent(r.slug)}` : r.item_type === 'hotel' && r.slug ? `/tim-khach-san/${encodeURIComponent(r.slug)}` : null;

export class TripsService {
  private readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  list(userId: string, opts: { status?: TripStatus; query?: string } = {}): Trip[] {
    const rows = this.db
      .prepare('SELECT * FROM trips WHERE user_id = ? AND deleted_at IS NULL ORDER BY COALESCE(start_date, created_at)')
      .all(userId) as unknown as TripRow[];
    const q = opts.query?.toLowerCase();
    return rows
      .filter((r) => !opts.status || r.status === opts.status)
      .filter((r) => !q || r.title.toLowerCase().includes(q) || (r.destination ?? '').toLowerCase().includes(q))
      .map((r) => this.toTrip(r));
  }

  get(userId: string, id: string): Trip {
    const row = this.db.prepare('SELECT * FROM trips WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(id, userId) as TripRow | undefined;
    if (!row) throw new ApiError(404, `Không tìm thấy kế hoạch chuyến đi "${id}".`, 'not_found');
    return this.toTrip(row);
  }

  create(userId: string, input: TripInput & { title: string }): Trip {
    this.validate(input);
    const id = newId();
    const t = now();
    this.db
      .prepare(
        `INSERT INTO trips (id, user_id, title, destination, start_date, end_date, guests, budget, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, userId, input.title.trim(), input.destination ?? null, input.start_date ?? null, input.end_date ?? null, input.guests ?? null, input.budget ?? null, input.status ?? 'planning', input.notes ?? null, t, t);
    return this.get(userId, id);
  }

  update(userId: string, id: string, patch: TripInput): Trip {
    const before = this.get(userId, id);
    const merged = {
      title: patch.title?.trim() || before.title,
      destination: patch.destination !== undefined ? patch.destination : before.destination,
      start_date: patch.start_date !== undefined ? patch.start_date : before.startDate,
      end_date: patch.end_date !== undefined ? patch.end_date : before.endDate,
      guests: patch.guests !== undefined ? patch.guests : before.guests,
      budget: patch.budget !== undefined ? patch.budget : before.budget,
      status: patch.status ?? before.status,
      notes: patch.notes !== undefined ? patch.notes : before.notes,
    };
    this.validate(merged);
    this.db
      .prepare(
        `UPDATE trips SET title = ?, destination = ?, start_date = ?, end_date = ?, guests = ?, budget = ?, status = ?, notes = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`,
      )
      .run(merged.title, merged.destination, merged.start_date, merged.end_date, merged.guests, merged.budget, merged.status, merged.notes, now(), id, userId);
    return this.get(userId, id);
  }

  remove(userId: string, id: string): Trip {
    const trip = this.get(userId, id);
    this.db.prepare('UPDATE trips SET deleted_at = ? WHERE id = ? AND user_id = ?').run(now(), id, userId);
    return trip;
  }

  addItem(userId: string, tripId: string, input: { item_type: 'ship' | 'hotel' | 'activity'; slug?: string; title?: string; day_date?: string; price?: number }): Trip {
    return transaction(this.db, () => {
      const trip = this.get(userId, tripId);
      checkDate(input.day_date, 'Ngày');
      let title = input.title?.trim();
      let price = input.price ?? null;
      if (input.item_type !== 'activity') {
        const item = input.slug ? lookupItem(input.item_type, input.slug) : null;
        if (!item) throw new ApiError(404, `Không tìm thấy ${input.item_type === 'ship' ? 'du thuyền' : 'khách sạn'} "${input.slug ?? ''}".`, 'not_found');
        title = item.title;
        price ??= item.price;
      }
      if (!title) throw new ApiError(400, 'Hoạt động cần có tên.', 'validation');
      this.db
        .prepare('INSERT INTO trip_items (id, trip_id, user_id, item_type, slug, title, day_date, price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(newId(), trip.id, userId, input.item_type, input.slug ?? null, title, input.day_date ?? null, price, now());
      this.db.prepare('UPDATE trips SET updated_at = ? WHERE id = ?').run(now(), trip.id);
      return this.get(userId, trip.id);
    });
  }

  removeItem(userId: string, tripId: string, itemId: string): { trip: Trip; item: TripItem } {
    const trip = this.get(userId, tripId);
    const item = trip.items.find((i) => i.id === itemId);
    if (!item) throw new ApiError(404, 'Không tìm thấy mục này trong chuyến đi.', 'not_found');
    this.db.prepare('DELETE FROM trip_items WHERE id = ? AND user_id = ?').run(itemId, userId);
    return { trip: this.get(userId, tripId), item };
  }

  private validate(t: TripInput) {
    checkDate(t.start_date, 'Ngày bắt đầu');
    checkDate(t.end_date, 'Ngày kết thúc');
    if (t.start_date && t.end_date && t.end_date < t.start_date) throw new ApiError(400, 'Ngày kết thúc phải sau ngày bắt đầu.', 'validation');
    if (t.guests != null && (!Number.isInteger(t.guests) || t.guests < 1 || t.guests > 200)) throw new ApiError(400, 'Số khách phải từ 1 đến 200.', 'validation');
    if (t.budget != null && (!Number.isFinite(t.budget) || t.budget < 0)) throw new ApiError(400, 'Ngân sách không hợp lệ.', 'validation');
  }

  private toTrip(r: TripRow): Trip {
    const items = this.db.prepare('SELECT * FROM trip_items WHERE trip_id = ? ORDER BY COALESCE(day_date, created_at)').all(r.id) as unknown as ItemRow[];
    return {
      id: r.id,
      title: r.title,
      destination: r.destination,
      startDate: r.start_date,
      endDate: r.end_date,
      guests: r.guests,
      budget: r.budget,
      status: r.status,
      notes: r.notes,
      items: items.map((i) => ({ id: i.id, itemType: i.item_type, slug: i.slug, title: i.title, link: itemLink(i), dayDate: i.day_date, price: i.price })),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}
