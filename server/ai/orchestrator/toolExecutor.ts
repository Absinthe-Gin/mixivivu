/**
 * Runs one model tool call through every backend check:
 *   known tool → enabled for this user → arguments parse and validate →
 *   idempotency (same call id never runs twice) → confirmation policy →
 *   execute with timeout → record result + audit log.
 *
 * The model's tool call is a request, not a command: nothing runs unless
 * this executor allows it.
 */
import { ApiError } from '../../shared/http.ts';
import type { StoredResult } from '../conversations/executionStore.ts';
import type { ToolCall } from '../providers/types.ts';
import type { Confirmation } from '../security/confirmationService.ts';
import type { ToolRegistry } from '../tools/registry.ts';
import type { AnyTool, Citation, ResultCard, ToolContext, ToolOutput } from '../tools/types.ts';
import { validateArgs } from '../tools/validate.ts';

const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_RESULT_CHARS = 12_000;

export interface ExecOutcome {
  status: 'succeeded' | 'failed' | 'rejected' | 'awaiting_confirmation' | 'cancelled';
  /** Text returned to the model as the tool result. */
  content: string;
  isError: boolean;
  summary: string;
  label: string;
  sources: Omit<Citation, 'n'>[];
  card?: ResultCard;
  confirmation?: Confirmation;
}

export function errorMessage(err: unknown, tool?: AnyTool): string {
  if (tool?.onError) return tool.onError(err);
  if (err instanceof ApiError) return err.message;
  if ((err as Error)?.name === 'TimeoutError') return 'The tool timed out. Try a narrower request.';
  return 'The tool failed unexpectedly.';
}

function needsConfirmation(tool: AnyTool, args: Record<string, unknown>, ctx: ToolContext): boolean {
  if (tool.risk === 'read') return false;
  if (tool.risk === 'destructive' || tool.confirmation === 'always') return true;
  if (ctx.settings.confirmWrites === 'always') return true;
  return tool.isSignificant ? tool.isSignificant(args, ctx) : true;
}

const serialize = (data: unknown) => {
  const s = JSON.stringify(data) ?? 'null';
  return s.length > MAX_RESULT_CHARS ? `${s.slice(0, MAX_RESULT_CHARS)}… [truncated]` : s;
};

export class ToolExecutor {
  private readonly registry: ToolRegistry;
  constructor(registry: ToolRegistry) {
    this.registry = registry;
  }

  label(name: string): string {
    return this.registry.get(name)?.label ?? 'Đang xử lý…';
  }

  async execute(call: ToolCall, ctx: ToolContext): Promise<ExecOutcome> {
    const { services } = ctx;
    const tool = this.registry.get(call.name);
    const base = { label: tool?.label ?? 'Đang xử lý…', sources: [] as Omit<Citation, 'n'>[] };
    const reject = (content: string, summary: string): ExecOutcome => {
      // Rejections are recorded too, so the execution log shows what the model attempted.
      const exec = services.executions.byCallId(call.id) ?? services.executions.start({ userId: ctx.userId, conversationId: ctx.conversationId, messageId: ctx.messageId, toolCallId: call.id, toolName: call.name, risk: tool?.risk ?? 'read', args: call.arguments, status: 'rejected' });
      services.executions.finish(exec.id, 'rejected', { content, isError: true, summary }, content);
      return { ...base, status: 'rejected', content, isError: true, summary };
    };

    if (!tool) return reject(`Unknown tool "${call.name}". Use only the tools provided.`, 'Công cụ không tồn tại');
    if (!this.registry.isEnabled(tool, ctx.settings, services)) return reject(`Tool "${call.name}" is disabled for this user. Tell the user it is turned off in Settings.`, 'Công cụ đang tắt');
    if (call.parseError) return reject(`Invalid arguments: ${call.parseError}. Send a valid JSON object.`, 'Tham số không hợp lệ');

    const v = validateArgs(tool.parameters, call.arguments);
    if (!v.ok) return reject(`Invalid arguments: ${v.errors.join('; ')}. Fix them and call again, or ask the user for the missing information.`, 'Tham số không hợp lệ');

    // Idempotency: a replayed call id returns the recorded outcome instead of running again.
    const previous = services.executions.byCallId(call.id);
    if (previous && previous.status !== 'running') {
      return { ...base, status: previous.status === 'awaiting_confirmation' ? 'awaiting_confirmation' : (previous.status as ExecOutcome['status']), content: previous.result?.content ?? 'Already handled.', isError: previous.result?.isError ?? false, summary: previous.result?.summary ?? '' };
    }

    if (needsConfirmation(tool, v.value, ctx)) {
      let preview;
      try {
        preview = tool.preview!(v.value, ctx);
      } catch (err) {
        // e.g. the target does not exist: tell the model instead of showing a card.
        const msg = errorMessage(err, tool);
        const exec = services.executions.start({ userId: ctx.userId, conversationId: ctx.conversationId, messageId: ctx.messageId, toolCallId: call.id, toolName: tool.name, risk: tool.risk, args: v.value, status: 'failed' });
        services.executions.finish(exec.id, 'failed', { content: `Error: ${msg}`, isError: true, summary: msg }, msg);
        return { ...base, status: 'failed', content: `Error: ${msg}`, isError: true, summary: msg };
      }
      const exec = services.executions.start({ userId: ctx.userId, conversationId: ctx.conversationId, messageId: ctx.messageId, toolCallId: call.id, toolName: tool.name, risk: tool.risk, args: v.value, status: 'awaiting_confirmation' });
      const confirmation = services.confirmations.create({ userId: ctx.userId, conversationId: ctx.conversationId, toolExecutionId: exec.id, toolCallId: call.id, toolName: tool.name, args: v.value, preview });
      return {
        ...base,
        status: 'awaiting_confirmation',
        content: 'Waiting for the user to confirm this action in the confirmation card. It has NOT been performed yet.',
        isError: false,
        summary: 'Chờ bạn xác nhận',
        confirmation,
      };
    }

    const exec = services.executions.start({ userId: ctx.userId, conversationId: ctx.conversationId, messageId: ctx.messageId, toolCallId: call.id, toolName: tool.name, risk: tool.risk, args: v.value, status: 'running' });
    return this.run(tool, exec.id, v.value, ctx);
  }

  /** Executes an approved confirmation with the stored arguments. */
  async runConfirmed(c: Confirmation, ctx: ToolContext): Promise<ExecOutcome> {
    const tool = this.registry.get(c.toolName);
    if (!tool) {
      const content = 'Tool no longer exists; action not performed.';
      ctx.services.executions.finish(c.toolExecutionId, 'failed', { content, isError: true, summary: 'Lỗi' }, content);
      return { label: 'Đang xử lý…', sources: [], status: 'failed', content, isError: true, summary: 'Lỗi' };
    }
    return this.run(tool, c.toolExecutionId, c.arguments, ctx, 'confirmation.execute');
  }

  private async run(tool: AnyTool, execId: string, args: Record<string, unknown>, ctx: ToolContext, action = 'tool.execute'): Promise<ExecOutcome> {
    const { services } = ctx;
    const started = Date.now();
    const timeout = AbortSignal.timeout(tool.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const signal = AbortSignal.any([ctx.signal, timeout]);
    let output: ToolOutput;
    try {
      output = await Promise.race([
        Promise.resolve(tool.execute(args, { ...ctx, signal })),
        new Promise<never>((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })),
      ]);
    } catch (err) {
      const msg = errorMessage(err, tool);
      if (!(err instanceof ApiError)) console.error(`[ai] tool ${tool.name} failed`, err);
      const stored: StoredResult = { content: `Error: ${msg}`, isError: true, summary: msg };
      services.executions.finish(execId, 'failed', stored, msg, Date.now() - started);
      if (tool.risk !== 'read') services.audit.record({ userId: ctx.userId, action, toolName: tool.name, status: 'failed', details: { error: msg } });
      return { label: tool.label, sources: [], status: 'failed', content: stored.content, isError: true, summary: msg };
    }
    const stored: StoredResult = { content: serialize(output.data), isError: false, summary: output.summary, sources: output.sources, card: output.card };
    services.executions.finish(execId, 'succeeded', stored, undefined, Date.now() - started);
    if (tool.risk !== 'read') {
      services.audit.record({ userId: ctx.userId, action, toolName: tool.name, target: output.auditTarget, status: 'ok', details: { args } });
      if (output.episode && ctx.settings.memoryEnabled) services.memory.recordEpisode(ctx.userId, output.episode, ctx.conversationId);
    }
    return { label: tool.label, status: 'succeeded', content: stored.content, isError: false, summary: output.summary ?? 'Hoàn thành', sources: output.sources ?? [], card: output.card };
  }
}
