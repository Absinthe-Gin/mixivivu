/**
 * Long-term and episodic memory.
 *
 * - Long-term (preference / fact / rule): only written when the user asked
 *   for it in chat and confirmed the card, or added it in Settings.
 * - Episodic (episode): a one-line log of actions the assistant completed,
 *   written automatically after successful writes while memory is enabled.
 * Short-term memory is the conversation itself (see ContextManager).
 *
 * Each row keeps its source (how it was created) and source conversation.
 */
import { type Db, now } from '../../shared/db.ts';
import { newId } from '../../shared/crypto.ts';
import { ApiError } from '../../shared/http.ts';
import { tokenize } from '../rag/text.ts';

export type MemoryKind = 'preference' | 'fact' | 'rule' | 'episode';
export type MemorySource = 'chat_confirmed' | 'settings' | 'action_log';

export interface Memory {
  id: string;
  kind: MemoryKind;
  content: string;
  source: MemorySource;
  sourceConversationId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Row {
  id: string;
  kind: MemoryKind;
  content: string;
  source: MemorySource;
  source_conversation_id: string | null;
  created_at: string;
  updated_at: string;
}

const toMemory = (r: Row): Memory => ({
  id: r.id,
  kind: r.kind,
  content: r.content,
  source: r.source,
  sourceConversationId: r.source_conversation_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const KINDS: MemoryKind[] = ['preference', 'fact', 'rule', 'episode'];
const MAX_MEMORIES = 500;

export class MemoryService {
  private readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  list(userId: string, kind?: MemoryKind): Memory[] {
    const rows = kind
      ? this.db.prepare('SELECT * FROM ai_memories WHERE user_id = ? AND kind = ? AND deleted_at IS NULL ORDER BY updated_at DESC').all(userId, kind)
      : this.db.prepare('SELECT * FROM ai_memories WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC').all(userId);
    return (rows as unknown as Row[]).map(toMemory);
  }

  get(userId: string, id: string): Memory {
    const r = this.db.prepare('SELECT * FROM ai_memories WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(id, userId) as Row | undefined;
    if (!r) throw new ApiError(404, 'Không tìm thấy ghi nhớ này.', 'not_found');
    return toMemory(r);
  }

  add(userId: string, m: { kind: MemoryKind; content: string; source: MemorySource; conversationId?: string; messageId?: string }): Memory {
    if (!KINDS.includes(m.kind)) throw new ApiError(400, 'Loại ghi nhớ không hợp lệ.', 'validation');
    const content = m.content.trim();
    if (!content || content.length > 500) throw new ApiError(400, 'Nội dung ghi nhớ cần 1-500 ký tự.', 'validation');
    const count = (this.db.prepare('SELECT COUNT(*) AS n FROM ai_memories WHERE user_id = ? AND deleted_at IS NULL').get(userId) as { n: number }).n;
    if (count >= MAX_MEMORIES) throw new ApiError(400, 'Đã đạt giới hạn số ghi nhớ; hãy xoá bớt.', 'limit');
    const dup = this.db
      .prepare('SELECT * FROM ai_memories WHERE user_id = ? AND kind = ? AND content = ? AND deleted_at IS NULL')
      .get(userId, m.kind, content) as Row | undefined;
    if (dup) return toMemory(dup);
    const id = newId();
    const t = now();
    this.db
      .prepare('INSERT INTO ai_memories (id, user_id, kind, content, source, source_conversation_id, source_message_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, userId, m.kind, content, m.source, m.conversationId ?? null, m.messageId ?? null, t, t);
    return this.get(userId, id);
  }

  update(userId: string, id: string, patch: { content?: string; kind?: MemoryKind }): Memory {
    const before = this.get(userId, id);
    const content = patch.content?.trim() ?? before.content;
    if (!content || content.length > 500) throw new ApiError(400, 'Nội dung ghi nhớ cần 1-500 ký tự.', 'validation');
    if (patch.kind && !KINDS.includes(patch.kind)) throw new ApiError(400, 'Loại ghi nhớ không hợp lệ.', 'validation');
    this.db.prepare('UPDATE ai_memories SET content = ?, kind = ?, updated_at = ? WHERE id = ? AND user_id = ?').run(content, patch.kind ?? before.kind, now(), id, userId);
    return this.get(userId, id);
  }

  remove(userId: string, id: string): Memory {
    const m = this.get(userId, id);
    this.db.prepare('UPDATE ai_memories SET deleted_at = ? WHERE id = ? AND user_id = ?').run(now(), id, userId);
    return m;
  }

  clear(userId: string, kind?: MemoryKind): number {
    const r = kind
      ? this.db.prepare('UPDATE ai_memories SET deleted_at = ? WHERE user_id = ? AND kind = ? AND deleted_at IS NULL').run(now(), userId, kind)
      : this.db.prepare('UPDATE ai_memories SET deleted_at = ? WHERE user_id = ? AND deleted_at IS NULL').run(now(), userId);
    return Number(r.changes);
  }

  recordEpisode(userId: string, content: string, conversationId: string): void {
    try {
      this.add(userId, { kind: 'episode', content: `${content} (${now().slice(0, 10)})`, source: 'action_log', conversationId });
    } catch {
      // Episodes are best-effort; a full memory store must not fail the action.
    }
  }

  /**
   * Memories for the model context: every rule and preference (they apply
   * always), plus the facts/episodes that share words with the question.
   */
  relevant(userId: string, query: string, limit = 12): Memory[] {
    const all = this.list(userId);
    const always = all.filter((m) => m.kind === 'rule' || m.kind === 'preference').slice(0, limit);
    const terms = new Set(tokenize(query));
    const scored = all
      .filter((m) => m.kind === 'fact' || m.kind === 'episode')
      .map((m) => ({ m, score: tokenize(m.content).filter((t) => terms.has(t)).length + (m.kind === 'fact' ? 0.5 : 0) }))
      .filter((x) => x.score >= 1)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.m);
    const recentEpisodes = all.filter((m) => m.kind === 'episode').slice(0, 3);
    const out = [...always];
    for (const m of [...scored, ...recentEpisodes]) if (out.length < limit && !out.includes(m)) out.push(m);
    return out;
  }
}
