/** Claude via @anthropic-ai/sdk (Messages API, streamed, native tool use). */
import Anthropic from '@anthropic-ai/sdk';
import { BaseProvider } from './base.ts';
import type { LLMMessage, LLMRequest, LLMStreamEvent, ModelInfo, StopReason, ValidationResult } from './types.ts';
import { ProviderError } from './types.ts';

type ContentBlock = Anthropic.Messages.ContentBlockParam;

/** Our neutral transcript → Anthropic messages (tool results grouped into one user turn). */
export function toAnthropicMessages(messages: LLMMessage[]): Anthropic.Messages.MessageParam[] {
  const out: Anthropic.Messages.MessageParam[] = [];
  for (const m of messages) {
    if (m.role === 'tool') {
      const block: ContentBlock = { type: 'tool_result', tool_use_id: m.toolCallId, content: m.content, ...(m.isError ? { is_error: true } : {}) };
      const last = out[out.length - 1];
      if (last?.role === 'user' && Array.isArray(last.content) && last.content.every((b) => b.type === 'tool_result')) {
        (last.content as ContentBlock[]).push(block);
      } else out.push({ role: 'user', content: [block] });
    } else if (m.role === 'assistant') {
      const blocks: ContentBlock[] = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      for (const c of m.toolCalls ?? []) blocks.push({ type: 'tool_use', id: c.id, name: c.name, input: c.arguments });
      if (blocks.length) out.push({ role: 'assistant', content: blocks });
    } else {
      out.push({ role: 'user', content: m.content });
    }
  }
  return out;
}

const STOP: Record<string, StopReason> = { end_turn: 'end', stop_sequence: 'end', tool_use: 'tool_calls', max_tokens: 'max_tokens', refusal: 'refusal' };

export class AnthropicProvider extends BaseProvider {
  private client: Anthropic | null = null;

  private sdk(): Anthropic {
    // apiKey undefined → the SDK falls back to ANTHROPIC_API_KEY / other configured credentials.
    this.client ??= new Anthropic({ apiKey: this.config.apiKey, baseURL: this.config.baseUrl || undefined, timeout: this.config.timeoutMs, maxRetries: 1 });
    return this.client;
  }

  async *streamResponse(req: LLMRequest): AsyncGenerator<LLMStreamEvent> {
    const model = req.model ?? this.config.model;
    try {
      // Temperature is not sent: current Claude models manage sampling themselves.
      const stream = this.sdk().messages.stream(
        {
          model,
          max_tokens: req.maxTokens ?? this.config.maxTokens,
          system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
          messages: toAnthropicMessages(req.messages),
          ...(req.tools?.length
            ? { tools: req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters as Anthropic.Messages.Tool.InputSchema })) }
            : {}),
        },
        { signal: req.signal },
      );
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') yield { type: 'text', text: event.delta.text };
      }
      const final = await stream.finalMessage();
      for (const block of final.content) {
        if (block.type === 'tool_use') {
          const input = block.input;
          yield { type: 'tool_call', call: { id: block.id, name: block.name, arguments: input && typeof input === 'object' ? (input as Record<string, unknown>) : {} } };
        }
      }
      yield {
        type: 'done',
        stopReason: STOP[final.stop_reason ?? 'end_turn'] ?? 'end',
        usage: { inputTokens: final.usage.input_tokens, outputTokens: final.usage.output_tokens },
        model: final.model,
      };
    } catch (err) {
      throw this.mapError(err, req);
    }
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    try {
      const out: ModelInfo[] = [];
      for await (const m of this.sdk().models.list({ limit: 50 })) out.push({ id: m.id, supportsTools: true });
      return out;
    } catch (err) {
      throw this.mapError(err, {} as LLMRequest);
    }
  }

  async validateConfiguration(): Promise<ValidationResult> {
    try {
      const models = await this.getAvailableModels();
      const found = models.some((m) => m.id === this.config.model);
      return { ok: found, supportsTools: true, message: found ? 'Kết nối thành công.' : `Không thấy model "${this.config.model}" trong tài khoản.` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }

  private mapError(err: unknown, req: LLMRequest): ProviderError {
    const id = this.config.id;
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return new ProviderError('auth', id, err.message);
    if (err instanceof Anthropic.RateLimitError) return new ProviderError('rate_limit', id, err.message);
    if (err instanceof Anthropic.APIConnectionTimeoutError) return new ProviderError('timeout', id, err.message);
    if (err instanceof Anthropic.APIConnectionError) return new ProviderError('connection', id, err.message);
    if (err instanceof Anthropic.BadRequestError || err instanceof Anthropic.NotFoundError) return new ProviderError('bad_request', id, err.message);
    // Missing credentials surface as a non-HTTP SDK error.
    if (err instanceof Anthropic.AnthropicError && !(err instanceof Anthropic.APIError) && /auth|api key|credential/i.test(err.message)) {
      return new ProviderError('auth', id, err.message);
    }
    return this.networkError(err, req);
  }
}
