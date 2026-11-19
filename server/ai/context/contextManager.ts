/**
 * Picks what the model sees for one call:
 *  - the recent window of the conversation (after any context reset),
 *    trimmed at user-turn boundaries to fit the token budget;
 *  - a few older messages that share words with the question;
 *  - long-term memories (when enabled), page context and attachments.
 * It also repairs the transcript so every tool call has a result.
 */
import type { StoredMessage } from '../conversations/conversationService.ts';
import type { LLMMessage } from '../providers/types.ts';
import { tokenize } from '../rag/text.ts';
import type { Services } from '../services.ts';
import type { UserSettings } from '../settings/settingsService.ts';
import { buildSystemPrompt, todayInVietnam } from '../orchestrator/systemPrompt.ts';

const OLD_TOOL_RESULT_CHARS = 800;
const estimateTokens = (s: string) => Math.ceil(s.length / 3.2);

export interface BuiltContext {
  system: string;
  messages: LLMMessage[];
  /** For debugging/tests: how many stored messages were included. */
  included: number;
  estimatedTokens: number;
}

export interface ContextInput {
  userId: string;
  userName?: string | null;
  conversationId: string;
  query: string;
  settings: UserSettings;
  contextWindow: number;
  maxOutputTokens: number;
  toolNames: string[];
  appContext?: { path?: string; title?: string };
  attachments?: { id: string; title: string }[];
}

/** Converts stored rows to provider messages, adding placeholder results for unanswered tool calls. */
export function toLLMMessages(rows: StoredMessage[], truncateBefore = -1): LLMMessage[] {
  const out: LLMMessage[] = [];
  const answered = new Set(rows.filter((r) => r.role === 'tool').map((r) => r.toolCallId));
  rows.forEach((r, i) => {
    if (r.role === 'user') out.push({ role: 'user', content: r.content });
    else if (r.role === 'assistant') {
      if (!r.content && !r.toolCalls.length) return;
      out.push({ role: 'assistant', content: r.content, ...(r.toolCalls.length ? { toolCalls: r.toolCalls } : {}) });
      for (const c of r.toolCalls) {
        if (!answered.has(c.id)) {
          out.push({ role: 'tool', toolCallId: c.id, toolName: c.name, content: 'No result recorded: the action was not performed (it may still be awaiting user confirmation).', isError: true });
        }
      }
    } else {
      const content = i < truncateBefore && r.content.length > OLD_TOOL_RESULT_CHARS ? `${r.content.slice(0, OLD_TOOL_RESULT_CHARS)}… [older result truncated]` : r.content;
      out.push({ role: 'tool', toolCallId: r.toolCallId ?? '', toolName: r.toolName ?? '', content, isError: r.status === 'error' || content.startsWith('Error:') });
    }
  });
  return out;
}

export class ContextManager {
  private readonly services: Services;
  constructor(services: Services) {
    this.services = services;
  }

  build(input: ContextInput): BuiltContext {
    const { conversations, memory } = this.services;
    const rows = conversations.messages(input.userId, input.conversationId, { afterReset: true });

    // Window: last N messages, starting at a user message so tool pairs stay intact.
    let start = Math.max(0, rows.length - input.settings.contextMessages);
    while (start > 0 && rows[start].role !== 'user') start--;

    // Older messages that look relevant to the current question.
    const terms = new Set(tokenize(input.query));
    const earlier = rows
      .slice(0, start)
      .filter((r) => (r.role === 'user' || r.role === 'assistant') && r.content)
      .map((r) => ({ r, score: tokenize(r.content).filter((t) => terms.has(t)).length }))
      .filter((x) => x.score >= 2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .sort((a, b) => a.r.seq - b.r.seq)
      .map((x) => `${x.r.role === 'user' ? 'User' : 'Assistant'}: ${x.r.content.replace(/\s+/g, ' ').slice(0, 300)}`);

    const memories = input.settings.memoryEnabled ? memory.relevant(input.userId, input.query).map((m) => ({ kind: m.kind, content: m.content })) : [];
    const system = buildSystemPrompt({
      settings: input.settings,
      today: todayInVietnam(),
      userName: input.userName,
      memories,
      earlierExcerpts: earlier,
      appContext: input.appContext,
      attachments: input.attachments ?? [],
      toolNames: input.toolNames,
    });

    // Token budget: drop whole oldest turns until the window fits.
    const budget = Math.max(2000, Math.floor(input.contextWindow * 0.75) - input.maxOutputTokens - estimateTokens(system) - 1500);
    let window = rows.slice(start);
    let messages = toLLMMessages(window, this.lastTurnStart(window));
    let tokens = messages.reduce((s, m) => s + estimateTokens(m.content) + ('toolCalls' in m && m.toolCalls ? estimateTokens(JSON.stringify(m.toolCalls)) : 0), 0);
    while (tokens > budget) {
      const nextUser = window.findIndex((r, i) => i > 0 && r.role === 'user');
      if (nextUser <= 0) break;
      window = window.slice(nextUser);
      messages = toLLMMessages(window, this.lastTurnStart(window));
      tokens = messages.reduce((s, m) => s + estimateTokens(m.content), 0);
    }
    return { system, messages, included: window.length, estimatedTokens: tokens + estimateTokens(system) };
  }

  /** Index of the latest user message: tool results before it are shortened. */
  private lastTurnStart(rows: StoredMessage[]): number {
    for (let i = rows.length - 1; i >= 0; i--) if (rows[i].role === 'user') return i;
    return 0;
  }
}
