/**
 * SQLite storage through Node's built-in `node:sqlite` (no extra dependency).
 * One database file holds accounts, the user's travel data and every AI table.
 * Tests open an in-memory database with the same migrations.
 */
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from './migrations.ts';

export type Db = DatabaseSync;
export type Row = Record<string, unknown>;

export function openDatabase(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  migrate(db);
  return db;
}

/** Applies pending migrations in order, each inside its own transaction. */
export function migrate(db: Db): void {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)');
  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map((r) => r.version),
  );
  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue;
    transaction(db, () => {
      db.exec(m.sql);
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(m.version, m.name, now());
    });
  }
}

/** Runs `fn` in a transaction; nested calls join the outer one. */
const inTransaction = new WeakSet<Db>();

export function transaction<T>(db: Db, fn: () => T): T {
  if (inTransaction.has(db)) return fn();
  db.exec('BEGIN IMMEDIATE');
  inTransaction.add(db);
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    inTransaction.delete(db);
  }
}

export const now = () => new Date().toISOString();

/** Parses a JSON column, returning `fallback` for NULL or malformed values. */
export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
