/**
 * Service container: one instance of every service, wired to one database.
 * Tools receive this (via ToolContext) and must use services, never SQL.
 */
import type { Db } from '../shared/db.ts';
import { AuthService } from '../auth/authService.ts';
import { FavoritesService } from '../domain/favoritesService.ts';
import { NotesService } from '../domain/notesService.ts';
import { TripsService } from '../domain/tripsService.ts';
import { ConversationService } from './conversations/conversationService.ts';
import { ExecutionStore } from './conversations/executionStore.ts';
import { MemoryService } from './memory/memoryService.ts';
import { ProviderService } from './providers/providerService.ts';
import { type EmbeddingProvider, embeddingProviderFromEnv } from './rag/embeddings.ts';
import { RagService } from './rag/ragService.ts';
import { AuditLog } from './security/auditLog.ts';
import { ConfirmationService } from './security/confirmationService.ts';
import { SettingsService } from './settings/settingsService.ts';
import { type WebSearchProvider, webSearchFromEnv } from './web/webSearch.ts';

export interface Services {
  db: Db;
  auth: AuthService;
  favorites: FavoritesService;
  trips: TripsService;
  notes: NotesService;
  conversations: ConversationService;
  executions: ExecutionStore;
  confirmations: ConfirmationService;
  memory: MemoryService;
  rag: RagService;
  settings: SettingsService;
  providers: ProviderService;
  audit: AuditLog;
  webSearch: WebSearchProvider | null;
}

export function createServices(db: Db, opts: { cookiePath?: string; env?: NodeJS.ProcessEnv; embedder?: EmbeddingProvider; webSearch?: WebSearchProvider | null } = {}): Services {
  const env = opts.env ?? process.env;
  return {
    db,
    auth: new AuthService(db, opts.cookiePath),
    favorites: new FavoritesService(db),
    trips: new TripsService(db),
    notes: new NotesService(db),
    conversations: new ConversationService(db),
    executions: new ExecutionStore(db),
    confirmations: new ConfirmationService(db),
    memory: new MemoryService(db),
    rag: new RagService(db, opts.embedder ?? embeddingProviderFromEnv(env)),
    settings: new SettingsService(db),
    providers: new ProviderService(db, env),
    audit: new AuditLog(db),
    webSearch: opts.webSearch !== undefined ? opts.webSearch : webSearchFromEnv(env),
  };
}
