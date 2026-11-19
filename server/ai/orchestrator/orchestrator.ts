/**
 * AI orchestrator: the agent loop.
 *
 *   user message → context → LLM (streamed) → structured tool calls →
 *   ToolExecutor (validation, permissions, confirmation) → tool results →
 *   LLM … → final answer
 *
 * A turn pauses when an action needs confirmation; `decide` resumes it
 * after the user confirms or cancels on the action card. Tool calls come
 * only from the provider's structured tool-calling channel, never from
 * parsing free text.
 */
import { basicAnswer } from '../../basicMode.ts';
import type { AuthUser } from '../../auth/authService.ts';
import { ApiError } from '../../shared/http.ts';
import { ContextManager } from '../context/contextManager.ts';
import type { MessageMetadata } from '../conversations/conversationService.ts';
import type { LLMProvider, ToolCall, TokenUsage } from '../providers/types.ts';
import { ProviderError } from '../providers/types.ts';
import type { Confirmation } from '../security/confirmationService.ts';
import type { Services } from '../services.ts';
import { MAX_TOOL_CALLS, type UserSettings } from '../settings/settingsService.ts';
import type { ToolRegistry } from '../tools/registry.ts';
import type { Citation, ResultCard, ToolContext } from '../tools/types.ts';
import type { ConfirmationView, Emit } from './events.ts';
import { ToolExecutor, type ExecOutcome } from './toolExecutor.ts';

export const MAX_USER_MESSAGE_CHARS = 4000;

export interface TurnInput {
  user: AuthUser;
  conversationId: string;
  content: string;
  clientMessageId?: string;
  attachmentIds?: string[];
  appContext?: { path?: string; title?: string };
  signal: AbortSignal;
  emit: Emit;
}

interface LoopState {
  user: AuthUser;
  conversationId: string;
  settings: UserSettings;
  provider: LLMProvider;
  model: string;
  query: string;
  appContext?: { path?: string; title?: string };
  attachments: { id: string; title: string }[];
  signal: AbortSignal;
  emit: Emit;
  citations: Citation[];
  cards: ResultCard[];
  toolCallsUsed: number;
  usage: { inputTokens: number; outputTokens: number };
}

export const toConfirmationView = (c: Confirmation): ConfirmationView => ({ id: c.id, toolName: c.toolName, preview: c.preview, status: c.status, expiresAt: c.expiresAt });

export class Orchestrator {
  private readonly services: Services;
  private readonly registry: ToolRegistry;
  private readonly executor: ToolExecutor;
  private readonly context: ContextManager;

  constructor(services: Services, registry: ToolRegistry) {
    this.services = services;
    this.registry = registry;
    this.executor = new ToolExecutor(registry);
    this.context = new ContextManager(services);
  }

  /** Handles one user message end to end. */
  async runTurn(input: TurnInput): Promise<void> {
    const { services } = this;
    const { user, conversationId, emit } = input;
    const content = input.content.trim();
    if (!content) throw new ApiError(400, 'Tin nhắn trống.', 'validation');
    if (content.length > MAX_USER_MESSAGE_CHARS) throw new ApiError(400, `Tin nhắn quá dài (tối đa ${MAX_USER_MESSAGE_CHARS} ký tự).`, 'validation');
    services.conversations.get(user.id, conversationId);

    // Attachments must be the user's own uploads.
    const attachments = (input.attachmentIds ?? []).slice(0, 5).map((id) => {
      const d = services.rag.get(user.id, id);
      return { id: d.id, title: d.title };
    });

    // A new message implicitly declines any action still waiting for confirmation.
    for (const c of services.confirmations.pending(user.id, conversationId)) this.closeConfirmation(user, c, 'cancelled', emit, 'The user sent a new message instead of confirming. The action was NOT performed.');

    const settings = services.settings.get(user.id);
    const userMsg = services.conversations.append(user.id, conversationId, {
      role: 'user',
      content,
      clientMessageId: input.clientMessageId,
      metadata: { ...(attachments.length ? { attachments } : {}), ...(input.appContext?.path ? { appContext: input.appContext } : {}) },
    });
    const conv = services.conversations.get(user.id, conversationId);
    emit({ type: 'conversation', conversation: { id: conv.id, title: conv.title } });
    void userMsg;

    const resolved = services.providers.resolve({ providerId: settings.providerId, model: settings.model });
    if (!resolved) return this.basicMode(user, conversationId, content, emit);

    await this.loop({
      user,
      conversationId,
      settings,
      provider: resolved.provider,
      model: resolved.model,
      query: content,
      appContext: input.appContext,
      attachments,
      signal: input.signal,
      emit,
      citations: [],
      cards: [],
      toolCallsUsed: 0,
      usage: { inputTokens: 0, outputTokens: 0 },
    });
  }

  /** Applies the user's decision on an action card, then lets the model continue. */
  async decide(input: { user: AuthUser; confirmationId: string; decision: 'confirm' | 'cancel'; signal: AbortSignal; emit: Emit }): Promise<void> {
    const { services } = this;
    const { user, emit } = input;
    const c = services.confirmations.get(user.id, input.confirmationId);
    services.conversations.get(user.id, c.conversationId);
    if (c.status !== 'pending') throw new ApiError(409, 'Thao tác này đã được xử lý.', 'already_decided');

    const settings = services.settings.get(user.id);
    if (services.confirmations.isExpired(c)) {
      this.closeConfirmation(user, c, 'expired', emit, 'The confirmation expired. The action was NOT performed; ask the user if they still want it.');
    } else if (input.decision === 'cancel') {
      this.closeConfirmation(user, c, 'cancelled', emit, 'The user cancelled this action. It was NOT performed. Acknowledge briefly.');
    } else {
      // Compare-and-set: only one request can move pending → executing.
      if (!services.confirmations.transition(user.id, c.id, 'executing')) throw new ApiError(409, 'Thao tác này đã được xử lý.', 'already_decided');
      emit({ type: 'confirmation_update', id: c.id, status: 'executing' });
      const exec = services.executions.byCallId(c.toolCallId)!;
      emit({ type: 'tool_start', callId: c.toolCallId, name: c.toolName, label: this.executor.label(c.toolName) });
      const ctx: ToolContext = { userId: user.id, conversationId: c.conversationId, messageId: exec.messageId, services, settings, signal: input.signal };
      const outcome = await this.executor.runConfirmed(c, ctx);
      services.confirmations.transition(user.id, c.id, 'confirmed', 'executing');
      services.audit.record({ userId: user.id, action: 'confirmation.confirm', toolName: c.toolName, target: c.preview.target, status: outcome.status === 'succeeded' ? 'ok' : 'failed' });
      emit({ type: 'confirmation_update', id: c.id, status: 'confirmed' });
      emit({ type: 'tool_end', callId: c.toolCallId, name: c.toolName, status: outcome.status, summary: outcome.summary });
      if (outcome.card) emit({ type: 'card', card: outcome.card });
      services.conversations.append(user.id, c.conversationId, { role: 'tool', content: outcome.content, toolCallId: c.toolCallId, toolName: c.toolName, status: outcome.isError ? 'error' : 'complete' });
      if (outcome.card) services.conversations.patchMetadata(exec.messageId, { cards: [...((services.conversations.message(exec.messageId)?.metadata.cards as unknown[]) ?? []), outcome.card] });
    }

    // Other actions from the same step still waiting: keep the turn paused.
    if (services.confirmations.pending(user.id, c.conversationId).length) {
      emit({ type: 'done', messageId: null, mode: 'ai', awaitingConfirmation: true });
      return;
    }
    const resolved = services.providers.resolve({ providerId: settings.providerId, model: settings.model });
    if (!resolved) {
      emit({ type: 'done', messageId: null, mode: 'basic', awaitingConfirmation: false });
      return;
    }
    const lastUser = [...services.conversations.messages(user.id, c.conversationId)].reverse().find((m) => m.role === 'user');
    await this.loop({
      user,
      conversationId: c.conversationId,
      settings,
      provider: resolved.provider,
      model: resolved.model,
      query: lastUser?.content ?? '',
      appContext: lastUser?.metadata.appContext,
      attachments: lastUser?.metadata.attachments ?? [],
      signal: input.signal,
      emit,
      citations: [],
      cards: [],
      toolCallsUsed: 0,
      usage: { inputTokens: 0, outputTokens: 0 },
    });
  }

  // ---------- the loop ----------

  private async loop(s: LoopState): Promise<void> {
    const { services } = this;
    const maxCalls = Math.min(s.settings.maxToolCalls, MAX_TOOL_CALLS);
    const toolSpecs = this.registry.specsFor(s.settings, services);
    s.emit({ type: 'status', text: 'Đang phân tích yêu cầu…' });

    for (let iteration = 0; ; iteration++) {
      // Once the budget is spent the model must answer with what it has.
      const allowTools = s.toolCallsUsed < maxCalls && iteration < maxCalls + 1;
      const ctx = this.context.build({
        userId: s.user.id,
        userName: s.user.displayName ?? s.user.username,
        conversationId: s.conversationId,
        query: s.query,
        settings: s.settings,
        contextWindow: s.provider.config.contextWindow,
        maxOutputTokens: s.provider.config.maxTokens,
        toolNames: toolSpecs.map((t) => t.name),
        appContext: s.appContext,
        attachments: s.attachments,
      });
      const system = allowTools ? ctx.system : `${ctx.system}\n\n# Note\nThe tool-call limit for this request is reached. Answer now with the information you have.`;

      let text = '';
      const calls: ToolCall[] = [];
      let usage: TokenUsage = {};
      let model = s.model;
      let stopReason = 'end';
      try {
        for await (const e of this.withRetry(s, { system, messages: ctx.messages, tools: allowTools ? toolSpecs : undefined, model: s.model, signal: s.signal }, () => text.length > 0 || calls.length > 0)) {
          if (e.type === 'text') {
            text += e.text;
            s.emit({ type: 'text', text: e.text });
          } else if (e.type === 'tool_call') calls.push(e.call);
          else {
            usage = e.usage;
            model = e.model;
            stopReason = e.stopReason;
          }
        }
      } catch (err) {
        if (s.signal.aborted) {
          if (text) services.conversations.append(s.user.id, s.conversationId, { role: 'assistant', content: text, status: 'stopped', provider: s.provider.config.id, model });
          return;
        }
        // No usable credentials and nothing said yet: answer in basic mode like before.
        if (err instanceof ProviderError && err.kind === 'auth' && iteration === 0 && !text) {
          console.warn('[ai] provider auth failed, falling back to basic mode:', err.message);
          return this.basicMode(s.user, s.conversationId, s.query, s.emit);
        }
        console.error('[ai] provider error', err);
        const message = providerErrorMessage(err);
        services.conversations.append(s.user.id, s.conversationId, { role: 'assistant', content: text, status: 'error', provider: s.provider.config.id, model, metadata: { error: message } });
        s.emit({ type: 'error', message, code: err instanceof ProviderError ? err.kind : 'unknown' });
        return;
      }

      s.usage.inputTokens += usage.inputTokens ?? 0;
      s.usage.outputTokens += usage.outputTokens ?? 0;
      if (stopReason === 'refusal' && !text) {
        text = 'Xin lỗi, mình không thể hỗ trợ yêu cầu này.';
        s.emit({ type: 'text', text });
      }
      const assistant = services.conversations.append(s.user.id, s.conversationId, {
        role: 'assistant',
        content: text,
        toolCalls: calls,
        provider: s.provider.config.id,
        model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      });
      s.emit({ type: 'message', id: assistant.id });

      if (!calls.length) {
        this.finish(s, assistant.id, false, model);
        return;
      }

      let awaiting = false;
      for (const call of calls) {
        if (s.signal.aborted) break;
        s.emit({ type: 'tool_start', callId: call.id, name: call.name, label: this.executor.label(call.name) });
        let outcome: ExecOutcome;
        if (s.toolCallsUsed >= maxCalls) {
          outcome = { status: 'rejected', content: 'Tool-call limit for this request reached. Answer with what you have.', isError: true, summary: 'Đã đạt giới hạn số lần gọi công cụ', label: '', sources: [] };
        } else {
          s.toolCallsUsed++;
          outcome = await this.executor.execute(call, { userId: s.user.id, conversationId: s.conversationId, messageId: assistant.id, services, settings: s.settings, signal: s.signal });
        }
        s.emit({ type: 'tool_end', callId: call.id, name: call.name, status: outcome.status, summary: outcome.summary });

        if (outcome.status === 'awaiting_confirmation' && outcome.confirmation) {
          awaiting = true;
          s.emit({ type: 'confirmation', confirmation: toConfirmationView(outcome.confirmation) });
          continue; // the tool message is written when the user decides
        }
        let content = outcome.content;
        if (outcome.sources.length) {
          const numbered = outcome.sources.map((src) => ({ ...src, n: s.citations.length + 1 + outcome.sources.indexOf(src) }));
          s.citations.push(...numbered);
          content += `\nCite as: ${numbered.map((c) => `[${c.n}] ${c.title}`).join('; ')}`;
        }
        if (outcome.card) {
          s.cards.push(outcome.card);
          s.emit({ type: 'card', card: outcome.card });
        }
        services.conversations.append(s.user.id, s.conversationId, { role: 'tool', content, toolCallId: call.id, toolName: call.name, status: outcome.isError ? 'error' : 'complete' });
      }

      if (s.signal.aborted) return;
      if (awaiting) {
        this.finish(s, assistant.id, true, model);
        return;
      }
    }
  }

  /** Retries once on transient provider errors, but only before anything was streamed. */
  private async *withRetry(s: LoopState, req: Parameters<LLMProvider['streamResponse']>[0], streamed: () => boolean) {
    for (let attempt = 0; ; attempt++) {
      try {
        yield* s.provider.streamResponse(req);
        return;
      } catch (err) {
        const transient = err instanceof ProviderError && (err.kind === 'rate_limit' || err.kind === 'connection');
        if (!transient || attempt >= 1 || streamed() || s.signal.aborted) throw err;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  private finish(s: LoopState, messageId: string, awaitingConfirmation: boolean, model: string) {
    const meta: MessageMetadata = { mode: 'ai' };
    if (s.citations.length) {
      meta.citations = s.citations;
      s.emit({ type: 'citations', citations: s.citations });
    }
    if (s.cards.length) meta.cards = s.cards;
    this.services.conversations.patchMetadata(messageId, meta);
    s.emit({ type: 'done', messageId, mode: 'ai', awaitingConfirmation, usage: s.usage, model });
  }

  private basicMode(user: AuthUser, conversationId: string, question: string, emit: Emit) {
    const text = basicAnswer(question);
    emit({ type: 'text', text });
    const m = this.services.conversations.append(user.id, conversationId, { role: 'assistant', content: text, provider: 'basic', metadata: { mode: 'basic' } });
    emit({ type: 'done', messageId: m.id, mode: 'basic', awaitingConfirmation: false });
  }

  private closeConfirmation(user: AuthUser, c: Confirmation, status: 'cancelled' | 'expired', emit: Emit, toolResult: string) {
    const { services } = this;
    if (!services.confirmations.transition(user.id, c.id, status)) return;
    services.executions.finish(c.toolExecutionId, 'cancelled', { content: toolResult, isError: true, summary: status === 'expired' ? 'Đã hết hạn' : 'Đã huỷ' });
    services.conversations.append(user.id, c.conversationId, { role: 'tool', content: toolResult, toolCallId: c.toolCallId, toolName: c.toolName, status: 'error' });
    services.audit.record({ userId: user.id, action: `confirmation.${status === 'expired' ? 'expire' : 'cancel'}`, toolName: c.toolName, target: c.preview.target, status: 'cancelled' });
    emit({ type: 'confirmation_update', id: c.id, status });
  }
}

function providerErrorMessage(err: unknown): string {
  if (err instanceof ProviderError) {
    switch (err.kind) {
      case 'rate_limit':
        return 'Máy chủ AI đang bận, bạn thử lại sau ít phút nhé.';
      case 'connection':
        return 'Không kết nối được tới máy chủ AI. Vui lòng thử lại.';
      case 'timeout':
        return 'Máy chủ AI phản hồi quá lâu. Bạn thử hỏi ngắn gọn hơn nhé.';
      case 'unsupported':
        return `Model hiện tại không hỗ trợ gọi công cụ. ${err.message}`;
      case 'auth':
        return 'Cấu hình AI chưa đúng (API key). Quản trị viên cần kiểm tra trong Cài đặt.';
      default:
        return 'Trợ lý gặp sự cố. Vui lòng thử lại hoặc gọi hotline 0922222016.';
    }
  }
  return 'Trợ lý gặp sự cố. Vui lòng thử lại hoặc gọi hotline 0922222016.';
}
