# Database schema

Storage is SQLite through Node's built-in `node:sqlite` (Node 22.18+), so
no database server or extra dependency is needed. The file defaults to
`.data/mixivivu.db` (git-ignored); set `MIXIVIVU_DB_PATH` to move it.
WAL mode, foreign keys on.

Migrations live in `server/shared/migrations.ts` and run on start-up in
order, each in a transaction, recorded in `schema_migrations`. Append new
migrations; never edit one that has been applied anywhere.

Conventions: random UUID `TEXT` ids, ISO-8601 UTC timestamps, `deleted_at`
for soft deletes, every user-owned row has `user_id` (or `owner_key`) and
every query filters on it.

## Accounts and domain data (migration 1)

| Table | Purpose | Notes |
|---|---|---|
| `users` | guest and registered accounts | `role` user/admin, `is_guest`, scrypt `password_hash` |
| `sessions` | cookie sessions | id = sha256(token); 30-day expiry |
| `favorites` | saved ships/hotels | unique (user, type, slug); title copied from catalog |
| `trips` | trip plans | status planning/booked/done/cancelled; soft delete |
| `trip_items` | ships/hotels/activities in a trip | cascade with trip |
| `notes` | personal notes | comma-joined tags; soft delete |

## Assistant (migration 2)

| Table | Purpose | Key columns |
|---|---|---|
| `ai_conversations` | one chat thread | `pinned`, `archived_at`, `context_reset_seq` (messages ≤ seq are history only), `deleted_at` |
| `ai_messages` | transcript | `seq` (unique per conversation), `role` user/assistant/tool, `tool_calls` JSON, `tool_call_id`, `status` complete/stopped/error, `provider`, `model`, token usage, `client_message_id` (unique, idempotent sends), `metadata` JSON (citations, cards, attachments, page context) |
| `ai_tool_executions` | one row per tool call | `tool_call_id` UNIQUE (idempotency), `risk`, `arguments`, `result`, `status` running/succeeded/failed/rejected/awaiting_confirmation/cancelled, `duration_ms` |
| `ai_action_confirmations` | parked actions | exact `arguments` + `args_hash`, `preview` JSON, `status` pending/executing/confirmed/cancelled/expired, `expires_at` (15 min) |
| `ai_memories` | long-term + episodic memory | `kind` preference/fact/rule/episode, `source` chat_confirmed/settings/action_log, source conversation/message, soft delete |
| `ai_documents` | indexed documents | `owner_key` ('public' or user id), `source_type` blog/help/upload, `content_hash`, `embedding_version`, soft delete |
| `ai_document_chunks` | chunks + embeddings | `embedding` BLOB (Float32, L2-normalised), `embedding_version` |
| `ai_chunks_fts` | FTS5 keyword index | rowid = chunk id; diacritics folded |
| `ai_provider_configs` | admin-managed providers | `api_key_encrypted` (AES-256-GCM), limits, `is_default` |
| `ai_user_settings` | per-user settings | validated JSON document |
| `ai_audit_logs` | audit trail | action, tool, target, status, details, ip |

Message content and tool execution records are separate on purpose: the
transcript is what the model sees; executions are the operational record
(status, timings, errors) shown in the UI and audit.

## Transactions and integrity

- `ConversationService.append` assigns `seq` and inserts in one
  transaction; duplicate `client_message_id` → 409.
- Confirmation status changes are compare-and-set (`UPDATE … WHERE status =
  'pending'`), so an action executes at most once.
- Bulk note deletion validates every id first inside a transaction (all or
  nothing).
- Document re-index replaces chunks and FTS rows in one transaction.

## Backup

The database is one file. With the server stopped, copy
`.data/mixivivu.db` (plus `-wal`/`-shm` if present). While running, use
`sqlite3 .data/mixivivu.db ".backup backup.db"`.
