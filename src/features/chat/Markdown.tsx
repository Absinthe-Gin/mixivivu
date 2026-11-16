import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * Minimal, safe Markdown for chat replies: paragraphs, "- " lists, **bold**,
 * _italic_ and [links](...). Text is rendered as React nodes (never HTML),
 * internal paths become router links, external links open in a new tab and
 * anything other than http(s) or a site path is shown as plain text.
 */
function inline(text: string, onNavigate?: () => void): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|_(.+?)_/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${m.index}`;
    if (m[1] !== undefined) out.push(<strong key={key}>{inline(m[1], onNavigate)}</strong>);
    else if (m[4] !== undefined) out.push(<em key={key}>{inline(m[4], onNavigate)}</em>);
    else {
      const [label, href] = [m[2], m[3]];
      if (href.startsWith('/') && !href.startsWith('//')) {
        out.push(
          <Link key={key} to={href} onClick={onNavigate} className="font-medium text-primary-dark underline hover:text-primary">
            {label}
          </Link>,
        );
      } else if (/^https?:\/\//.test(href)) {
        out.push(
          <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="text-primary-dark underline">
            {label}
          </a>,
        );
      } else out.push(label);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const LIST_ITEM = /^\s*([-*•]|\d+\.)\s+/;

export function Markdown({ text, onNavigate }: { text: string; onNavigate?: () => void }) {
  // Group consecutive lines into paragraphs and lists; blank lines end a group.
  const groups: { list: boolean; lines: string[] }[] = [];
  for (const line of text.trim().split('\n')) {
    if (!line.trim()) {
      groups.push({ list: false, lines: [] });
      continue;
    }
    const list = LIST_ITEM.test(line);
    const last = groups[groups.length - 1];
    if (last && last.list === list && last.lines.length) last.lines.push(line);
    else groups.push({ list, lines: [line] });
  }
  return (
    <div className="flex flex-col gap-2">
      {groups
        .filter((g) => g.lines.length)
        .map((g, i) =>
          g.list ? (
            <ul key={i} className="flex list-disc flex-col gap-1 pl-5">
              {g.lines.map((l, j) => (
                <li key={j}>{inline(l.replace(LIST_ITEM, ''), onNavigate)}</li>
              ))}
            </ul>
          ) : (
            <p key={i}>
              {g.lines.map((l, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  {inline(l, onNavigate)}
                </Fragment>
              ))}
            </p>
          ),
        )}
    </div>
  );
}
