/** Client-side mirror of the assistant API shapes (server/ai/*). */

export interface AuthUser {
  id: string;
  username: string | null;
  displayName: string | null;
  role: 'user' | 'admin';
  isGuest: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  pinned: boolean;
  archived: boolean;
  contextResetAt: string | null;
  lastMessageAt: string;
  createdAt: string;
}

export type RiskLevel = 'read' | 'write' | 'destructive';

export interface ActionPreview {
  title: string;
  target?: string;
  changes?: { field: string; before?: string | null; after?: string | null }[];
  consequence: string;
  risk: RiskLevel;
}

export type ConfirmationStatus = 'pending' | 'executing' | 'confirmed' | 'cancelled' | 'expired';

export interface ConfirmationView {
  id: string;
  toolName: string;
  preview: ActionPreview;
  status: ConfirmationStatus;
  expiresAt: string;
}

export interface Citation {
  n: number;
  title: string;
  link?: string;
  sourceType: 'blog' | 'help' | 'upload' | 'web' | 'catalog';
  documentId?: string;
  snippet?: string;
}

export interface ResultCard {
  kind: 'trip' | 'note' | 'favorite' | 'memory' | 'document' | 'list';
  title: string;
  subtitle?: string;
  link?: string;
  fields?: { label: string; value: string }[];
}

export interface ToolStep {
  callId: string;
  name: string;
  label: string;
  status: 'running' | 'succeeded' | 'failed' | 'rejected' | 'awaiting_confirmation' | 'cancelled' | string;
  summary: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: string;
  model: string | null;
  createdAt: string;
  metadata: {
    citations?: Citation[];
    cards?: ResultCard[];
    attachments?: { id: string; title: string }[];
    error?: string;
    mode?: 'ai' | 'basic';
  };
  steps: ToolStep[];
  confirmations: ConfirmationView[];
}

export type AgentEvent =
  | { type: 'conversation'; conversation: { id: string; title: string } }
  | { type: 'status'; text: string }
  | { type: 'message'; id: string }
  | { type: 'text'; text: string }
  | { type: 'tool_start'; callId: string; name: string; label: string }
  | { type: 'tool_end'; callId: string; name: string; status: string; summary: string }
  | { type: 'confirmation'; confirmation: ConfirmationView }
  | { type: 'confirmation_update'; id: string; status: ConfirmationStatus }
  | { type: 'card'; card: ResultCard }
  | { type: 'citations'; citations: Citation[] }
  | { type: 'done'; messageId: string | null; mode: 'ai' | 'basic'; awaitingConfirmation: boolean; model?: string }
  | { type: 'error'; message: string; code?: string };

export interface UserSettings {
  memoryEnabled: boolean;
  responseLanguage: 'auto' | 'vi' | 'en';
  responseStyle: 'concise' | 'balanced' | 'detailed';
  providerId: string | null;
  model: string | null;
  contextMessages: number;
  maxToolCalls: number;
  streaming: boolean;
  confirmWrites: 'always' | 'significant';
  disabledTools: string[];
  enabledTools: string[];
}

export interface ToolInfo {
  name: string;
  description: string;
  category: string;
  risk: RiskLevel;
  group: 'A' | 'B' | 'C';
  confirmation: 'never' | 'significant' | 'always';
  enabled: boolean;
  available: boolean;
}

export interface ProviderInfo {
  id: string;
  name: string;
  type: 'anthropic' | 'openai_compatible' | 'ollama';
  model: string;
  models: string[];
  isDefault: boolean;
  baseUrl?: string;
  hasApiKey?: boolean;
  apiKeyHint?: string;
  temperature?: number;
  maxTokens?: number;
  contextWindow?: number;
  timeoutMs?: number;
  enabled?: boolean;
  origin?: 'env' | 'db';
}

export interface Memory {
  id: string;
  kind: 'preference' | 'fact' | 'rule' | 'episode';
  content: string;
  source: 'chat_confirmed' | 'settings' | 'action_log';
  sourceConversationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentInfo {
  id: string;
  title: string;
  mimeType: string | null;
  sizeBytes: number | null;
  chunkCount: number;
  createdAt: string;
}
