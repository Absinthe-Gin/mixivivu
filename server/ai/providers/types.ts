/**
 * Provider-neutral LLM contract. The orchestrator and tools only see these
 * types; each adapter translates them to one vendor's wire format.
 */

export type JsonSchema = Record<string, unknown>;

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  /** Set when the provider returned arguments that were not valid JSON. */
  parseError?: string;
}

export type LLMMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[] }
  | { role: 'tool'; toolCallId: string; toolName: string; content: string; isError?: boolean };

export interface LLMToolSpec {
  name: string;
  description: string;
  parameters: JsonSchema;
}

export interface LLMRequest {
  system: string;
  messages: LLMMessage[];
  tools?: LLMToolSpec[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export type StopReason = 'end' | 'tool_calls' | 'max_tokens' | 'refusal' | 'error';

export type LLMStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; call: ToolCall }
  | { type: 'done'; stopReason: StopReason; usage: TokenUsage; model: string };

export interface LLMResponse {
  text: string;
  toolCalls: ToolCall[];
  stopReason: StopReason;
  usage: TokenUsage;
  model: string;
}

export interface ModelInfo {
  id: string;
  supportsTools?: boolean;
  contextWindow?: number;
}

export interface ValidationResult {
  ok: boolean;
  message: string;
  supportsTools?: boolean;
}

export type ProviderType = 'anthropic' | 'openai_compatible' | 'ollama' | 'mock';

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  model: string;
  /** Models users may pick; empty means only `model`. */
  models: string[];
  baseUrl?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens: number;
  contextWindow: number;
  timeoutMs: number;
  /** Where the config came from: environment variables or the admin settings table. */
  origin: 'env' | 'db';
}

export interface LLMProvider {
  readonly config: ProviderConfig;
  /** Plain completion without tools. */
  generateResponse(req: LLMRequest): Promise<LLMResponse>;
  /** Streams text and structured tool calls (tools optional). */
  streamResponse(req: LLMRequest): AsyncIterable<LLMStreamEvent>;
  /** Non-streaming completion with tools. */
  generateWithTools(req: LLMRequest): Promise<LLMResponse>;
  getAvailableModels(): Promise<ModelInfo[]>;
  validateConfiguration(): Promise<ValidationResult>;
}

export type ProviderErrorKind = 'auth' | 'rate_limit' | 'connection' | 'timeout' | 'bad_request' | 'unsupported' | 'unknown';

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly provider: string;
  constructor(kind: ProviderErrorKind, provider: string, message: string) {
    super(message);
    this.kind = kind;
    this.provider = provider;
  }
}
