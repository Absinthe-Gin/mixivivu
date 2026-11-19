import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/common/Icon';
import { Loading } from '@/components/feedback/States';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { cx } from '@/utils/cx';
import { DataSection, DocumentsSection } from '../components/settings/DataSections';
import { MemorySection } from '../components/settings/MemorySection';
import { ChatSection, ModelSection, ToolsSection } from '../components/settings/PreferenceSections';
import { ProviderAdmin } from '../components/settings/ProviderAdmin';
import { ASSISTANT_ROUTES } from '../routes';
import { assistantApi } from '../services/assistantApi';
import type { ProviderInfo, ToolInfo, UserSettings } from '../types';

const TABS = [
  { id: 'ai', label: 'AI' },
  { id: 'chat', label: 'Trò chuyện' },
  { id: 'tools', label: 'Công cụ' },
  { id: 'memory', label: 'Bộ nhớ' },
  { id: 'documents', label: 'Tài liệu' },
  { id: 'data', label: 'Dữ liệu' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export function AssistantSettingsPage() {
  useDocumentTitle('Cài đặt trợ lý');
  const [tab, setTab] = useState<Tab>('ai');
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [providers, setProviders] = useState<{ list: ProviderInfo[]; canManage: boolean }>({ list: [], canManage: false });
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProviders = useCallback(() => assistantApi.listProviders().then((r) => setProviders({ list: r.providers, canManage: r.canManage })), []);
  useEffect(() => {
    assistantApi.getSettings().then((r) => setSettings(r.settings), (e) => setError(e.message));
    assistantApi.listTools().then((r) => setTools(r.tools), () => undefined);
    void loadProviders();
  }, [loadProviders]);

  const update = async (patch: Partial<UserSettings>) => {
    setError(null);
    setSettings((s) => (s ? { ...s, ...patch } : s));
    try {
      const r = await assistantApi.updateSettings(patch);
      setSettings(r.settings);
      setTools((await assistantApi.listTools()).tools);
      setSaved('Đã lưu');
      setTimeout(() => setSaved(null), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lưu thất bại.');
      assistantApi.getSettings().then((r) => setSettings(r.settings), () => undefined);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <header className="sticky top-0 z-header border-b border-gray-200 bg-white pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
          <Link to={ASSISTANT_ROUTES.home} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100" aria-label="Quay lại trợ lý">
            <Icon name="arrowLeft" size={18} /> Trợ lý
          </Link>
          <p className="flex-1 text-[15px] font-bold text-gray-900">Cài đặt</p>
          <span role="status" className="text-xs text-success-dark">
            {saved}
          </span>
        </div>
        <nav aria-label="Mục cài đặt" className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-3 pb-2">
          {TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined} className={cx('shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium', tab === t.id ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100')}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6 pb-[max(24px,env(safe-area-inset-bottom))]">
        {error && <p role="alert" className="rounded-xl bg-[#fef3f2] px-3 py-2 text-sm text-error-dark">{error}</p>}
        {!settings ? (
          <Loading />
        ) : (
          <>
            {tab === 'ai' && (
              <>
                <ModelSection settings={settings} providers={providers.list.filter((p) => p.enabled !== false)} update={update} />
                {providers.canManage && <ProviderAdmin providers={providers.list} onChanged={() => void loadProviders()} />}
              </>
            )}
            {tab === 'chat' && <ChatSection settings={settings} update={update} />}
            {tab === 'tools' && <ToolsSection settings={settings} tools={tools} update={update} />}
            {tab === 'memory' && <MemorySection enabled={settings.memoryEnabled} onToggle={(v) => void update({ memoryEnabled: v })} />}
            {tab === 'documents' && <DocumentsSection />}
            {tab === 'data' && <DataSection />}
          </>
        )}
      </main>
    </div>
  );
}
