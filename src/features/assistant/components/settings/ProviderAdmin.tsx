import { useState, type FormEvent } from 'react';
import { assistantApi } from '../../services/assistantApi';
import type { ProviderInfo } from '../../types';
import { Input, Section, Select, SmallButton } from './controls';

const TYPES = [
  { value: 'ollama', label: 'Ollama (local)' },
  { value: 'openai_compatible', label: 'OpenAI-compatible' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
] as const;

const EMPTY = { name: '', type: 'ollama' as ProviderInfo['type'], baseUrl: 'http://localhost:11434', model: '', models: '', apiKey: '', temperature: '', maxTokens: '2048', contextWindow: '16384', timeoutMs: '120000' };

/** Admin-only: manage provider configs stored on the server. API keys are write-only. */
export function ProviderAdmin({ providers, onChanged }: { providers: ProviderInfo[]; onChanged: () => void }) {
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const edit = (p: ProviderInfo) => {
    setEditing(p.id);
    setForm({ name: p.name, type: p.type, baseUrl: p.baseUrl ?? '', model: p.model, models: p.models.join(', '), apiKey: '', temperature: p.temperature?.toString() ?? '', maxTokens: String(p.maxTokens ?? 2048), contextWindow: String(p.contextWindow ?? 16384), timeoutMs: String(p.timeoutMs ?? 60000) });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const body: Record<string, unknown> = {
      name: form.name,
      type: form.type,
      baseUrl: form.baseUrl || null,
      model: form.model,
      models: form.models.split(',').map((s) => s.trim()).filter(Boolean),
      temperature: form.temperature === '' ? null : Number(form.temperature),
      maxTokens: Number(form.maxTokens),
      contextWindow: Number(form.contextWindow),
      timeoutMs: Number(form.timeoutMs),
    };
    if (form.apiKey) body.apiKey = form.apiKey;
    try {
      if (editing) await assistantApi.updateProvider(editing, body);
      else await assistantApi.createProvider(body);
      setForm(EMPTY);
      setEditing(null);
      setMessage({ ok: true, text: 'Đã lưu cấu hình.' });
      onChanged();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Lưu thất bại.' });
    } finally {
      setBusy(false);
    }
  };

  const validate = async (id: string) => {
    setMessage({ ok: true, text: 'Đang kiểm tra kết nối…' });
    try {
      const { result, models } = await assistantApi.validateProvider(id);
      setMessage({ ok: result.ok, text: `${result.message}${models.length ? ` Models: ${models.slice(0, 8).map((m) => m.id + (m.supportsTools === false ? ' (không tools)' : '')).join(', ')}` : ''}` });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Kiểm tra thất bại.' });
    }
  };

  return (
    <Section title="Cấu hình provider (quản trị)" description="Cấu hình từ biến môi trường hiển thị nhưng không sửa được ở đây. Khoá API được mã hoá trên máy chủ (cần AI_SECRET_KEY) và chỉ hiện 4 ký tự cuối.">
      <ul className="mb-4 divide-y divide-gray-100 rounded-xl border border-gray-200">
        {providers.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900">
                {p.name} {p.isDefault && <span className="ml-1 rounded-full bg-primary-light px-2 py-0.5 text-[11px] text-primary-dark">Mặc định</span>}
              </p>
              <p className="truncate text-xs text-gray-500">
                {p.type} · {p.model}
                {p.baseUrl ? ` · ${p.baseUrl}` : ''} · {p.hasApiKey ? `API key ${p.apiKeyHint}` : 'không có API key'} · {p.origin === 'env' ? 'biến môi trường' : 'cài đặt'}
                {p.enabled === false ? ' · đang tắt' : ''}
              </p>
            </div>
            <SmallButton onClick={() => void validate(p.id)}>Kiểm tra</SmallButton>
            {p.origin === 'db' && (
              <>
                <SmallButton onClick={() => edit(p)}>Sửa</SmallButton>
                {!p.isDefault && <SmallButton onClick={() => void assistantApi.updateProvider(p.id, { isDefault: true }).then(onChanged)}>Đặt mặc định</SmallButton>}
                <SmallButton danger onClick={() => window.confirm(`Xoá ${p.name}?`) && void assistantApi.deleteProvider(p.id).then(onChanged)}>Xoá</SmallButton>
              </>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-gray-700">Tên</span>
          <Input value={form.name} onChange={set('name')} required maxLength={60} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-700">Loại</span>
          <Select label="Loại provider" value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v }))} options={TYPES.map((t) => ({ value: t.value, label: t.label }))} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-700">Base URL</span>
          <Input value={form.baseUrl} onChange={set('baseUrl')} placeholder="https://api.example.com/v1" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-700">Model mặc định</span>
          <Input value={form.model} onChange={set('model')} required placeholder="qwen3.5:4b" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-700">Model khác cho người dùng chọn (phân cách bằng dấu phẩy)</span>
          <Input value={form.models} onChange={set('models')} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-700">API key {editing && '(để trống = giữ nguyên)'}</span>
          <Input type="password" value={form.apiKey} onChange={set('apiKey')} autoComplete="off" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-700">Temperature (0-2, trống = mặc định)</span>
          <Input inputMode="decimal" value={form.temperature} onChange={set('temperature')} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-700">Max tokens</span>
          <Input inputMode="numeric" value={form.maxTokens} onChange={set('maxTokens')} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-700">Context window</span>
          <Input inputMode="numeric" value={form.contextWindow} onChange={set('contextWindow')} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-700">Timeout (ms)</span>
          <Input inputMode="numeric" value={form.timeoutMs} onChange={set('timeoutMs')} />
        </label>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <SmallButton primary type="submit" disabled={busy}>
            {editing ? 'Lưu thay đổi' : 'Thêm provider'}
          </SmallButton>
          {editing && (
            <SmallButton onClick={() => (setEditing(null), setForm(EMPTY))}>Huỷ sửa</SmallButton>
          )}
          {message && <p className={`text-sm ${message.ok ? 'text-gray-700' : 'text-error-dark'}`}>{message.text}</p>}
        </div>
      </form>
    </Section>
  );
}
