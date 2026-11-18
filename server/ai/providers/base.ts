/** Shared adapter behaviour: non-streaming calls collect the stream. */
import type { LLMProvider, LLMRequest, LLMResponse, LLMStreamEvent, ModelInfo, ProviderConfig, ToolCall, ValidationResult } from './types.ts';
import { ProviderError } from './types.ts';

export abstract class BaseProvider implements LLMProvider {
  readonly config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  abstract streamResponse(req: LLMRequest): AsyncIterable<LLMStreamEvent>;
  abstract getAvailableModels(): Promise<ModelInfo[]>;
  abstract validateConfiguration(): Promise<ValidationResult>;

  generateResponse(req: LLMRequest): Promise<LLMResponse> {
    return this.collect({ ...req, tools: undefined });
  }

  generateWithTools(req: LLMRequest): Promise<LLMResponse> {
    return this.collect(req);
  }

  protected async collect(req: LLMRequest): Promise<LLMResponse> {
    let text = '';
    const toolCalls: ToolCall[] = [];
    for await (const e of this.streamResponse(req)) {
      if (e.type === 'text') text += e.text;
      else if (e.type === 'tool_call') toolCalls.push(e.call);
      else return { text, toolCalls, stopReason: e.stopReason, usage: e.usage, model: e.model };
    }
    throw new ProviderError('unknown', this.config.id, 'Stream ended without a final event.');
  }

  /** Request signal combined with the configured timeout. */
  protected signalFor(req: LLMRequest): AbortSignal {
    const timeout = AbortSignal.timeout(this.config.timeoutMs);
    return req.signal ? AbortSignal.any([req.signal, timeout]) : timeout;
  }

  /** Maps fetch/HTTP failures to ProviderError kinds the orchestrator understands. */
  protected httpError(status: number, body: string): ProviderError {
    const detail = body.slice(0, 300);
    const kind = status === 401 || status === 403 ? 'auth' : status === 429 ? 'rate_limit' : status === 404 || status === 400 ? 'bad_request' : 'unknown';
    return new ProviderError(kind, this.config.id, `HTTP ${status}: ${detail}`);
  }

  protected networkError(err: unknown, req: LLMRequest): ProviderError {
    if (err instanceof ProviderError) return err;
    if (req.signal?.aborted) return new ProviderError('unknown', this.config.id, 'aborted');
    const name = (err as Error)?.name;
    if (name === 'TimeoutError' || name === 'AbortError') return new ProviderError('timeout', this.config.id, `Request timed out after ${this.config.timeoutMs} ms`);
    return new ProviderError('connection', this.config.id, (err as Error)?.message ?? String(err));
  }
}

/** Parses tool-call argument JSON, keeping the error for the validator to report. */
export function parseArguments(raw: unknown): { args: Record<string, unknown>; error?: string } {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return { args: raw as Record<string, unknown> };
  if (typeof raw !== 'string' || raw.trim() === '') return { args: {} };
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? { args: v } : { args: {}, error: 'arguments must be a JSON object' };
  } catch (e) {
    return { args: {}, error: `invalid JSON arguments: ${(e as Error).message}` };
  }
}

/** Reads a fetch body as lines (SSE or NDJSON). */
export async function* readLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) yield line;
    }
  }
  if (buffer.trim()) yield buffer.trim();
}
