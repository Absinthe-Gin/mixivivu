/**
 * Any OpenAI-compatible Chat Completions endpoint (OpenAI, OpenRouter, vLLM,
 * LM Studio, Groq, Ollama's /v1...). Streams SSE and assembles tool-call
 * argument fragments by index.
 */
import { BaseProvider, parseArguments, readLines } from './base.ts';
import type { LLMMessage, LLMRequest, LLMStreamEvent, ModelInfo, StopReason, ToolCall, ValidationResult } from './types.ts';
import { ProviderError } from './types.ts';

export function toOpenAIMessages(system: string, messages: LLMMessage[]): object[] {
  const out: object[] = [{ role: 'system', content: system }];
  for (const m of messages) {
    if (m.role === 'tool') out.push({ role: 'tool', tool_call_id: m.toolCallId, content: m.content });
    else if (m.role === 'assistant') {
      out.push({
        role: 'assistant',
        content: m.content || null,
        ...(m.toolCalls?.length
          ? { tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.arguments) } })) }
          : {}),
      });
    } else out.push({ role: 'user', content: m.content });
  }
  return out;
}

const FINISH: Record<string, StopReason> = { stop: 'end', tool_calls: 'tool_calls', function_call: 'tool_calls', length: 'max_tokens', content_filter: 'refusal' };

export class OpenAICompatibleProvider extends BaseProvider {
  protected baseUrl(): string {
    return (this.config.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  }

  protected headers(): Record<string, string> {
    return { 'Content-Type': 'application/json', ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}) };
  }

  async *streamResponse(req: LLMRequest): AsyncGenerator<LLMStreamEvent> {
    const model = req.model ?? this.config.model;
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl()}/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        signal: this.signalFor(req),
        body: JSON.stringify({
          model,
          messages: toOpenAIMessages(req.system, req.messages),
          stream: true,
          stream_options: { include_usage: true },
          max_tokens: req.maxTokens ?? this.config.maxTokens,
          ...((req.temperature ?? this.config.temperature) !== undefined ? { temperature: req.temperature ?? this.config.temperature } : {}),
          ...(req.tools?.length
            ? { tools: req.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })) }
            : {}),
        }),
      });
    } catch (err) {
      throw this.networkError(err, req);
    }
    if (!res.ok || !res.body) throw this.httpError(res.status, await res.text().catch(() => ''));

    const partial = new Map<number, { id: string; name: string; args: string }>();
    let finish: StopReason = 'end';
    const usage: { inputTokens?: number; outputTokens?: number } = {};
    try {
      for await (const line of readLines(res.body)) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') break;
        let chunk: {
          choices?: { delta?: { content?: string | null; tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[] }; finish_reason?: string | null }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
          error?: { message?: string };
        };
        try {
          chunk = JSON.parse(data);
        } catch {
          continue;
        }
        if (chunk.error) throw new ProviderError('unknown', this.config.id, chunk.error.message ?? 'stream error');
        if (chunk.usage) {
          usage.inputTokens = chunk.usage.prompt_tokens;
          usage.outputTokens = chunk.usage.completion_tokens;
        }
        const choice = chunk.choices?.[0];
        if (!choice) continue;
        if (choice.delta?.content) yield { type: 'text', text: choice.delta.content };
        for (const tc of choice.delta?.tool_calls ?? []) {
          const cur = partial.get(tc.index) ?? { id: '', name: '', args: '' };
          if (tc.id) cur.id = tc.id;
          if (tc.function?.name) cur.name += tc.function.name;
          if (tc.function?.arguments) cur.args += tc.function.arguments;
          partial.set(tc.index, cur);
        }
        if (choice.finish_reason) finish = FINISH[choice.finish_reason] ?? 'end';
      }
    } catch (err) {
      throw this.networkError(err, req);
    }
    for (const [i, p] of [...partial.entries()].sort((a, b) => a[0] - b[0])) {
      const { args, error } = parseArguments(p.args);
      const call: ToolCall = { id: p.id || `call_${Date.now()}_${i}`, name: p.name, arguments: args, ...(error ? { parseError: error } : {}) };
      yield { type: 'tool_call', call };
    }
    if (partial.size) finish = 'tool_calls';
    yield { type: 'done', stopReason: finish, usage, model };
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    try {
      const res = await fetch(`${this.baseUrl()}/models`, { headers: this.headers(), signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw this.httpError(res.status, await res.text());
      const body = (await res.json()) as { data?: { id: string }[] };
      return (body.data ?? []).map((m) => ({ id: m.id }));
    } catch (err) {
      throw this.networkError(err, {} as LLMRequest);
    }
  }

  async validateConfiguration(): Promise<ValidationResult> {
    try {
      const models = await this.getAvailableModels();
      const found = models.length === 0 || models.some((m) => m.id === this.config.model);
      return { ok: found, message: found ? 'Kết nối thành công.' : `Endpoint không có model "${this.config.model}".` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }
}
