import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '@/components/common/Icon';
import { cx } from '@/utils/cx';
import { MAX_UPLOAD_BYTES, UPLOAD_ACCEPT, assistantApi } from '../services/assistantApi';

interface Props {
  busy: boolean;
  onSend: (text: string, attachments: { id: string; title: string }[]) => Promise<boolean>;
  onStop: () => void;
  compact?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}

/** Message input: auto-growing textarea, Enter to send, attachments, stop button. */
export function Composer({ busy, onSend, onStop, compact, autoFocus, placeholder = 'Hỏi về du thuyền, khách sạn hoặc kế hoạch của bạn…' }: Props) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<{ id: string; title: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || busy || uploading) return;
    const sent = text;
    const files = attachments;
    setText('');
    setAttachments([]);
    if (!(await onSend(sent, files))) {
      setText(sent);
      setAttachments(files);
    }
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError('Tệp tối đa 2 MB.');
      return;
    }
    setUploading(true);
    try {
      const { document } = await assistantApi.uploadDocument(file);
      setAttachments((a) => [...a, { id: document.id, title: document.title }].slice(0, 5));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Tải tệp thất bại.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <form onSubmit={submit} className="w-full">
      <div className={cx('rounded-[24px] border border-gray-200 bg-white shadow-sm transition-shadow focus-within:border-primary focus-within:shadow-[0_0_0_4px_var(--primary-light)]', compact ? 'p-1.5' : 'p-2')}>
        {(!!attachments.length || uploading) && (
          <div className="flex flex-wrap gap-1.5 px-2 pb-1.5 pt-1">
            {attachments.map((a) => (
              <span key={a.id} className="flex items-center gap-1 rounded-full bg-gray-100 py-1 pl-2.5 pr-1 text-xs text-gray-700">
                <Icon name="file" size={12} />
                <span className="max-w-[160px] truncate">{a.title}</span>
                <button type="button" onClick={() => setAttachments((x) => x.filter((y) => y.id !== a.id))} aria-label={`Bỏ ${a.title}`} className="rounded-full p-0.5 hover:bg-gray-200">
                  <Icon name="close" size={12} />
                </button>
              </span>
            ))}
            {uploading && <span className="px-2 py-1 text-xs text-gray-500">Đang tải tệp…</span>}
          </div>
        )}
        <div className="flex items-end gap-1">
          <input ref={fileRef} type="file" accept={UPLOAD_ACCEPT} className="hidden" onChange={(e) => void pickFile(e.target.files?.[0])} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Đính kèm tài liệu" title="Đính kèm tài liệu (TXT, MD, CSV, DOCX, XLSX)" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50">
            <Icon name="paperclip" size={18} />
          </button>
          <textarea
            ref={ref}
            rows={1}
            value={text}
            maxLength={4000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder={placeholder}
            aria-label="Tin nhắn cho trợ lý"
            className="max-h-[200px] min-h-[40px] flex-1 resize-none bg-transparent px-1 py-2 text-[15px] leading-6 text-gray-900 outline-none placeholder:text-gray-400"
          />
          {busy ? (
            <button type="button" onClick={onStop} aria-label="Dừng trả lời" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white hover:bg-gray-700">
              <span className="h-3 w-3 rounded-[3px] bg-white" />
            </button>
          ) : (
            <button type="submit" disabled={!text.trim() || uploading} aria-label="Gửi tin nhắn" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-dark text-white transition-colors hover:bg-gray-900 disabled:bg-gray-200 disabled:text-gray-400">
              <Icon name="arrowRight" size={18} className="-rotate-90" />
            </button>
          )}
        </div>
      </div>
      {uploadError && (
        <p role="alert" className="mt-1.5 px-3 text-xs text-error-dark">
          {uploadError}
        </p>
      )}
    </form>
  );
}
