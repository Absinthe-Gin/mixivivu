import type { ProviderInfo, ToolInfo, UserSettings } from '../../types';
import { RISK_BADGE, Row, Section, Select, Toggle } from './controls';

type Update = (patch: Partial<UserSettings>) => void;

export function ModelSection({ settings, providers, update }: { settings: UserSettings; providers: ProviderInfo[]; update: Update }) {
  const current = providers.find((p) => p.id === settings.providerId) ?? providers.find((p) => p.isDefault) ?? providers[0];
  const models = current ? [...new Set([current.model, ...current.models])] : [];
  return (
    <Section title="Mô hình AI" description="Chọn nhà cung cấp và mô hình trợ lý dùng cho bạn. Khoá API do máy chủ quản lý và không bao giờ gửi tới trình duyệt.">
      {providers.length === 0 ? (
        <p className="rounded-xl bg-[#fffaeb] px-3 py-2 text-sm text-warning-dark">Chưa cấu hình AI provider nào. Trợ lý đang chạy ở chế độ cơ bản (tìm kiếm từ khoá).</p>
      ) : (
        <>
          <Row label="Nhà cung cấp">
            <Select label="Nhà cung cấp" value={current?.id ?? ''} onChange={(v) => update({ providerId: v, model: null })} options={providers.map((p) => ({ value: p.id, label: `${p.name}${p.isDefault ? ' (mặc định)' : ''}` }))} />
          </Row>
          <Row label="Mô hình">
            <Select label="Mô hình" value={settings.model && models.includes(settings.model) ? settings.model : (current?.model ?? '')} onChange={(v) => update({ providerId: current?.id ?? null, model: v })} options={models.map((m) => ({ value: m, label: m }))} />
          </Row>
        </>
      )}
      <Row label="Hiển thị trực tiếp (streaming)" hint="Hiện câu trả lời trong lúc tạo.">
        <Toggle label="Streaming" checked={settings.streaming} onChange={(v) => update({ streaming: v })} />
      </Row>
    </Section>
  );
}

export function ChatSection({ settings, update }: { settings: UserSettings; update: Update }) {
  return (
    <Section title="Trò chuyện" description="Cách trợ lý trả lời và lượng ngữ cảnh gửi cho mô hình.">
      <Row label="Ngôn ngữ trả lời">
        <Select label="Ngôn ngữ trả lời" value={settings.responseLanguage} onChange={(v) => update({ responseLanguage: v })} options={[{ value: 'auto', label: 'Theo ngôn ngữ của bạn' }, { value: 'vi', label: 'Tiếng Việt' }, { value: 'en', label: 'English' }]} />
      </Row>
      <Row label="Phong cách">
        <Select label="Phong cách" value={settings.responseStyle} onChange={(v) => update({ responseStyle: v })} options={[{ value: 'concise', label: 'Ngắn gọn' }, { value: 'balanced', label: 'Cân bằng' }, { value: 'detailed', label: 'Chi tiết' }]} />
      </Row>
      <Row label="Độ dài ngữ cảnh" hint="Số tin nhắn gần nhất gửi kèm mỗi câu hỏi (nhiều hơn = hiểu tốt hơn, tốn token hơn).">
        <Select label="Độ dài ngữ cảnh" value={String(settings.contextMessages)} onChange={(v) => update({ contextMessages: Number(v) })} options={[8, 16, 24, 40, 60].map((n) => ({ value: String(n), label: `${n} tin nhắn` }))} />
      </Row>
    </Section>
  );
}

export function ToolsSection({ settings, tools, update }: { settings: UserSettings; tools: ToolInfo[]; update: Update }) {
  const categories = [...new Set(tools.map((t) => t.category))];
  const setEnabled = (t: ToolInfo, on: boolean) => {
    const disabled = new Set(settings.disabledTools);
    const enabled = new Set(settings.enabledTools);
    if (on) {
      disabled.delete(t.name);
      enabled.add(t.name);
    } else {
      disabled.add(t.name);
      enabled.delete(t.name);
    }
    update({ disabledTools: [...disabled], enabledTools: [...enabled] });
  };
  return (
    <Section title="Công cụ" description="Những thao tác trợ lý được phép dùng. Quyền luôn được máy chủ kiểm tra; thao tác xoá luôn cần bạn xác nhận.">
      <Row label="Xác nhận thao tác ghi dữ liệu" hint="Thao tác xoá hoặc ảnh hưởng nhiều dữ liệu luôn hỏi lại, bất kể lựa chọn này.">
        <Select label="Chính sách xác nhận" value={settings.confirmWrites} onChange={(v) => update({ confirmWrites: v })} options={[{ value: 'significant', label: 'Chỉ khi quan trọng' }, { value: 'always', label: 'Luôn hỏi' }]} />
      </Row>
      <Row label="Giới hạn số lần gọi công cụ mỗi câu hỏi">
        <Select label="Giới hạn gọi công cụ" value={String(settings.maxToolCalls)} onChange={(v) => update({ maxToolCalls: Number(v) })} options={[2, 4, 6, 8, 10, 12].map((n) => ({ value: String(n), label: `${n} lần` }))} />
      </Row>
      <div className="mt-4 flex flex-col gap-5">
        {categories.map((cat) => (
          <div key={cat}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{cat}</p>
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
              {tools
                .filter((t) => t.category === cat)
                .map((t) => (
                  <li key={t.name} className="flex items-start gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="text-[13px] font-semibold text-gray-900">{t.name}</code>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${RISK_BADGE[t.group].cls}`}>{RISK_BADGE[t.group].label}</span>
                        {t.confirmation === 'always' && <span className="rounded-full bg-[#fffaeb] px-2 py-0.5 text-[11px] font-semibold text-warning-dark">Luôn xác nhận</span>}
                        {!t.available && <span className="text-[11px] text-gray-400">Chưa cấu hình trên máy chủ</span>}
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">{t.description}</p>
                    </div>
                    <Toggle label={`Bật ${t.name}`} checked={t.enabled} disabled={!t.available || (t.category === 'Bộ nhớ' && !settings.memoryEnabled)} onChange={(v) => setEnabled(t, v)} />
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}
