import { Icon } from '@/components/common/Icon';
import { publicAsset } from '@/utils/assets';
import type { ChatMessage } from '../types';
import { ActionCard } from './ActionCard';
import { Markdown } from './Markdown';
import { Citations, ResultCards, ToolSteps } from './MessageParts';

type Turn = { kind: 'user'; message: ChatMessage } | { kind: 'assistant'; messages: ChatMessage[] };

/** Consecutive assistant messages (one per model step) render as one turn. */
function groupTurns(messages: ChatMessage[]): Turn[] {
  const turns: Turn[] = [];
  for (const m of messages) {
    const last = turns[turns.length - 1];
    if (m.role === 'user') turns.push({ kind: 'user', message: m });
    else if (last?.kind === 'assistant') last.messages.push(m);
    else turns.push({ kind: 'assistant', messages: [m] });
  }
  return turns;
}

interface Props {
  messages: ChatMessage[];
  busy: boolean;
  status: string | null;
  compact?: boolean;
  onDecide: (id: string, d: 'confirm' | 'cancel') => void;
  onNavigate?: () => void;
}

export function MessageList({ messages, busy, status, compact, onDecide, onNavigate }: Props) {
  const turns = groupTurns(messages);
  return (
    <div className="flex flex-col gap-6">
      {turns.map((t, i) =>
        t.kind === 'user' ? (
          <div key={t.message.id} className="flex flex-col items-end gap-1.5">
            {!!t.message.metadata.attachments?.length && (
              <div className="flex flex-wrap justify-end gap-1.5">
                {t.message.metadata.attachments.map((a) => (
                  <span key={a.id} className="flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700">
                    <Icon name="file" size={12} /> {a.title}
                  </span>
                ))}
              </div>
            )}
            <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-[20px] rounded-br-md bg-primary-dark px-4 py-2.5 text-[15px] leading-6 text-white">{t.message.content}</div>
          </div>
        ) : (
          <AssistantTurn key={t.messages[0].id} messages={t.messages} live={busy && i === turns.length - 1} status={busy && i === turns.length - 1 ? status : null} compact={compact} onDecide={onDecide} onNavigate={onNavigate} busy={busy} />
        ),
      )}
    </div>
  );
}

function AssistantTurn({ messages, live, status, compact, busy, onDecide, onNavigate }: { messages: ChatMessage[]; live: boolean; status: string | null; compact?: boolean; busy: boolean; onDecide: Props['onDecide']; onNavigate?: () => void }) {
  const citations = messages.flatMap((m) => m.metadata.citations ?? []);
  const cards = messages.flatMap((m) => m.metadata.cards ?? []);
  const citationNumbers = citations.map((c) => c.n);
  const stopped = messages.some((m) => m.status === 'stopped');
  const failed = messages.find((m) => m.status === 'error');
  const basic = messages.some((m) => m.metadata.mode === 'basic');
  const empty = !messages.some((m) => m.content || m.steps.length || m.confirmations.length);

  return (
    <div className="flex gap-3">
      {!compact && (
        <img src={publicAsset('assets/illustrations/mixi_transparent.png')} alt="" className="mt-0.5 h-8 w-8 shrink-0 rounded-full border border-gray-200 bg-white object-contain p-0.5" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-3 text-[15px] leading-[1.65] text-gray-800" aria-live={live ? 'polite' : undefined}>
        {messages.map((m) => (
          <div key={m.id} className="flex flex-col gap-3">
            {m.content && <Markdown text={m.content} onNavigate={onNavigate} citations={citationNumbers} />}
            <ToolSteps steps={m.steps} />
            {m.confirmations.map((c) => (
              <ActionCard key={c.id} confirmation={c} onDecide={onDecide} disabled={busy} />
            ))}
          </div>
        ))}
        {live && (status || empty) && (
          <div role="status" className="flex items-center gap-2 text-sm text-gray-500">
            <span className="flex gap-1" aria-hidden="true">
              {[0, 150, 300].map((d) => (
                <span key={d} className="h-1.5 w-1.5 rounded-full bg-primary motion-safe:animate-pulse" style={{ animationDelay: `${d}ms` }} />
              ))}
            </span>
            {status ?? 'Đang suy nghĩ…'}
          </div>
        )}
        <ResultCards cards={cards} onNavigate={onNavigate} />
        <Citations citations={citations} onNavigate={onNavigate} />
        {stopped && <p className="text-xs text-gray-400">Đã dừng tạo câu trả lời.</p>}
        {failed?.metadata.error && <p className="text-xs text-error-dark">{failed.metadata.error}</p>}
        {basic && <p className="text-xs text-gray-400">Chế độ cơ bản (chưa cấu hình AI provider).</p>}
      </div>
    </div>
  );
}
