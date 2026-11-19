import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/common/Icon';
import { MAX_UPLOAD_BYTES, UPLOAD_ACCEPT, assistantApi } from '../../services/assistantApi';
import type { DocumentInfo } from '../../types';
import { Section, SmallButton } from './controls';

export function DocumentsSection() {
  const [docs, setDocs] = useState<DocumentInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const load = () => assistantApi.listDocuments().then((r) => setDocs(r.documents), (e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);

  const upload = async (file?: File) => {
    if (!file) return;
    setError(null);
    if (file.size > MAX_UPLOAD_BYTES) return setError('Tệp tối đa 2 MB.');
    setUploading(true);
    try {
      await assistantApi.uploadDocument(file);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tải lên thất bại.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Section
      title="Tài liệu"
      description="Tài liệu riêng của bạn để trợ lý tìm kiếm, tóm tắt và so sánh (TXT, MD, CSV, DOCX, XLSX; tối đa 2 MB). Người khác không truy cập được."
      action={
        <>
          <input ref={fileRef} type="file" accept={UPLOAD_ACCEPT} className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
          <SmallButton primary onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? 'Đang tải…' : 'Tải tài liệu lên'}
          </SmallButton>
        </>
      }
    >
      {error && <p role="alert" className="mb-2 text-sm text-error-dark">{error}</p>}
      <ul className="divide-y divide-gray-100">
        {!docs.length && <li className="py-6 text-center text-sm text-gray-500">Chưa có tài liệu.</li>}
        {docs.map((d) => (
          <li key={d.id} className="flex items-center gap-3 py-3">
            <Icon name="file" size={18} className="shrink-0 text-gray-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{d.title}</p>
              <p className="text-xs text-gray-500">
                {Math.max(1, Math.round((d.sizeBytes ?? 0) / 1024))} KB · {d.chunkCount} đoạn · {new Date(d.createdAt).toLocaleDateString('vi-VN')}
              </p>
            </div>
            <button
              type="button"
              aria-label={`Xoá ${d.title}`}
              onClick={async () => {
                if (!window.confirm(`Xoá "${d.title}"?`)) return;
                await assistantApi.deleteDocument(d.id);
                await load();
              }}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-[#fef3f2] hover:text-error-dark"
            >
              <Icon name="trash" size={15} />
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

type MyData = Awaited<ReturnType<typeof assistantApi.myData>>;
type Audit = Awaited<ReturnType<typeof assistantApi.audit>>['entries'];

const STATUS: Record<string, string> = { planning: 'Đang lên kế hoạch', booked: 'Đã đặt', done: 'Đã đi', cancelled: 'Đã huỷ' };

export function DataSection() {
  const [data, setData] = useState<MyData | null>(null);
  const [audit, setAudit] = useState<Audit>([]);
  useEffect(() => {
    assistantApi.myData().then(setData, () => undefined);
    assistantApi.audit().then((r) => setAudit(r.entries), () => undefined);
  }, []);

  return (
    <>
      <Section title="Dữ liệu của bạn" description="Kế hoạch, yêu thích và ghi chú mà trợ lý quản lý giúp bạn.">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="mb-2 text-sm font-semibold text-gray-900">Chuyến đi ({data?.trips.length ?? 0})</p>
            <ul className="space-y-2 text-sm">
              {data?.trips.map((t) => (
                <li key={t.id} className="rounded-xl bg-gray-50 px-3 py-2">
                  <p className="font-medium text-gray-900">{t.title}</p>
                  <p className="text-xs text-gray-500">
                    {[t.destination, t.startDate, STATUS[t.status]].filter(Boolean).join(' · ')}
                    {t.items.length ? ` · ${t.items.length} mục` : ''}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-gray-900">Yêu thích ({data?.favorites.length ?? 0})</p>
            <ul className="space-y-2 text-sm">
              {data?.favorites.map((f) => (
                <li key={f.id}>
                  <Link to={f.link} className="block rounded-xl bg-gray-50 px-3 py-2 text-gray-900 hover:bg-[#effcfc]">
                    {f.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-gray-900">Ghi chú ({data?.notes.length ?? 0})</p>
            <ul className="space-y-2 text-sm">
              {data?.notes.map((n) => (
                <li key={n.id} className="rounded-xl bg-gray-50 px-3 py-2">
                  <p className="font-medium text-gray-900">{n.title}</p>
                  {n.content && <p className="line-clamp-2 text-xs text-gray-500">{n.content}</p>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>
      <Section title="Nhật ký thao tác" description="Các thao tác ghi dữ liệu, xác nhận và thay đổi cài đặt gần đây.">
        <ul className="divide-y divide-gray-100 text-sm">
          {!audit.length && <li className="py-4 text-center text-gray-500">Chưa có thao tác nào.</li>}
          {audit.map((a, i) => (
            <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2">
              <span className={a.status === 'ok' ? 'text-success-dark' : 'text-gray-500'}>{a.status === 'ok' ? '✓' : '•'}</span>
              <code className="text-xs text-gray-700">{a.toolName ?? a.action}</code>
              <span className="min-w-0 flex-1 truncate text-gray-900">{a.target}</span>
              <span className="text-xs text-gray-400">{new Date(a.createdAt).toLocaleString('vi-VN')}</span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
