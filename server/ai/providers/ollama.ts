/**
 * Local models through Ollama's native /api/chat (NDJSON stream).
 * Native rather than /v1 so we can turn off "thinking" output (faster on
 * small models, and reasoning traces never reach the user) and read model
 * capabilities to confirm tool-calling support.
 */
import { BaseProvider, readLines } from './base.ts';
import type { LLMMessage, LLMRequest, LLMStreamEvent, ModelInfo, ValidationResult } from './types.ts';
import { ProviderError } from './types.ts';

export function toOllamaMessages(system: string, messages: LLMMessage[]): object[] {
  const out: object[] = [{ role: 'system', content: system }];
  for (const m of messages) {
    if (m.role === 'tool') out.push({ role: 'tool', tool_name: m.toolName, content: m.content });
    else if (m.role === 'assistant') {
      out.push({
        role: 'assistant',
        content: m.content,
        ...(m.toolCalls?.length ? { tool_calls: m.toolCalls.map((c) => ({ function: { name: c.name, arguments: c.arguments } })) } : {}),
      });
    } else out.push({ role: 'user', content: m.content });
  }
  return out;
}

export class OllamaProvider extends BaseProvider {
  private capabilityCache = new Map<string, string[]>();

  private baseUrl(): string {
    return (this.config.baseUrl ?? 'http://localhost:11434').replace(/\/$/, '');
  }

  async *streamResponse(req: LLMRequest): AsyncGenerator<LLMStreamEvent> {
    const model = req.model ?? this.config.model;
    if (req.tools?.length && !(await this.supportsTools(model))) {
      throw new ProviderError('unsupported', this.config.id, `Model "${model}" không hỗ trợ tool calling trên Ollama.`);
    }
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl()}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: this.signalFor(req),
        body: JSON.stringify({
          model,
          messages: toOllamaMessages(req.system, req.messages),
          stream: true,
          think: false,
          ...(req.tools?.length ? { tools: req.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })) } : {}),
          options: {
            num_predict: req.maxTokens ?? this.config.maxTokens,
            num_ctx: this.config.contextWindow,
            ...((req.temperature ?? this.config.temperature) !== undefined ? { temperature: req.temperature ?? this.config.temperature } : {}),
          },
        }),
      });
    } catch (err) {
      throw this.networkError(err, req);
    }
    if (!res.ok || !res.body) throw this.httpError(res.status, await res.text().catch(() => ''));

    let calls = 0;
    try {
      for await (const line of readLines(res.body)) {
        let chunk: {
          message?: { content?: string; tool_calls?: { function: { name: string; arguments: Record<string, unknown> | string } }[] };
          done?: boolean;
          done_reason?: string;
          prompt_eval_count?: number;
          eval_count?: number;
          error?: string;
        };
        try {
          chunk = JSON.parse(line);
        } catch {
          continue;
        }
        if (chunk.error) throw new ProviderError('unknown', this.config.id, chunk.error);
        if (chunk.message?.content) yield { type: 'text', text: chunk.message.content };
        for (const tc of chunk.message?.tool_calls ?? []) {
          const raw = tc.function.arguments;
          let args: Record<string, unknown> = {};
          let parseError: string | undefined;
          if (typeof raw === 'string') {
            try {
              args = JSON.parse(raw);
            } catch (e) {
              parseError = `invalid JSON arguments: ${(e as Error).message}`;
            }
          } else if (raw && typeof raw === 'object') args = raw;
          // Ollama does not assign ids; generate stable-enough ones per turn.
          yield { type: 'tool_call', call: { id: `ollama_${Date.now().toString(36)}_${calls++}`, name: tc.function.name, arguments: args, ...(parseError ? { parseError } : {}) } };
        }
        if (chunk.done) {
          yield {
            type: 'done',
            stopReason: calls ? 'tool_calls' : chunk.done_reason === 'length' ? 'max_tokens' : 'end',
            usage: { inputTokens: chunk.prompt_eval_count, outputTokens: chunk.eval_count },
            model,
          };
          return;
        }
      }
    } catch (err) {
      throw this.networkError(err, req);
    }
    throw new ProviderError('connection', this.config.id, 'Ollama stream ended unexpectedly.');
  }

  async supportsTools(model: string): Promise<boolean> {
    if (!this.capabilityCache.has(model)) {
      try {
        const res = await fetch(`${this.baseUrl()}/api/show`, { method: 'POST', body: JSON.stringify({ model }), signal: AbortSignal.timeout(10_000) });
        if (!res.ok) throw this.httpError(res.status, await res.text());
        const body = (await res.json()) as { capabilities?: string[] };
        this.capabilityCache.set(model, body.capabilities ?? []);
      } catch (err) {
        throw this.networkError(err, {} as LLMRequest);
      }
    }
    return this.capabilityCache.get(model)!.includes('tools');
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    try {
      const res = await fetch(`${this.baseUrl()}/api/tags`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw this.httpError(res.status, await res.text());
      const body = (await res.json()) as { models?: { name: string; capabilities?: string[]; details?: { context_length?: number } }[] };
      return (body.models ?? []).map((m) => ({
        id: m.name,
        supportsTools: m.capabilities ? m.capabilities.includes('tools') : undefined,
        contextWindow: m.details?.context_length,
      }));
    } catch (err) {
      throw this.networkError(err, {} as LLMRequest);
    }
  }

  async validateConfiguration(): Promise<ValidationResult> {
    try {
      const models = await this.getAvailableModels();
      if (!models.some((m) => m.id === this.config.model)) {
        return { ok: false, message: `Ollama chưa có model "${this.config.model}". Chạy: ollama pull ${this.config.model}` };
      }
      const tools = await this.supportsTools(this.config.model);
      return {
        ok: tools,
        supportsTools: tools,
        message: tools ? 'Kết nối thành công, model hỗ trợ tool calling.' : `Model "${this.config.model}" không hỗ trợ tool calling; chọn model khác (vd. qwen2.5, qwen3, llama3.1).`,
      };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }
}
