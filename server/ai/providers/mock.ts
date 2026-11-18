/**
 * Scripted provider for automated tests: each call pops the next scripted
 * turn (text and/or tool calls). Records every request so tests can assert
 * on the context the orchestrator sent.
 */
import { BaseProvider } from './base.ts';
import type { LLMRequest, LLMStreamEvent, ModelInfo, ProviderConfig, ToolCall, ValidationResult } from './types.ts';
import { ProviderError } from './types.ts';

export interface MockReply {
  text?: string;
  toolCalls?: (Omit<ToolCall, 'id'> & { id?: string })[];
}
export type MockTurn = MockReply | ((req: LLMRequest) => MockReply) | { error: ProviderError };

export class MockProvider extends BaseProvider {
  readonly requests: LLMRequest[] = [];
  private script: MockTurn[];
  private counter = 0;

  constructor(script: MockTurn[] = [], config: Partial<ProviderConfig> = {}) {
    super({ id: 'mock', name: 'Mock', type: 'mock', model: 'mock-1', models: [], maxTokens: 1024, contextWindow: 8000, timeoutMs: 5000, origin: 'env', ...config });
    this.script = [...script];
  }

  push(...turns: MockTurn[]) {
    this.script.push(...turns);
  }

  async *streamResponse(req: LLMRequest): AsyncGenerator<LLMStreamEvent> {
    this.requests.push(structuredClone({ ...req, signal: undefined }));
    const next = this.script.shift();
    if (!next) {
      yield { type: 'text', text: 'OK.' };
      yield { type: 'done', stopReason: 'end', usage: {}, model: this.config.model };
      return;
    }
    if ('error' in next) throw next.error;
    const turn = typeof next === 'function' ? next(req) : next;
    if (turn.text) {
      // Emit in small pieces to exercise streaming.
      for (const piece of turn.text.match(/.{1,12}/gs) ?? []) yield { type: 'text', text: piece };
    }
    const calls = req.tools?.length ? (turn.toolCalls ?? []) : [];
    for (const c of calls) yield { type: 'tool_call', call: { id: c.id ?? `mock_call_${++this.counter}`, name: c.name, arguments: c.arguments, ...(c.parseError ? { parseError: c.parseError } : {}) } };
    yield { type: 'done', stopReason: calls.length ? 'tool_calls' : 'end', usage: { inputTokens: 10, outputTokens: 5 }, model: this.config.model };
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    return [{ id: this.config.model, supportsTools: true }];
  }

  async validateConfiguration(): Promise<ValidationResult> {
    return { ok: true, message: 'mock', supportsTools: true };
  }
}
