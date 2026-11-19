/**
 * Schema migrations. Append new entries; never edit an applied one.
 * Conventions: TEXT ids (random UUIDs), ISO-8601 UTC timestamps,
 * `deleted_at` for soft deletes, every user-owned row carries `user_id`.
 */
export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'accounts and travel data',
    sql: `
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE COLLATE NOCASE,
        password_hash TEXT,
        display_name TEXT,
        role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        is_guest INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,               -- sha256 of the cookie token
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );
      CREATE INDEX idx_sessions_user ON sessions(user_id);

      CREATE TABLE favorites (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        item_type TEXT NOT NULL CHECK (item_type IN ('ship', 'hotel')),
        slug TEXT NOT NULL,
        title TEXT NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL,
        UNIQUE (user_id, item_type, slug)
      );

      CREATE TABLE trips (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        destination TEXT,
        start_date TEXT,
        end_date TEXT,
        guests INTEGER,
        budget INTEGER,
        status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'booked', 'done', 'cancelled')),
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );
      CREATE INDEX idx_trips_user ON trips(user_id, deleted_at, start_date);

      CREATE TABLE trip_items (
        id TEXT PRIMARY KEY,
        trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        item_type TEXT NOT NULL CHECK (item_type IN ('ship', 'hotel', 'activity')),
        slug TEXT,
        title TEXT NOT NULL,
        day_date TEXT,
        price INTEGER,
        created_at TEXT NOT NULL
      );
      CREATE INDEX idx_trip_items_trip ON trip_items(trip_id);

      CREATE TABLE notes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        tags TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );
      CREATE INDEX idx_notes_user ON notes(user_id, deleted_at, updated_at);
    `,
  },
  {
    version: 2,
    name: 'ai assistant',
    sql: `
      CREATE TABLE ai_conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        pinned INTEGER NOT NULL DEFAULT 0,
        archived_at TEXT,
        context_reset_at TEXT,             -- when the user cleared the context (display)
        context_reset_seq INTEGER NOT NULL DEFAULT 0, -- messages with seq <= this are history only, not model context
        last_message_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );
      CREATE INDEX idx_ai_conv_user ON ai_conversations(user_id, deleted_at, last_message_at);

      CREATE TABLE ai_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        seq INTEGER NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
        content TEXT NOT NULL DEFAULT '',
        tool_calls TEXT,                   -- JSON [{id,name,arguments}] on assistant messages
        tool_call_id TEXT,                 -- on tool messages
        tool_name TEXT,
        status TEXT NOT NULL DEFAULT 'complete' CHECK (status IN ('complete', 'stopped', 'error')),
        provider TEXT,
        model TEXT,
        input_tokens INTEGER,
        output_tokens INTEGER,
        client_message_id TEXT,
        metadata TEXT,                     -- JSON: citations, attachments, app context
        created_at TEXT NOT NULL,
        UNIQUE (conversation_id, seq),
        UNIQUE (conversation_id, client_message_id)
      );
      CREATE INDEX idx_ai_messages_conv ON ai_messages(conversation_id, seq);

      CREATE TABLE ai_tool_executions (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
        message_id TEXT NOT NULL REFERENCES ai_messages(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tool_call_id TEXT NOT NULL UNIQUE,
        tool_name TEXT NOT NULL,
        risk TEXT NOT NULL,
        arguments TEXT NOT NULL,
        result TEXT,
        status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'rejected', 'awaiting_confirmation', 'cancelled')),
        error TEXT,
        duration_ms INTEGER,
        created_at TEXT NOT NULL,
        finished_at TEXT
      );
      CREATE INDEX idx_ai_tool_exec_conv ON ai_tool_executions(conversation_id, created_at);

      CREATE TABLE ai_action_confirmations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
        tool_execution_id TEXT NOT NULL REFERENCES ai_tool_executions(id) ON DELETE CASCADE,
        tool_call_id TEXT NOT NULL UNIQUE,
        tool_name TEXT NOT NULL,
        arguments TEXT NOT NULL,
        args_hash TEXT NOT NULL,
        preview TEXT NOT NULL,             -- JSON ActionPreview shown on the card
        status TEXT NOT NULL CHECK (status IN ('pending', 'executing', 'confirmed', 'cancelled', 'expired')),
        decided_at TEXT,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX idx_ai_confirm_conv ON ai_action_confirmations(conversation_id, status);

      CREATE TABLE ai_memories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('preference', 'fact', 'rule', 'episode')),
        content TEXT NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('chat_confirmed', 'settings', 'action_log')),
        source_conversation_id TEXT,
        source_message_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );
      CREATE INDEX idx_ai_memories_user ON ai_memories(user_id, deleted_at, kind);

      CREATE TABLE ai_documents (
        id TEXT PRIMARY KEY,
        owner_key TEXT NOT NULL,           -- 'public' for site content, else the owning user id
        source_type TEXT NOT NULL CHECK (source_type IN ('blog', 'help', 'upload')),
        source_ref TEXT NOT NULL,
        title TEXT NOT NULL,
        link TEXT,
        mime_type TEXT,
        size_bytes INTEGER,
        content_hash TEXT NOT NULL,
        embedding_version TEXT NOT NULL,
        chunk_count INTEGER NOT NULL DEFAULT 0,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        UNIQUE (owner_key, source_type, source_ref)
      );

      CREATE TABLE ai_document_chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id TEXT NOT NULL REFERENCES ai_documents(id) ON DELETE CASCADE,
        owner_key TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding BLOB NOT NULL,           -- Float32Array, L2-normalized
        embedding_version TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (document_id, chunk_index)
      );
      CREATE INDEX idx_ai_chunks_owner ON ai_document_chunks(owner_key);

      -- Keyword index; rowid = ai_document_chunks.id. Diacritics are folded so "thuyen" matches "thuyền".
      CREATE VIRTUAL TABLE ai_chunks_fts USING fts5(title, content, tokenize = 'unicode61 remove_diacritics 2');

      CREATE TABLE ai_provider_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        provider_type TEXT NOT NULL CHECK (provider_type IN ('anthropic', 'openai_compatible', 'ollama')),
        base_url TEXT,
        model TEXT NOT NULL,
        models TEXT,                       -- JSON list offered to users; empty = only \`model\`
        api_key_encrypted TEXT,
        temperature REAL,
        max_tokens INTEGER NOT NULL DEFAULT 2048,
        context_window INTEGER NOT NULL DEFAULT 16000,
        timeout_ms INTEGER NOT NULL DEFAULT 60000,
        enabled INTEGER NOT NULL DEFAULT 1,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE ai_user_settings (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        settings TEXT NOT NULL,            -- JSON UserSettings
        updated_at TEXT NOT NULL
      );

      CREATE TABLE ai_audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        tool_name TEXT,
        target TEXT,
        status TEXT NOT NULL,
        details TEXT,
        ip TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX idx_ai_audit_user ON ai_audit_logs(user_id, created_at);
    `,
  },
];
