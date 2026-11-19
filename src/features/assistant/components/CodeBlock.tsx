import { useState, type ReactNode } from 'react';
import { Icon } from '@/components/common/Icon';

const KEYWORDS = new Set(
  'const let var function return if else for while do switch case break continue new class extends import from export default async await try catch finally throw typeof instanceof in of null undefined true false this super def lambda pass None True False elif with as yield select insert update delete where join on group by order limit create table and or not'.split(' '),
);

/** Tiny tokenizer: comments, strings, numbers and keywords for common languages. */
function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/|--[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][\w]*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(code))) {
    if (m.index > last) out.push(code.slice(last, m.index));
    const [tok] = m;
    if (m[1]) out.push(<span key={k++} className="text-gray-400 italic">{tok}</span>);
    else if (m[2]) out.push(<span key={k++} className="text-[#9be7c4]">{tok}</span>);
    else if (m[3]) out.push(<span key={k++} className="text-[#f5c27a]">{tok}</span>);
    else if (KEYWORDS.has(tok.toLowerCase())) out.push(<span key={k++} className="text-primary">{tok}</span>);
    else out.push(tok);
    last = re.lastIndex;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

export function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; nothing else to do.
    }
  };
  return (
    <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900 text-[13px]">
      <div className="flex items-center justify-between border-b border-gray-800 px-3 py-1.5 text-xs text-gray-400">
        <span>{lang || 'code'}</span>
        <button type="button" onClick={copy} className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-gray-800 hover:text-white" aria-label="Sao chép mã">
          <Icon name={copied ? 'check' : 'copy'} size={14} />
          {copied ? 'Đã chép' : 'Sao chép'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 leading-5 text-gray-100">
        <code>{highlight(code)}</code>
      </pre>
    </div>
  );
}
