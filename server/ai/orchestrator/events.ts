/** NDJSON events streamed to the browser during a turn. */
import type { ActionPreview, Citation, ResultCard } from '../tools/types.ts';

export interface ConfirmationView {
  id: string;
  toolName: string;
  preview: ActionPreview;
  status: 'pending' | 'executing' | 'confirmed' | 'cancelled' | 'expired';
  expiresAt: string;
}

export type AgentEvent =
  | { type: 'conversation'; conversation: { id: string; title: string } }
  | { type: 'status'; text: string }
  | { type: 'message'; id: string }
  | { type: 'text'; text: string }
  | { type: 'tool_start'; callId: string; name: string; label: string }
  | { type: 'tool_end'; callId: string; name: string; status: string; summary: string }
  | { type: 'confirmation'; confirmation: ConfirmationView }
  | { type: 'confirmation_update'; id: string; status: ConfirmationView['status'] }
  | { type: 'card'; card: ResultCard }
  | { type: 'citations'; citations: Citation[] }
  | { type: 'done'; messageId: string | null; mode: 'ai' | 'basic'; awaitingConfirmation: boolean; usage?: { inputTokens: number; outputTokens: number }; model?: string }
  | { type: 'error'; message: string; code?: string };

export type Emit = (e: AgentEvent) => void;
