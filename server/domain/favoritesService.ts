/** Saved ships and hotels ("Yêu thích"). Every query is scoped to `userId`. */
import { type Db, now } from '../shared/db.ts';
import { newId } from '../shared/crypto.ts';
import { ApiError } from '../shared/http.ts';
import { lookupItem } from '../catalog.ts';

export interface Favorite {
  id: string;
  itemType: 'ship' | 'hotel';
  slug: string;
  title: string;
  link: string;
  note: string | null;
  createdAt: string;
}

interface FavoriteRow {
  id: string;
  item_type: 'ship' | 'hotel';
  slug: string;
  title: string;
  note: string | null;
  created_at: string;
}

const linkFor = (type: 'ship' | 'hotel', slug: string) =>
  type === 'ship' ? `/du-thuyen/${encodeURIComponent(slug)}` : `/tim-khach-san/${encodeURIComponent(slug)}`;

const toFavorite = (r: FavoriteRow): Favorite => ({
  id: r.id,
  itemType: r.item_type,
  slug: r.slug,
  title: r.title,
  link: linkFor(r.item_type, r.slug),
  note: r.note,
  createdAt: r.created_at,
});

export class FavoritesService {
  private readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  list(userId: string, itemType?: 'ship' | 'hotel'): Favorite[] {
    const rows = itemType
      ? this.db.prepare('SELECT * FROM favorites WHERE user_id = ? AND item_type = ? ORDER BY created_at DESC').all(userId, itemType)
      : this.db.prepare('SELECT * FROM favorites WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    return (rows as unknown as FavoriteRow[]).map(toFavorite);
  }

  get(userId: string, id: string): Favorite {
    const row = this.db.prepare('SELECT * FROM favorites WHERE id = ? AND user_id = ?').get(id, userId) as FavoriteRow | undefined;
    if (!row) throw new ApiError(404, 'Không tìm thấy mục yêu thích này.', 'not_found');
    return toFavorite(row);
  }

  /** Adds an item from the catalog; the title is read from the catalog, not trusted from input. */
  add(userId: string, itemType: 'ship' | 'hotel', slug: string, note?: string): { favorite: Favorite; created: boolean } {
    const item = lookupItem(itemType, slug);
    if (!item) throw new ApiError(404, `Không có ${itemType === 'ship' ? 'du thuyền' : 'khách sạn'} với slug "${slug}".`, 'not_found');
    const existing = this.db
      .prepare('SELECT * FROM favorites WHERE user_id = ? AND item_type = ? AND slug = ?')
      .get(userId, itemType, slug) as FavoriteRow | undefined;
    if (existing) return { favorite: toFavorite(existing), created: false };
    const id = newId();
    this.db
      .prepare('INSERT INTO favorites (id, user_id, item_type, slug, title, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, userId, itemType, slug, item.title, note ?? null, now());
    return { favorite: this.get(userId, id), created: true };
  }

  remove(userId: string, id: string): Favorite {
    const fav = this.get(userId, id);
    this.db.prepare('DELETE FROM favorites WHERE id = ? AND user_id = ?').run(id, userId);
    return fav;
  }
}
