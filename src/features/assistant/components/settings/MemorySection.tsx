import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from '@/components/common/Icon';
import { assistantApi } from '../../services/assistantApi';
import type { Memory } from '../../types';
import { Input, Row, Section, Select, SmallButton, Toggle } from './controls';

const KIND: Record<Memory['kind'], string> = { preference: 'Sở thích', fact: 'Thông tin', rule: 'Quy tắc', episode: 'Sự kiện' };
const SOURCE: Record<Memory['source'], string> = { chat_confirmed: 'Từ trò chuyện (bạn đã xác nhận)', settings: 'Bạn thêm trong Cài đặt', action_log: 'Ghi lại thao tác đã làm' };

export function MemorySection({ enabled, onToggle }: { enabled: boolean; onToggle: (v: boolean) => void }) {
  const [items, setItems] = useState<Memory[]>([]);
  const [kind, setKind] = useState<Memory['kind']>('preference');
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = () => assistantApi.listMemories().then((r) => setItems(r.memories), (e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);

  const guard = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi');
    }
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    void guard(async () => {
      await assistantApi.addMemory(kind, text.trim());
      setText('');
    });
  };

  return (
    <Section
      title="Bộ nhớ"
      description="Trợ lý chỉ ghi nhớ khi bạn yêu cầu và xác nhận, hoặc khi bạn thêm ở đây. Lịch sử trò chuyện là riêng, không phải bộ nhớ."
      action={items.length ? <SmallButton danger onClick={() => window.confirm('Xoá toàn bộ ghi nhớ?') && void guard(() => assistantApi.clearMemories())}>Xoá tất cả</SmallButton> : undefined}
    >
      <Row label="Bộ nhớ dài hạn" hint="Tắt: trợ lý không đọc và không ghi thêm ghi nhớ nào.">
        <Toggle label="Bộ nhớ dài hạn" checked={enabled} onChange={onToggle} />
      </Row>
      <form onSubmit={add} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <div className="shrink-0 sm:w-56">
          <Select label="Loại ghi nhớ" value={kind} onChange={setKind} options={(['preference', 'fact', 'rule'] as const).map((k) => ({ value: k, label: KIND[k] }))} />
        </div>
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ví dụ: Tôi thích phòng có ban công" maxLength={500} aria-label="Nội dung ghi nhớ" />
        <SmallButton primary type="submit" disabled={!text.trim()}>
          Thêm
        </SmallButton>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-error-dark">{error}</p>}
      <ul className="mt-4 divide-y divide-gray-100">
        {!items.length && <li className="py-6 text-center text-sm text-gray-500">Chưa có ghi nhớ nào.</li>}
        {items.map((m) => (
          <li key={m.id} className="flex items-start gap-3 py-3">
            <span className="mt-0.5 shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">{KIND[m.kind]}</span>
            <div className="min-w-0 flex-1">
              {editing === m.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void guard(async () => {
                      await assistantApi.updateMemory(m.id, { content: draft });
                      setEditing(null);
                    });
                  }}
                  className="flex gap-2"
                >
                  <Input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} aria-label="Sửa ghi nhớ" autoFocus />
                  <SmallButton primary type="submit">Lưu</SmallButton>
                </form>
              ) : (
                <p className="text-sm text-gray-900">{m.content}</p>
              )}
              <p className="mt-0.5 text-xs text-gray-400">
                {SOURCE[m.source]} · {new Date(m.createdAt).toLocaleDateString('vi-VN')}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button type="button" aria-label="Sửa" onClick={() => (setEditing(m.id), setDraft(m.content))} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
                <Icon name="edit" size={15} />
              </button>
              <button type="button" aria-label="Xoá ghi nhớ" onClick={() => void guard(() => assistantApi.deleteMemory(m.id))} className="rounded-lg p-1.5 text-gray-500 hover:bg-[#fef3f2] hover:text-error-dark">
                <Icon name="trash" size={15} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
