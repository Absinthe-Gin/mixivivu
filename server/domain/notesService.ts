/** Personal travel notes. Soft-deleted; every query is scoped to `userId`. */
import { type Db, now, transaction } from '../shared/db.ts';
import { newId } from '../shared/crypto.ts';
import { ApiError } from '../shared/http.ts';

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface NoteRow {
  id: string;
  title: string;
  content: string;
  tags: string | null;
  created_at: string;
  updated_at: string;
}

const toNote = (r: NoteRow): Note => ({
  id: r.id,
  title: r.title,
  content: r.content,
  tags: r.tags ? r.tags.split(',').filter(Boolean) : [],
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const cleanTags = (tags?: string[]) => (tags ?? []).map((t) => t.trim().replace(/,/g, ' ')).filter(Boolean).slice(0, 10);

export class NotesService {
  private readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  list(userId: string, opts: { query?: string; tag?: string; limit?: number } = {}): { total: number; notes: Note[] } {
    const rows = this.db
      .prepare('SELECT * FROM notes WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC')
      .all(userId) as unknown as NoteRow[];
    const q = opts.query?.toLowerCase();
    const filtered = rows
      .map(toNote)
      .filter((n) => !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
      .filter((n) => !opts.tag || n.tags.includes(opts.tag));
    return { total: filtered.length, notes: filtered.slice(0, Math.min(opts.limit ?? 20, 50)) };
  }

  get(userId: string, id: string): Note {
    const row = this.db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(id, userId) as NoteRow | undefined;
    if (!row) throw new ApiError(404, `Không tìm thấy ghi chú "${id}".`, 'not_found');
    return toNote(row);
  }

  create(userId: string, input: { title: string; content?: string; tags?: string[] }): Note {
    const id = newId();
    const t = now();
    this.db
      .prepare('INSERT INTO notes (id, user_id, title, content, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, userId, input.title.trim(), input.content ?? '', cleanTags(input.tags).join(','), t, t);
    return this.get(userId, id);
  }

  update(userId: string, id: string, patch: { title?: string; content?: string; tags?: string[] }): Note {
    const before = this.get(userId, id);
    this.db
      .prepare('UPDATE notes SET title = ?, content = ?, tags = ?, updated_at = ? WHERE id = ? AND user_id = ?')
      .run(
        patch.title?.trim() || before.title,
        patch.content ?? before.content,
        (patch.tags ? cleanTags(patch.tags) : before.tags).join(','),
        now(),
        id,
        userId,
      );
    return this.get(userId, id);
  }

  /** Soft-deletes notes the user owns; all ids must exist or nothing is deleted. */
  remove(userId: string, ids: string[]): Note[] {
    return transaction(this.db, () => {
      const notes = ids.map((id) => this.get(userId, id));
      const t = now();
      for (const n of notes) this.db.prepare('UPDATE notes SET deleted_at = ? WHERE id = ? AND user_id = ?').run(t, n.id, userId);
      return notes;
    });
  }
}
