/** Append-only audit trail for writes, confirmations and settings changes. */
import { type Db, now, parseJson } from '../../shared/db.ts';
import { newId } from '../../shared/crypto.ts';

export interface AuditEntry {
  userId: string | null;
  action: string; // tool.execute, confirmation.confirm, settings.update, document.upload...
  toolName?: string;
  target?: string;
  status: 'ok' | 'failed' | 'rejected' | 'cancelled';
  details?: Record<string, unknown>;
  ip?: string;
}

export class AuditLog {
  private readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  record(e: AuditEntry): void {
    this.db
      .prepare('INSERT INTO ai_audit_logs (id, user_id, action, tool_name, target, status, details, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(newId(), e.userId, e.action, e.toolName ?? null, e.target?.slice(0, 300) ?? null, e.status, e.details ? JSON.stringify(e.details).slice(0, 4000) : null, e.ip ?? null, now());
  }

  list(userId: string, limit = 100) {
    const rows = this.db
      .prepare('SELECT action, tool_name, target, status, details, created_at FROM ai_audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(userId, Math.min(limit, 500)) as { action: string; tool_name: string | null; target: string | null; status: string; details: string | null; created_at: string }[];
    return rows.map((r) => ({ action: r.action, toolName: r.tool_name, target: r.target, status: r.status, details: parseJson(r.details, null), createdAt: r.created_at }));
  }
}
