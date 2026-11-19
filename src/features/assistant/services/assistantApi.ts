/**
 * Browser client for {base}api/*. The browser never talks to an LLM
 * provider directly and never sees API keys: everything goes through the
 * app server with the session cookie.
 */
import { publicAsset } from '@/utils/assets';
import type {
  AgentEvent,
  AuthUser,
  ChatMessage,
  Conversation,
  DocumentInfo,
  Memory,
  ProviderInfo,
  ToolInfo,
  UserSettings,
} from '../types';

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const HEADERS = { 'Content-Type': 'application/json', 'X-Requested-With': 'mixivivu' };

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(publicAsset(`api${path}`), {
    method,
    headers: HEADERS,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiRequestError(res.status, (data as { error?: string }).error ?? 'Không thể kết nối máy chủ.', (data as { code?: string }).code);
  return data as T;
}

/** POSTs and yields NDJSON events; throws ApiRequestError for non-2xx responses. */
async function* streamRequest(path: string, body: unknown, signal: AbortSignal): AsyncGenerator<AgentEvent> {
  const res = await fetch(publicAsset(`api${path}`), { method: 'POST', headers: HEADERS, credentials: 'same-origin', body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new ApiRequestError(res.status, (data as { error?: string }).error ?? 'Không gửi được tin nhắn. Vui lòng thử lại.', (data as { code?: string }).code);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) yield JSON.parse(line) as AgentEvent;
    }
  }
  if (buffer.trim()) yield JSON.parse(buffer) as AgentEvent;
}

export const assistantApi = {
  // auth
  me: () => request<{ user: AuthUser }>('GET', '/auth/me'),
  register: (username: string, password: string, displayName?: string) => request<{ user: AuthUser }>('POST', '/auth/register', { username, password, displayName }),
  login: (username: string, password: string) => request<{ user: AuthUser }>('POST', '/auth/login', { username, password }),
  logout: () => request<{ ok: true }>('POST', '/auth/logout'),

  // conversations
  listConversations: (opts: { q?: string; archived?: boolean } = {}) => {
    const p = new URLSearchParams();
    if (opts.q) p.set('q', opts.q);
    if (opts.archived) p.set('archived', '1');
    const qs = p.toString();
    return request<{ conversations: Conversation[] }>('GET', `/ai/conversations${qs ? `?${qs}` : ''}`);
  },
  createConversation: (title?: string) => request<{ conversation: Conversation }>('POST', '/ai/conversations', { title }),
  getConversation: (id: string) => request<{ conversation: Conversation; messages: ChatMessage[] }>('GET', `/ai/conversations/${encodeURIComponent(id)}`),
  updateConversation: (id: string, patch: { title?: string; pinned?: boolean; archived?: boolean }) => request<{ conversation: Conversation }>('PATCH', `/ai/conversations/${encodeURIComponent(id)}`, patch),
  deleteConversation: (id: string) => request<{ ok: true }>('DELETE', `/ai/conversations/${encodeURIComponent(id)}`),
  clearContext: (id: string) => request<{ conversation: Conversation }>('POST', `/ai/conversations/${encodeURIComponent(id)}/clear-context`),
  sendMessage: (id: string, body: { content: string; clientMessageId: string; attachments?: string[]; appContext?: { path?: string; title?: string } }, signal: AbortSignal) =>
    streamRequest(`/ai/conversations/${encodeURIComponent(id)}/messages`, body, signal),
  decide: (confirmationId: string, decision: 'confirm' | 'cancel', signal: AbortSignal) => streamRequest(`/ai/confirmations/${encodeURIComponent(confirmationId)}`, { decision }, signal),

  // settings
  getSettings: () => request<{ settings: UserSettings; user: AuthUser }>('GET', '/ai/settings'),
  updateSettings: (patch: Partial<UserSettings>) => request<{ settings: UserSettings }>('PUT', '/ai/settings', patch),
  listTools: () => request<{ tools: ToolInfo[] }>('GET', '/ai/tools'),
  listProviders: () => request<{ providers: ProviderInfo[]; canManage: boolean }>('GET', '/ai/providers'),
  createProvider: (p: Record<string, unknown>) => request<{ provider: ProviderInfo }>('POST', '/ai/providers', p),
  updateProvider: (id: string, p: Record<string, unknown>) => request<{ provider: ProviderInfo }>('PATCH', `/ai/providers/${encodeURIComponent(id)}`, p),
  deleteProvider: (id: string) => request<{ ok: true }>('DELETE', `/ai/providers/${encodeURIComponent(id)}`),
  validateProvider: (id: string) => request<{ result: { ok: boolean; message: string }; models: { id: string; supportsTools?: boolean }[] }>('POST', `/ai/providers/${encodeURIComponent(id)}/validate`),

  // memory
  listMemories: () => request<{ memories: Memory[] }>('GET', '/ai/memories'),
  addMemory: (kind: Memory['kind'], content: string) => request<{ memory: Memory }>('POST', '/ai/memories', { kind, content }),
  updateMemory: (id: string, patch: { content?: string; kind?: Memory['kind'] }) => request<{ memory: Memory }>('PATCH', `/ai/memories/${encodeURIComponent(id)}`, patch),
  deleteMemory: (id: string) => request<{ ok: true }>('DELETE', `/ai/memories/${encodeURIComponent(id)}`),
  clearMemories: () => request<{ ok: true }>('DELETE', '/ai/memories'),

  // documents
  listDocuments: () => request<{ documents: DocumentInfo[] }>('GET', '/ai/documents'),
  uploadDocument: async (file: File) => {
    const buf = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (let i = 0; i < buf.length; i += 0x8000) binary += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return request<{ document: DocumentInfo }>('POST', '/ai/documents', { filename: file.name, data: btoa(binary) });
  },
  deleteDocument: (id: string) => request<{ ok: true }>('DELETE', `/ai/documents/${encodeURIComponent(id)}`),

  // data
  myData: () =>
    request<{
      favorites: { id: string; title: string; link: string; itemType: string }[];
      trips: { id: string; title: string; destination: string | null; startDate: string | null; endDate: string | null; status: string; items: { title: string }[] }[];
      notes: { id: string; title: string; content: string; updatedAt: string }[];
    }>('GET', '/ai/my-data'),
  audit: () => request<{ entries: { action: string; toolName: string | null; target: string | null; status: string; createdAt: string }[] }>('GET', '/ai/audit?limit=50'),
};

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const UPLOAD_ACCEPT = '.txt,.md,.markdown,.csv,.docx,.xlsx';
