/**
 * Shapes stored messages for the chat UI: tool messages are hidden, and
 * each assistant message carries its tool steps and confirmation cards
 * (from ai_tool_executions / ai_action_confirmations).
 */
import type { ConfirmationView } from '../orchestrator/events.ts';
import { toConfirmationView } from '../orchestrator/orchestrator.ts';
import type { Services } from '../services.ts';
import type { ToolRegistry } from '../tools/registry.ts';

export interface ViewStep {
  callId: string;
  name: string;
  label: string;
  status: string;
  summary: string;
}

export interface ViewMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: string;
  model: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
  steps: ViewStep[];
  confirmations: ConfirmationView[];
}

export function historyView(services: Services, registry: ToolRegistry, userId: string, conversationId: string): ViewMessage[] {
  const messages = services.conversations.messages(userId, conversationId);
  const executions = services.executions.forConversation(conversationId);
  const confirmations = new Map(services.confirmations.forConversation(userId, conversationId).map((c) => [c.toolCallId, c]));
  const execByCall = new Map(executions.map((e) => [e.toolCallId, e]));

  return messages
    .filter((m) => m.role !== 'tool')
    .map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      status: m.status,
      model: m.model,
      createdAt: m.createdAt,
      metadata: m.metadata as Record<string, unknown>,
      steps: m.toolCalls.map((c) => {
        const e = execByCall.get(c.id);
        return { callId: c.id, name: c.name, label: registry.get(c.name)?.label ?? c.name, status: e?.status ?? 'failed', summary: e?.result?.summary ?? '' };
      }),
      confirmations: m.toolCalls.map((c) => confirmations.get(c.id)).filter((c) => !!c).map(toConfirmationView),
    }))
    .filter((m) => m.role === 'user' || m.content || m.steps.length || m.status !== 'complete');
}
