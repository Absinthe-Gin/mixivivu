import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CodeBlock } from './CodeBlock';

/**
 * Safe Markdown for assistant replies, rendered as React nodes (never as
 * HTML): headings, paragraphs, lists, tables, fenced code, quotes, bold,
 * italic, inline code, links, images and citation markers [n].
 * Site paths become router links; only http(s) URLs open externally.
 */
interface Opts {
  onNavigate?: () => void;
  citations?: Set<number>;
}

const safeHref = (href: string) => (href.startsWith('/') && !href.startsWith('//') ? 'internal' : /^https?:\/\//i.test(href) ? 'external' : null);

function inline(text: string, o: Opts, keyBase = ''): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /`([^`]+)`|!\[([^\]]*)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|(?<![\w*])[_*](?!\s)(.+?)(?<!\s)[_*](?![\w*])|\[(\d{1,2})\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyBase}-${m.index}`;
    if (m[1] !== undefined) out.push(<code key={key} className="rounded bg-gray-100 px-1 py-0.5 text-[0.9em] text-gray-800">{m[1]}</code>);
    else if (m[3] !== undefined) {
      const kind = safeHref(m[3]);
      out.push(kind ? <img key={key} src={m[3]} alt={m[2]} loading="lazy" className="my-1 max-h-72 rounded-xl" /> : m[2]);
    } else if (m[4] !== undefined) out.push(<strong key={key} className="font-semibold text-gray-900">{inline(m[4], o, key)}</strong>);
    else if (m[5] !== undefined) {
      const [label, href] = [m[5], m[6]];
      const kind = safeHref(href);
      if (kind === 'internal') {
        out.push(
          <Link key={key} to={href} onClick={o.onNavigate} className="font-medium text-primary-dark underline decoration-primary underline-offset-2 hover:text-primary">
            {label}
          </Link>,
        );
      } else if (kind === 'external') {
        out.push(
          <a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-info-base underline underline-offset-2">
            {label}
          </a>,
        );
      } else out.push(label);
    } else if (m[7] !== undefined) out.push(<em key={key}>{inline(m[7], o, key)}</em>);
    else if (m[8] !== undefined) {
      const n = Number(m[8]);
      out.push(
        o.citations?.has(n) ? (
          <a key={key} href={`#cite-${n}`} className="mx-0.5 inline-flex h-4 min-w-4 -translate-y-1 items-center justify-center rounded bg-primary-light px-1 text-[10px] font-semibold text-primary-dark no-underline" aria-label={`Nguồn ${n}`}>
            {n}
          </a>
        ) : (
          m[0]
        ),
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { t: 'code'; lang: string; text: string }
  | { t: 'heading'; level: number; text: string }
  | { t: 'list'; ordered: boolean; items: string[] }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'quote'; lines: string[] }
  | { t: 'p'; lines: string[] }
  | { t: 'hr' };

const LIST = /^\s*([-*•]|\d+[.)])\s+/;
const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

export function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r/g, '').split('\n');
  const blocks: Block[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*```(\w*)/);
    if (fence) {
      const body: string[] = [];
      while (++i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i]);
      blocks.push({ t: 'code', lang: fence[1], text: body.join('\n') });
      continue;
    }
    if (!line.trim()) continue;
    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) {
      blocks.push({ t: 'heading', level: h[1].length, text: h[2] });
      continue;
    }
    if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
      blocks.push({ t: 'hr' });
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const head = cells(line);
      const rows: string[][] = [];
      i++;
      while (i + 1 < lines.length && lines[i + 1].includes('|') && lines[i + 1].trim()) rows.push(cells(lines[++i]));
      blocks.push({ t: 'table', head, rows });
      continue;
    }
    if (LIST.test(line)) {
      const ordered = /^\s*\d/.test(line);
      const items: string[] = [line.replace(LIST, '')];
      while (i + 1 < lines.length && (LIST.test(lines[i + 1]) || (/^\s{2,}\S/.test(lines[i + 1]) && !LIST.test(lines[i + 1])))) {
        const next = lines[++i];
        if (LIST.test(next)) items.push(next.replace(LIST, ''));
        else items[items.length - 1] += `\n${next.trim()}`;
      }
      blocks.push({ t: 'list', ordered, items });
      continue;
    }
    if (/^>\s?/.test(line)) {
      const q: string[] = [line.replace(/^>\s?/, '')];
      while (i + 1 < lines.length && /^>\s?/.test(lines[i + 1])) q.push(lines[++i].replace(/^>\s?/, ''));
      blocks.push({ t: 'quote', lines: q });
      continue;
    }
    const p: string[] = [line];
    while (i + 1 < lines.length && lines[i + 1].trim() && !/^(\s*```|#{1,4}\s|>\s?)/.test(lines[i + 1]) && !LIST.test(lines[i + 1])) p.push(lines[++i]);
    blocks.push({ t: 'p', lines: p });
  }
  return blocks;
}

const multiline = (text: string, o: Opts, key: string) =>
  text.split('\n').map((l, j) => (
    <Fragment key={j}>
      {j > 0 && <br />}
      {inline(l, o, `${key}-${j}`)}
    </Fragment>
  ));

export function Markdown({ text, onNavigate, citations }: { text: string; onNavigate?: () => void; citations?: number[] }) {
  const o: Opts = { onNavigate, citations: new Set(citations) };
  return (
    <div className="flex min-w-0 flex-col gap-3 break-words">
      {parseBlocks(text).map((b, i) => {
        const key = String(i);
        switch (b.t) {
          case 'code':
            return <CodeBlock key={key} code={b.text} lang={b.lang} />;
          case 'heading':
            return (
              <p key={key} className={b.level <= 2 ? 'text-[17px] font-bold leading-6 text-gray-900' : 'text-[15px] font-semibold leading-6 text-gray-900'}>
                {inline(b.text, o, key)}
              </p>
            );
          case 'hr':
            return <hr key={key} className="border-gray-200" />;
          case 'list': {
            const Tag = b.ordered ? 'ol' : 'ul';
            return (
              <Tag key={key} className={`flex flex-col gap-1.5 pl-5 ${b.ordered ? 'list-decimal' : 'list-disc'} marker:text-gray-400`}>
                {b.items.map((it, j) => (
                  <li key={j} className="pl-0.5">
                    {multiline(it, o, `${key}-${j}`)}
                  </li>
                ))}
              </Tag>
            );
          }
          case 'table':
            return (
              <div key={key} className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full border-collapse text-left text-[13px]">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      {b.head.map((h, j) => (
                        <th key={j} className="whitespace-nowrap border-b border-gray-200 px-3 py-2 font-semibold">
                          {inline(h, o, `${key}-h${j}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j} className="border-b border-gray-100 last:border-0">
                        {r.map((c, k) => (
                          <td key={k} className="px-3 py-2 align-top text-gray-800">
                            {inline(c, o, `${key}-${j}-${k}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'quote':
            return (
              <blockquote key={key} className="border-l-2 border-primary pl-3 text-gray-600">
                {multiline(b.lines.join('\n'), o, key)}
              </blockquote>
            );
          default:
            return <p key={key}>{multiline(b.lines.join('\n'), o, key)}</p>;
        }
      })}
    </div>
  );
}
