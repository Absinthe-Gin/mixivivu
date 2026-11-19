/**
 * Conversations and their messages. Message rows hold the transcript
 * (user / assistant / tool roles); tool execution records live in
 * ai_tool_executions and are joined in only for display.
 */
import { type Db, now, parseJson, transaction } from '../../shared/db.ts';
import { newId } from '../../shared/crypto.ts';
import { ApiError } from '../../shared/http.ts';
import type { ToolCall } from '../providers/types.ts';

export const DEFAULT_TITLE = 'Cuộc trò chuyện mới';

export interface Conversation {
  id: string;
  title: string;
  pinned: boolean;
  archived: boolean;
  contextResetAt: string | null;
  contextResetSeq: number;
  lastMessageAt: string;
  createdAt: string;
}

export interface MessageMetadata {
  citations?: unknown[];
  cards?: unknown[];
  attachments?: { id: string; title: string }[];
  appContext?: { path?: string; title?: string };
  error?: string;
  mode?: 'ai' | 'basic';
}

export interface StoredMessage {
  id: string;
  conversationId: string;
  seq: number;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls: ToolCall[];
  toolCallId: string | null;
  toolName: string | null;
  status: 'complete' | 'stopped' | 'error';
  provider: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  metadata: MessageMetadata;
  createdAt: string;
}

export interface NewMessage {
  role: StoredMessage['role'];
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  toolName?: string;
  status?: StoredMessage['status'];
  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  clientMessageId?: string;
  metadata?: MessageMetadata;
}

interface ConvRow {
  id: string;
  title: string;
  pinned: number;
  archived_at: string | null;
  context_reset_at: string | null;
  context_reset_seq: number;
  last_message_at: string;
  created_at: string;
}

interface MsgRow {
  id: string;
  conversation_id: string;
  seq: number;
  role: StoredMessage['role'];
  content: string;
  tool_calls: string | null;
  tool_call_id: string | null;
  tool_name: string | null;
  status: StoredMessage['status'];
  provider: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  metadata: string | null;
  created_at: string;
}

const toConv = (r: ConvRow): Conversation => ({
  id: r.id,
  title: r.title,
  pinned: r.pinned === 1,
  archived: !!r.archived_at,
  contextResetAt: r.context_reset_at,
  contextResetSeq: r.context_reset_seq,
  lastMessageAt: r.last_message_at,
  createdAt: r.created_at,
});

export const toMessage = (r: MsgRow): StoredMessage => ({
  id: r.id,
  conversationId: r.conversation_id,
  seq: r.seq,
  role: r.role,
  content: r.content,
  toolCalls: parseJson<ToolCall[]>(r.tool_calls, []),
  toolCallId: r.tool_call_id,
  toolName: r.tool_name,
  status: r.status,
  provider: r.provider,
  model: r.model,
  inputTokens: r.input_tokens,
  outputTokens: r.output_tokens,
  metadata: parseJson<MessageMetadata>(r.metadata, {}),
  createdAt: r.created_at,
});

export const titleFrom = (text: string) => {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > 60 ? `${t.slice(0, 57)}…` : t || DEFAULT_TITLE;
};

export class ConversationService {
  private readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  create(userId: string, title?: string): Conversation {
    const id = newId();
    const t = now();
    this.db
      .prepare('INSERT INTO ai_conversations (id, user_id, title, last_message_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, userId, title?.trim() ? titleFrom(title) : DEFAULT_TITLE, t, t, t);
    return this.get(userId, id);
  }

  get(userId: string, id: string): Conversation {
    const row = this.db.prepare('SELECT * FROM ai_conversations WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(id, userId) as ConvRow | undefined;
    if (!row) throw new ApiError(404, 'Không tìm thấy cuộc trò chuyện.', 'not_found');
    return toConv(row);
  }

  /** Pinned first, then most recent. `q` searches titles and message text. */
  list(userId: string, opts: { q?: string; archived?: boolean; limit?: number } = {}): Conversation[] {
    const limit = Math.min(opts.limit ?? 50, 200);
    const archived = opts.archived ? 'IS NOT NULL' : 'IS NULL';
    if (opts.q?.trim()) {
      const like = `%${opts.q.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
      return (
        this.db
          .prepare(
            `SELECT DISTINCT c.* FROM ai_conversations c LEFT JOIN ai_messages m ON m.conversation_id = c.id AND m.role IN ('user', 'assistant')
             WHERE c.user_id = ? AND c.deleted_at IS NULL AND c.archived_at ${archived}
               AND (c.title LIKE ? ESCAPE '\\' OR m.content LIKE ? ESCAPE '\\')
             ORDER BY c.pinned DESC, c.last_message_at DESC LIMIT ?`,
          )
          .all(userId, like, like, limit) as unknown as ConvRow[]
      ).map(toConv);
    }
    return (
      this.db
        .prepare(`SELECT * FROM ai_conversations WHERE user_id = ? AND deleted_at IS NULL AND archived_at ${archived} ORDER BY pinned DESC, last_message_at DESC LIMIT ?`)
        .all(userId, limit) as unknown as ConvRow[]
    ).map(toConv);
  }

  update(userId: string, id: string, patch: { title?: string; pinned?: boolean; archived?: boolean }): Conversation {
    const c = this.get(userId, id);
    const t = now();
    this.db
      .prepare('UPDATE ai_conversations SET title = ?, pinned = ?, archived_at = ?, updated_at = ? WHERE id = ? AND user_id = ?')
      .run(
        patch.title !== undefined ? titleFrom(patch.title) : c.title,
        patch.pinned !== undefined ? (patch.pinned ? 1 : 0) : c.pinned ? 1 : 0,
        patch.archived !== undefined ? (patch.archived ? t : null) : c.archived ? t : null,
        t,
        id,
        userId,
      );
    return this.get(userId, id);
  }

  remove(userId: string, id: string): void {
    this.get(userId, id);
    this.db.prepare('UPDATE ai_conversations SET deleted_at = ? WHERE id = ? AND user_id = ?').run(now(), id, userId);
  }

  /** Later turns ignore earlier messages as model context; the history stays visible. */
  clearContext(userId: string, id: string): Conversation {
    this.get(userId, id);
    const t = now();
    this.db
      .prepare('UPDATE ai_conversations SET context_reset_at = ?, context_reset_seq = (SELECT COALESCE(MAX(seq), 0) FROM ai_messages WHERE conversation_id = ?), updated_at = ? WHERE id = ?')
      .run(t, id, t, id);
    return this.get(userId, id);
  }

  append(userId: string, conversationId: string, m: NewMessage): StoredMessage {
    return transaction(this.db, () => {
      const conv = this.get(userId, conversationId);
      if (m.clientMessageId) {
        const dup = this.db.prepare('SELECT 1 FROM ai_messages WHERE conversation_id = ? AND client_message_id = ?').get(conversationId, m.clientMessageId);
        if (dup) throw new ApiError(409, 'Tin nhắn này đã được gửi.', 'duplicate_message');
      }
      const seq = ((this.db.prepare('SELECT MAX(seq) AS s FROM ai_messages WHERE conversation_id = ?').get(conversationId) as { s: number | null }).s ?? 0) + 1;
      const id = newId();
      const t = now();
      this.db
        .prepare(
          `INSERT INTO ai_messages (id, conversation_id, user_id, seq, role, content, tool_calls, tool_call_id, tool_name, status, provider, model,
             input_tokens, output_tokens, client_message_id, metadata, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          conversationId,
          userId,
          seq,
          m.role,
          m.content,
          m.toolCalls?.length ? JSON.stringify(m.toolCalls) : null,
          m.toolCallId ?? null,
          m.toolName ?? null,
          m.status ?? 'complete',
          m.provider ?? null,
          m.model ?? null,
          m.inputTokens ?? null,
          m.outputTokens ?? null,
          m.clientMessageId ?? null,
          m.metadata && Object.keys(m.metadata).length ? JSON.stringify(m.metadata) : null,
          t,
        );
      const title = m.role === 'user' && conv.title === DEFAULT_TITLE ? titleFrom(m.content) : conv.title;
      this.db.prepare('UPDATE ai_conversations SET last_message_at = ?, updated_at = ?, title = ? WHERE id = ?').run(t, t, title, conversationId);
      return this.message(id)!;
    });
  }

  message(id: string): StoredMessage | undefined {
    const row = this.db.prepare('SELECT * FROM ai_messages WHERE id = ?').get(id) as MsgRow | undefined;
    return row ? toMessage(row) : undefined;
  }

  patchMetadata(messageId: string, patch: MessageMetadata): void {
    const m = this.message(messageId);
    if (!m) return;
    this.db.prepare('UPDATE ai_messages SET metadata = ? WHERE id = ?').run(JSON.stringify({ ...m.metadata, ...patch }), messageId);
  }

  /** All messages, oldest first. `afterReset` drops those before the context reset. */
  messages(userId: string, conversationId: string, opts: { afterReset?: boolean } = {}): StoredMessage[] {
    const conv = this.get(userId, conversationId);
    const rows = this.db.prepare('SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY seq').all(conversationId) as unknown as MsgRow[];
    const all = rows.map(toMessage);
    return opts.afterReset ? all.filter((m) => m.seq > conv.contextResetSeq) : all;
  }
}
