/** Per-user assistant settings, stored as one validated JSON document. */
import { type Db, now, parseJson } from '../../shared/db.ts';
import { ApiError } from '../../shared/http.ts';

export interface UserSettings {
  memoryEnabled: boolean;
  responseLanguage: 'auto' | 'vi' | 'en';
  responseStyle: 'concise' | 'balanced' | 'detailed';
  providerId: string | null;
  model: string | null;
  /** Recent messages (all roles) considered for the model context. */
  contextMessages: number;
  /** Tool calls allowed per user turn (hard cap: MAX_TOOL_CALLS). */
  maxToolCalls: number;
  streaming: boolean;
  /** `always`: every reversible write asks; `significant`: only notable ones. Destructive always asks. */
  confirmWrites: 'always' | 'significant';
  disabledTools: string[];
  /** Opt-in tools that are off by default (e.g. web search). */
  enabledTools: string[];
}

export const MAX_TOOL_CALLS = 12;
export const MAX_CONTEXT_MESSAGES = 60;

export const DEFAULT_SETTINGS: UserSettings = {
  memoryEnabled: true,
  responseLanguage: 'auto',
  responseStyle: 'balanced',
  providerId: null,
  model: null,
  contextMessages: 24,
  maxToolCalls: 8,
  streaming: true,
  confirmWrites: 'significant',
  disabledTools: [],
  enabledTools: [],
};

const oneOf = <T extends string>(v: unknown, allowed: readonly T[], field: string): T => {
  if (typeof v !== 'string' || !allowed.includes(v as T)) throw new ApiError(400, `"${field}" không hợp lệ.`, 'validation');
  return v as T;
};
const intIn = (v: unknown, min: number, max: number, field: string) => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw new ApiError(400, `"${field}" phải từ ${min} đến ${max}.`, 'validation');
  return v;
};
const names = (v: unknown, field: string) => {
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || x.length > 64) || v.length > 100) throw new ApiError(400, `"${field}" không hợp lệ.`, 'validation');
  return [...new Set(v as string[])];
};
const flag = (v: unknown, field: string) => {
  if (typeof v !== 'boolean') throw new ApiError(400, `"${field}" phải là true/false.`, 'validation');
  return v;
};

export class SettingsService {
  private readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  get(userId: string): UserSettings {
    const row = this.db.prepare('SELECT settings FROM ai_user_settings WHERE user_id = ?').get(userId) as { settings: string } | undefined;
    return { ...DEFAULT_SETTINGS, ...parseJson<Partial<UserSettings>>(row?.settings, {}) };
  }

  /** Applies a validated partial update and returns the full settings. */
  update(userId: string, patch: Record<string, unknown>): UserSettings {
    const next = { ...this.get(userId) };
    for (const [key, v] of Object.entries(patch)) {
      switch (key) {
        case 'memoryEnabled':
        case 'streaming':
          next[key] = flag(v, key);
          break;
        case 'responseLanguage':
          next.responseLanguage = oneOf(v, ['auto', 'vi', 'en'] as const, key);
          break;
        case 'responseStyle':
          next.responseStyle = oneOf(v, ['concise', 'balanced', 'detailed'] as const, key);
          break;
        case 'confirmWrites':
          next.confirmWrites = oneOf(v, ['always', 'significant'] as const, key);
          break;
        case 'providerId':
        case 'model':
          if (v !== null && (typeof v !== 'string' || v.length > 120)) throw new ApiError(400, `"${key}" không hợp lệ.`, 'validation');
          next[key] = v as string | null;
          break;
        case 'contextMessages':
          next.contextMessages = intIn(v, 4, MAX_CONTEXT_MESSAGES, key);
          break;
        case 'maxToolCalls':
          next.maxToolCalls = intIn(v, 1, MAX_TOOL_CALLS, key);
          break;
        case 'disabledTools':
        case 'enabledTools':
          next[key] = names(v, key);
          break;
        default:
          throw new ApiError(400, `Không có cài đặt "${key}".`, 'validation');
      }
    }
    this.db
      .prepare('INSERT INTO ai_user_settings (user_id, settings, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET settings = excluded.settings, updated_at = excluded.updated_at')
      .run(userId, JSON.stringify(next), now());
    return next;
  }
}
