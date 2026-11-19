/**
 * Pending action confirmations. A tool call that needs approval is parked
 * here with the exact arguments the model produced; the browser only sends
 * back the confirmation id and a decision, so arguments cannot be altered
 * between preview and execution. Status changes are compare-and-set, which
 * makes double clicks and replays harmless.
 */
import { type Db, now, parseJson } from '../../shared/db.ts';
import { newId, sha256, stableStringify } from '../../shared/crypto.ts';
import { ApiError } from '../../shared/http.ts';
import type { ActionPreview } from '../tools/types.ts';

export const CONFIRMATION_TTL_MS = 15 * 60_000;

export type ConfirmationStatus = 'pending' | 'executing' | 'confirmed' | 'cancelled' | 'expired';

export interface Confirmation {
  id: string;
  conversationId: string;
  toolExecutionId: string;
  toolCallId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  argsHash: string;
  preview: ActionPreview;
  status: ConfirmationStatus;
  expiresAt: string;
  createdAt: string;
}

interface Row {
  id: string;
  user_id: string;
  conversation_id: string;
  tool_execution_id: string;
  tool_call_id: string;
  tool_name: string;
  arguments: string;
  args_hash: string;
  preview: string;
  status: ConfirmationStatus;
  expires_at: string;
  created_at: string;
}

const toConfirmation = (r: Row): Confirmation => ({
  id: r.id,
  conversationId: r.conversation_id,
  toolExecutionId: r.tool_execution_id,
  toolCallId: r.tool_call_id,
  toolName: r.tool_name,
  arguments: parseJson(r.arguments, {}),
  argsHash: r.args_hash,
  preview: parseJson(r.preview, { title: '', consequence: '', risk: 'write' }),
  status: r.status,
  expiresAt: r.expires_at,
  createdAt: r.created_at,
});

export class ConfirmationService {
  private readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  create(c: { userId: string; conversationId: string; toolExecutionId: string; toolCallId: string; toolName: string; args: Record<string, unknown>; preview: ActionPreview }): Confirmation {
    const id = newId();
    const t = new Date();
    this.db
      .prepare(
        `INSERT INTO ai_action_confirmations (id, user_id, conversation_id, tool_execution_id, tool_call_id, tool_name, arguments, args_hash, preview, status, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      )
      .run(id, c.userId, c.conversationId, c.toolExecutionId, c.toolCallId, c.toolName, JSON.stringify(c.args), sha256(stableStringify(c.args)), JSON.stringify(c.preview), new Date(t.getTime() + CONFIRMATION_TTL_MS).toISOString(), t.toISOString());
    return this.get(c.userId, id);
  }

  /** Owner-scoped lookup: another user's id is indistinguishable from a missing one. */
  get(userId: string, id: string): Confirmation {
    const r = this.db.prepare('SELECT * FROM ai_action_confirmations WHERE id = ? AND user_id = ?').get(id, userId) as Row | undefined;
    if (!r) throw new ApiError(404, 'Không tìm thấy yêu cầu xác nhận.', 'not_found');
    return toConfirmation(r);
  }

  pending(userId: string, conversationId: string): Confirmation[] {
    return (
      this.db.prepare("SELECT * FROM ai_action_confirmations WHERE user_id = ? AND conversation_id = ? AND status = 'pending' ORDER BY created_at").all(userId, conversationId) as unknown as Row[]
    ).map(toConfirmation);
  }

  forConversation(userId: string, conversationId: string): Confirmation[] {
    return (this.db.prepare('SELECT * FROM ai_action_confirmations WHERE user_id = ? AND conversation_id = ? ORDER BY created_at').all(userId, conversationId) as unknown as Row[]).map(toConfirmation);
  }

  /**
   * Moves pending → `to` atomically. Returns false when the confirmation was
   * already decided (or expired), so the action runs at most once.
   */
  transition(userId: string, id: string, to: Exclude<ConfirmationStatus, 'pending'>, from: ConfirmationStatus = 'pending'): boolean {
    const r = this.db
      .prepare('UPDATE ai_action_confirmations SET status = ?, decided_at = ? WHERE id = ? AND user_id = ? AND status = ?')
      .run(to, now(), id, userId, from);
    return r.changes === 1;
  }

  isExpired(c: Confirmation): boolean {
    return c.expiresAt < now();
  }
}
