/**
 * Provider configuration and instantiation.
 *
 * Configs come from two places:
 *  - environment variables (deploy-time, never editable from the UI);
 *  - `ai_provider_configs`, managed by admins in Settings. API keys there are
 *    encrypted with AI_SECRET_KEY and never returned to the browser.
 *
 * Business code asks this service for an `LLMProvider`; it never imports a
 * vendor SDK directly.
 */
import { type Db, now, parseJson } from '../../shared/db.ts';
import { canEncryptSecrets, decryptSecret, encryptSecret, newId } from '../../shared/crypto.ts';
import { ApiError } from '../../shared/http.ts';
import { AnthropicProvider } from './anthropic.ts';
import { OllamaProvider } from './ollama.ts';
import { OpenAICompatibleProvider } from './openaiCompatible.ts';
import type { LLMProvider, ProviderConfig, ProviderType } from './types.ts';

export interface PublicProviderConfig extends Omit<ProviderConfig, 'apiKey'> {
  hasApiKey: boolean;
  apiKeyHint?: string;
  enabled: boolean;
  isDefault: boolean;
}

interface ConfigRow {
  id: string;
  name: string;
  provider_type: ProviderType;
  base_url: string | null;
  model: string;
  models: string | null;
  api_key_encrypted: string | null;
  temperature: number | null;
  max_tokens: number;
  context_window: number;
  timeout_ms: number;
  enabled: number;
  is_default: number;
}

export interface ProviderConfigInput {
  name?: string;
  type?: ProviderType;
  baseUrl?: string | null;
  model?: string;
  models?: string[];
  apiKey?: string | null; // undefined = keep, '' or null = clear
  temperature?: number | null;
  maxTokens?: number;
  contextWindow?: number;
  timeoutMs?: number;
  enabled?: boolean;
  isDefault?: boolean;
}

/** Providers declared through environment variables. */
export function envProviderConfigs(env = process.env): (ProviderConfig & { isDefault: boolean })[] {
  const out: (ProviderConfig & { isDefault: boolean })[] = [];
  const timeoutMs = Number(env.AI_TIMEOUT_MS ?? 60_000);
  const enabled = new Set((env.AI_PROVIDERS ?? '').split(',').map((s) => s.trim()).filter(Boolean));
  if (env.ANTHROPIC_API_KEY || enabled.has('anthropic')) {
    out.push({
      id: 'env-anthropic',
      name: 'Claude (Anthropic)',
      type: 'anthropic',
      model: env.AI_ANTHROPIC_MODEL ?? 'claude-opus-5-5',
      models: (env.AI_ANTHROPIC_MODELS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
      apiKey: env.ANTHROPIC_API_KEY || undefined,
      maxTokens: Number(env.AI_MAX_TOKENS ?? 4096),
      contextWindow: 200_000,
      timeoutMs,
      origin: 'env',
      isDefault: false,
    });
  }
  if (env.OLLAMA_BASE_URL || env.AI_OLLAMA_MODEL || enabled.has('ollama')) {
    out.push({
      id: 'env-ollama',
      name: 'Ollama (local)',
      type: 'ollama',
      baseUrl: env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
      model: env.AI_OLLAMA_MODEL ?? 'qwen2.5:3b',
      models: (env.AI_OLLAMA_MODELS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
      temperature: env.AI_TEMPERATURE ? Number(env.AI_TEMPERATURE) : 0.2,
      maxTokens: Number(env.AI_MAX_TOKENS ?? 2048),
      contextWindow: Number(env.AI_OLLAMA_CONTEXT ?? 16_384),
      timeoutMs: Number(env.AI_TIMEOUT_MS ?? 180_000),
      origin: 'env',
      isDefault: false,
    });
  }
  if (env.OPENAI_COMPAT_BASE_URL && env.OPENAI_COMPAT_MODEL) {
    out.push({
      id: 'env-openai',
      name: env.OPENAI_COMPAT_NAME ?? 'OpenAI-compatible',
      type: 'openai_compatible',
      baseUrl: env.OPENAI_COMPAT_BASE_URL,
      model: env.OPENAI_COMPAT_MODEL,
      models: [],
      apiKey: env.OPENAI_COMPAT_API_KEY || undefined,
      temperature: env.AI_TEMPERATURE ? Number(env.AI_TEMPERATURE) : undefined,
      maxTokens: Number(env.AI_MAX_TOKENS ?? 2048),
      contextWindow: Number(env.OPENAI_COMPAT_CONTEXT ?? 32_000),
      timeoutMs,
      origin: 'env',
      isDefault: false,
    });
  }
  const preferred = env.AI_DEFAULT_PROVIDER;
  const def = out.find((c) => c.id === preferred || c.type === preferred) ?? out[0];
  if (def) def.isDefault = true;
  return out;
}

export function createProvider(config: ProviderConfig): LLMProvider {
  switch (config.type) {
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'ollama':
      return new OllamaProvider(config);
    case 'openai_compatible':
      return new OpenAICompatibleProvider(config);
    default:
      throw new Error(`Unsupported provider type: ${config.type}`);
  }
}

const hint = (key: string) => (key.length > 8 ? `…${key.slice(-4)}` : '…');

export class ProviderService {
  private readonly db: Db;
  private readonly env: NodeJS.ProcessEnv;
  private cache = new Map<string, { stamp: string; provider: LLMProvider }>();
  /** Test hook: overrides every lookup with a fixed provider. */
  override: LLMProvider | null = null;

  constructor(db: Db, env: NodeJS.ProcessEnv = process.env) {
    this.db = db;
    this.env = env;
  }

  /** Every enabled config (env first), with secrets resolved. */
  private all(includeDisabled = false): (ProviderConfig & { enabled: boolean; isDefault: boolean })[] {
    if (this.env.MIXIVIVU_CHAT_MODE === 'basic') return [];
    const env = envProviderConfigs(this.env).map((c) => ({ ...c, enabled: true }));
    const rows = this.db.prepare('SELECT * FROM ai_provider_configs ORDER BY created_at').all() as unknown as ConfigRow[];
    const dbConfigs = rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.provider_type,
      baseUrl: r.base_url ?? undefined,
      model: r.model,
      models: parseJson<string[]>(r.models, []),
      apiKey: decryptSecret(r.api_key_encrypted),
      temperature: r.temperature ?? undefined,
      maxTokens: r.max_tokens,
      contextWindow: r.context_window,
      timeoutMs: r.timeout_ms,
      origin: 'db' as const,
      enabled: r.enabled === 1,
      isDefault: r.is_default === 1,
    }));
    // A DB default overrides the env default.
    if (dbConfigs.some((c) => c.isDefault && c.enabled)) env.forEach((c) => (c.isDefault = false));
    return [...env, ...dbConfigs].filter((c) => includeDisabled || c.enabled);
  }

  /** Configs safe to send to the browser (no keys). */
  listPublic(includeDisabled = false): PublicProviderConfig[] {
    return this.all(includeDisabled).map(({ apiKey, ...c }) => ({ ...c, hasApiKey: !!apiKey, apiKeyHint: apiKey ? hint(apiKey) : undefined }));
  }

  getConfig(id: string): ProviderConfig | undefined {
    return this.all(true).find((c) => c.id === id);
  }

  /**
   * Provider + model for a user's preference. Falls back to the default
   * provider when the preferred one is gone or the model is not offered.
   */
  resolve(pref: { providerId?: string | null; model?: string | null } = {}): { provider: LLMProvider; model: string } | null {
    if (this.override) return { provider: this.override, model: pref.model || this.override.config.model };
    const configs = this.all();
    const config = configs.find((c) => c.id === pref.providerId) ?? configs.find((c) => c.isDefault) ?? configs[0];
    if (!config) return null;
    const offered = new Set([config.model, ...config.models]);
    const model = pref.model && offered.has(pref.model) && config.id === pref.providerId ? pref.model : config.model;
    return { provider: this.instance(config), model };
  }

  instance(config: ProviderConfig): LLMProvider {
    const stamp = JSON.stringify(config);
    const cached = this.cache.get(config.id);
    if (cached?.stamp === stamp) return cached.provider;
    const provider = createProvider(config);
    this.cache.set(config.id, { stamp, provider });
    return provider;
  }

  // ---------- admin CRUD (DB configs only) ----------

  create(input: ProviderConfigInput): PublicProviderConfig {
    if (!input.name || !input.type || !input.model) throw new ApiError(400, 'Cần tên, loại provider và model.', 'validation');
    const id = newId();
    const t = now();
    this.db
      .prepare(
        `INSERT INTO ai_provider_configs (id, name, provider_type, base_url, model, models, api_key_encrypted, temperature, max_tokens, context_window, timeout_ms, enabled, is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      )
      .run(id, input.name, input.type, null, input.model, '[]', null, null, 2048, 16000, 60000, 1, t, t);
    return this.update(id, input);
  }

  update(id: string, input: ProviderConfigInput): PublicProviderConfig {
    const row = this.db.prepare('SELECT * FROM ai_provider_configs WHERE id = ?').get(id) as ConfigRow | undefined;
    if (!row) throw new ApiError(404, 'Không tìm thấy cấu hình provider (cấu hình từ biến môi trường không sửa được ở đây).', 'not_found');
    validateConfigInput(input);
    let encrypted = row.api_key_encrypted;
    if (input.apiKey === '' || input.apiKey === null) encrypted = null;
    else if (typeof input.apiKey === 'string') {
      if (!canEncryptSecrets()) throw new ApiError(400, 'Máy chủ chưa đặt AI_SECRET_KEY nên không thể lưu API key an toàn.', 'no_secret_key');
      encrypted = encryptSecret(input.apiKey);
    }
    this.db
      .prepare(
        `UPDATE ai_provider_configs SET name = ?, provider_type = ?, base_url = ?, model = ?, models = ?, api_key_encrypted = ?, temperature = ?,
         max_tokens = ?, context_window = ?, timeout_ms = ?, enabled = ?, updated_at = ? WHERE id = ?`,
      )
      .run(
        input.name ?? row.name,
        input.type ?? row.provider_type,
        input.baseUrl !== undefined ? input.baseUrl || null : row.base_url,
        input.model ?? row.model,
        input.models ? JSON.stringify(input.models) : (row.models ?? '[]'),
        encrypted,
        input.temperature !== undefined ? input.temperature : row.temperature,
        input.maxTokens ?? row.max_tokens,
        input.contextWindow ?? row.context_window,
        input.timeoutMs ?? row.timeout_ms,
        input.enabled === undefined ? row.enabled : input.enabled ? 1 : 0,
        now(),
        id,
      );
    if (input.isDefault !== undefined) {
      if (input.isDefault) this.db.prepare('UPDATE ai_provider_configs SET is_default = (id = ?)').run(id);
      else this.db.prepare('UPDATE ai_provider_configs SET is_default = 0 WHERE id = ?').run(id);
    }
    this.cache.delete(id);
    return this.listPublic(true).find((c) => c.id === id)!;
  }

  remove(id: string): void {
    const r = this.db.prepare('DELETE FROM ai_provider_configs WHERE id = ?').run(id);
    if (!r.changes) throw new ApiError(404, 'Không tìm thấy cấu hình provider.', 'not_found');
    this.cache.delete(id);
  }
}

function validateConfigInput(i: ProviderConfigInput) {
  if (i.type && !['anthropic', 'openai_compatible', 'ollama'].includes(i.type)) throw new ApiError(400, 'Loại provider không hợp lệ.', 'validation');
  if (i.baseUrl) {
    let u: URL;
    try {
      u = new URL(i.baseUrl);
    } catch {
      throw new ApiError(400, 'Base URL không hợp lệ.', 'validation');
    }
    if (!['http:', 'https:'].includes(u.protocol)) throw new ApiError(400, 'Base URL phải là http(s).', 'validation');
  }
  if (i.temperature != null && (i.temperature < 0 || i.temperature > 2)) throw new ApiError(400, 'Temperature trong khoảng 0-2.', 'validation');
  if (i.maxTokens !== undefined && (i.maxTokens < 64 || i.maxTokens > 64_000)) throw new ApiError(400, 'Max tokens trong khoảng 64-64000.', 'validation');
  if (i.contextWindow !== undefined && (i.contextWindow < 2048 || i.contextWindow > 2_000_000)) throw new ApiError(400, 'Context window không hợp lệ.', 'validation');
  if (i.timeoutMs !== undefined && (i.timeoutMs < 5000 || i.timeoutMs > 600_000)) throw new ApiError(400, 'Timeout trong khoảng 5-600 giây.', 'validation');
  if (i.name !== undefined && (!i.name.trim() || i.name.length > 60)) throw new ApiError(400, 'Tên 1-60 ký tự.', 'validation');
}
