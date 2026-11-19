import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiRequestError, assistantApi } from '../services/assistantApi';
import type { AgentEvent, ChatMessage, ConfirmationStatus } from '../types';

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

function liveAssistant(): ChatMessage {
  return { id: `live-${newId()}`, role: 'assistant', content: '', status: 'streaming', model: null, createdAt: new Date().toISOString(), metadata: {}, steps: [], confirmations: [] };
}

export interface UseChatOptions {
  conversationId: string | null;
  /** Called when the first message creates a conversation. */
  onConversationCreated?: (id: string) => void;
  /** Called when the title or order of conversations may have changed. */
  onActivity?: () => void;
  streaming?: boolean;
  appContext?: () => { path?: string; title?: string } | undefined;
}

/**
 * Chat state for one conversation: history from the server plus the live
 * turn built from streamed events. After each turn the history is reloaded
 * so the UI always ends on the server's persisted state.
 */
export function useChat({ conversationId, onConversationCreated, onActivity, streaming = true, appContext }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'ai' | 'basic' | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const convRef = useRef<string | null>(conversationId);
  // A conversation we just created is already loaded locally; skip the refetch.
  const createdRef = useRef<string | null>(null);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const { messages: m } = await assistantApi.getConversation(id);
      if (convRef.current === id) setMessages(m);
    } catch (e) {
      if (convRef.current === id) setError(e instanceof Error ? e.message : 'Không tải được cuộc trò chuyện.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    convRef.current = conversationId;
    setError(null);
    setStatus(null);
    if (!conversationId) {
      abortRef.current?.abort();
      setMessages([]);
      return;
    }
    if (createdRef.current === conversationId) {
      createdRef.current = null;
      return;
    }
    abortRef.current?.abort();
    setMessages([]);
    void load(conversationId);
  }, [conversationId, load]);

  useEffect(() => () => abortRef.current?.abort(), []);

  /** Applies one streamed event to the live assistant message (last item). */
  const apply = useCallback(
    (e: AgentEvent, buffered: { text: string }) => {
      const patchLive = (fn: (m: ChatMessage) => ChatMessage) =>
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (!last || !last.id.startsWith('live-')) return prev;
          return [...prev.slice(0, -1), fn(last)];
        });
      switch (e.type) {
        case 'status':
          setStatus(e.text);
          break;
        case 'text':
          setStatus(null);
          if (streaming) patchLive((m) => ({ ...m, content: m.content + e.text }));
          else buffered.text += e.text;
          break;
        case 'message':
          // A new model step may follow tool calls: keep paragraphs apart.
          patchLive((m) => (m.content && !m.content.endsWith('\n\n') ? { ...m, content: `${m.content}\n\n` } : m));
          break;
        case 'tool_start':
          setStatus(e.label);
          patchLive((m) => ({ ...m, steps: [...m.steps.filter((s) => s.callId !== e.callId), { callId: e.callId, name: e.name, label: e.label, status: 'running', summary: '' }] }));
          break;
        case 'tool_end':
          setStatus(null);
          patchLive((m) => ({ ...m, steps: m.steps.map((s) => (s.callId === e.callId ? { ...s, status: e.status, summary: e.summary } : s)) }));
          break;
        case 'confirmation':
          patchLive((m) => ({ ...m, confirmations: [...m.confirmations, e.confirmation] }));
          break;
        case 'confirmation_update':
          setMessages((prev) => prev.map((m) => (m.confirmations.some((c) => c.id === e.id) ? { ...m, confirmations: m.confirmations.map((c) => (c.id === e.id ? { ...c, status: e.status as ConfirmationStatus } : c)) } : m)));
          break;
        case 'card':
          patchLive((m) => ({ ...m, metadata: { ...m.metadata, cards: [...(m.metadata.cards ?? []), e.card] } }));
          break;
        case 'citations':
          patchLive((m) => ({ ...m, metadata: { ...m.metadata, citations: e.citations } }));
          break;
        case 'done':
          setMode(e.mode);
          if (!streaming && buffered.text) patchLive((m) => ({ ...m, content: m.content + buffered.text }));
          break;
        case 'error':
          setError(e.message);
          break;
        case 'conversation':
          break;
      }
    },
    [streaming],
  );

  const run = useCallback(
    async (id: string, start: (signal: AbortSignal) => AsyncGenerator<AgentEvent>) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);
      setStatus('Đang phân tích yêu cầu…');
      const buffered = { text: '' };
      try {
        for await (const e of start(controller.signal)) apply(e, buffered);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof ApiRequestError ? e.message : 'Mất kết nối. Vui lòng thử lại.');
      } finally {
        setBusy(false);
        setStatus(null);
        abortRef.current = null;
        onActivity?.();
        // Reload the persisted state (also after a stop: the partial answer is saved).
        if (convRef.current === id) await load(id);
      }
    },
    [apply, load, onActivity],
  );

  const send = useCallback(
    async (text: string, attachments: { id: string; title: string }[] = []) => {
      const content = text.trim();
      if (!content || busy) return false;
      setError(null);
      let id = convRef.current;
      if (!id) {
        try {
          id = (await assistantApi.createConversation()).conversation.id;
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Không tạo được cuộc trò chuyện.');
          return false;
        }
        convRef.current = id;
        createdRef.current = id;
        onConversationCreated?.(id);
      }
      const userMsg: ChatMessage = {
        id: `local-${newId()}`,
        role: 'user',
        content,
        status: 'complete',
        model: null,
        createdAt: new Date().toISOString(),
        metadata: attachments.length ? { attachments } : {},
        steps: [],
        confirmations: [],
      };
      setMessages((prev) => [...prev, userMsg, liveAssistant()]);
      const conv = id;
      await run(conv, (signal) => assistantApi.sendMessage(conv, { content, clientMessageId: newId(), attachments: attachments.map((a) => a.id), appContext: appContext?.() }, signal));
      return true;
    },
    [busy, run, onConversationCreated, appContext],
  );

  const decide = useCallback(
    async (confirmationId: string, decision: 'confirm' | 'cancel') => {
      const id = convRef.current;
      if (!id || busy) return;
      setError(null);
      setMessages((prev) => [
        ...prev.map((m) => ({ ...m, confirmations: m.confirmations.map((c) => (c.id === confirmationId ? { ...c, status: (decision === 'confirm' ? 'executing' : 'cancelled') as ConfirmationStatus } : c)) })),
        liveAssistant(),
      ]);
      await run(id, (signal) => assistantApi.decide(confirmationId, decision, signal));
    },
    [busy, run],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return { messages, loading, busy, status, error, mode, send, decide, stop, setError, reload: () => convRef.current && load(convRef.current) };
}
