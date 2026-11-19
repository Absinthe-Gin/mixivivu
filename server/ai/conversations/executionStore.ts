/** Persistence for tool execution records (separate from message content). */
import { type Db, now, parseJson } from '../../shared/db.ts';
import { newId } from '../../shared/crypto.ts';
import type { ToolRisk } from '../tools/types.ts';

export type ExecutionStatus = 'running' | 'succeeded' | 'failed' | 'rejected' | 'awaiting_confirmation' | 'cancelled';

export interface ToolExecution {
  id: string;
  conversationId: string;
  messageId: string;
  toolCallId: string;
  toolName: string;
  risk: ToolRisk;
  arguments: Record<string, unknown>;
  /** Stored payload: { content (sent to model), summary, sources, card } */
  result: StoredResult | null;
  status: ExecutionStatus;
  error: string | null;
  durationMs: number | null;
  createdAt: string;
}

export interface StoredResult {
  content: string;
  isError: boolean;
  summary?: string;
  sources?: unknown[];
  card?: unknown;
}

interface Row {
  id: string;
  conversation_id: string;
  message_id: string;
  tool_call_id: string;
  tool_name: string;
  risk: ToolRisk;
  arguments: string;
  result: string | null;
  status: ExecutionStatus;
  error: string | null;
  duration_ms: number | null;
  created_at: string;
}

const toExec = (r: Row): ToolExecution => ({
  id: r.id,
  conversationId: r.conversation_id,
  messageId: r.message_id,
  toolCallId: r.tool_call_id,
  toolName: r.tool_name,
  risk: r.risk,
  arguments: parseJson(r.arguments, {}),
  result: parseJson<StoredResult | null>(r.result, null),
  status: r.status,
  error: r.error,
  durationMs: r.duration_ms,
  createdAt: r.created_at,
});

export class ExecutionStore {
  private readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  byCallId(toolCallId: string): ToolExecution | undefined {
    const r = this.db.prepare('SELECT * FROM ai_tool_executions WHERE tool_call_id = ?').get(toolCallId) as Row | undefined;
    return r ? toExec(r) : undefined;
  }

  start(e: { userId: string; conversationId: string; messageId: string; toolCallId: string; toolName: string; risk: ToolRisk; args: Record<string, unknown>; status: ExecutionStatus }): ToolExecution {
    const id = newId();
    this.db
      .prepare(
        `INSERT INTO ai_tool_executions (id, conversation_id, message_id, user_id, tool_call_id, tool_name, risk, arguments, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, e.conversationId, e.messageId, e.userId, e.toolCallId, e.toolName, e.risk, JSON.stringify(e.args), e.status, now());
    return this.byCallId(e.toolCallId)!;
  }

  finish(id: string, status: ExecutionStatus, result: StoredResult | null, error?: string, durationMs?: number): void {
    this.db
      .prepare('UPDATE ai_tool_executions SET status = ?, result = ?, error = ?, duration_ms = ?, finished_at = ? WHERE id = ?')
      .run(status, result ? JSON.stringify(result) : null, error ?? null, durationMs ?? null, now(), id);
  }

  forConversation(conversationId: string): ToolExecution[] {
    return (this.db.prepare('SELECT * FROM ai_tool_executions WHERE conversation_id = ? ORDER BY created_at').all(conversationId) as unknown as Row[]).map(toExec);
  }
}
