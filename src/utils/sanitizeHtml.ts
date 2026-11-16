const ALLOWED = new Set([
  'P', 'DIV', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'A', 'IMG', 'H5', 'H6', 'SPAN', 'MARK',
  'TABLE', 'TBODY', 'THEAD', 'TR', 'TD', 'TH', 'CODE',
]);
const ATTRS: Record<string, string[]> = { A: ['href', 'target'], IMG: ['src', 'alt'] };

/**
 * CMS text comes from a third-party site, so keep only formatting tags and
 * safe attributes before injecting it with dangerouslySetInnerHTML.
 */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement;
  const walk = (el: Element) => {
    for (const child of [...el.children]) {
      if (!ALLOWED.has(child.tagName)) {
        child.replaceWith(...child.childNodes);
        walk(el);
        return;
      }
      for (const attr of [...child.attributes]) {
        const allowed = attr.name === 'class' || (ATTRS[child.tagName] ?? []).includes(attr.name);
        const unsafeUrl = /^(href|src)$/.test(attr.name) && /^\s*javascript:/i.test(attr.value);
        if (!allowed || unsafeUrl) child.removeAttribute(attr.name);
      }
      if (child.tagName === 'A') child.setAttribute('rel', 'noopener noreferrer');
      walk(child);
    }
  };
  walk(root);
  return root.innerHTML;
}
