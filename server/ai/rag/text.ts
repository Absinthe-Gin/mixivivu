/** Text utilities for retrieval: Vietnamese-aware normalisation, tokens, chunking. */

/** Lowercase, strip diacritics (đ → d) so "thuyền" and "thuyen" match. */
export function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

const STOP = new Set([
  'va', 'la', 'cua', 'cho', 'co', 'khong', 'nhung', 'cac', 'mot', 'duoc', 'voi', 'thi', 'o', 'tai', 'den', 'tu', 'nay', 'do', 'de', 'khi', 'nhu', 'ma',
  'cung', 'se', 'da', 'dang', 'rat', 'nhieu', 'trong', 'ra', 'vao', 'len', 'the', 'nao', 'gi', 'toi', 'minh', 'ban', 'em', 'anh', 'chi', 'oi', 'a', 'nhe', 'giup',
  'the', 'and', 'of', 'to', 'in', 'is', 'for', 'on', 'what', 'how', 'me', 'my',
]);

export function tokenize(text: string): string[] {
  return fold(text)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/**
 * Splits text into ~`size`-character chunks on paragraph/sentence
 * boundaries with a small overlap so answers spanning a boundary survive.
 */
export function chunkText(text: string, size = 900, overlap = 150): string[] {
  const clean = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];
  const pieces = clean.split(/(?<=\n)|(?<=[.!?…])\s+/).filter((p) => p.trim());
  const chunks: string[] = [];
  let buf = '';
  for (const piece of pieces) {
    if (buf && buf.length + piece.length > size) {
      chunks.push(buf.trim());
      buf = buf.slice(Math.max(0, buf.length - overlap));
    }
    // Hard-split pieces longer than a chunk (tables, minified text).
    if (piece.length > size) {
      for (let i = 0; i < piece.length; i += size - overlap) chunks.push(piece.slice(i, i + size).trim());
      buf = '';
      continue;
    }
    buf += (buf && !buf.endsWith('\n') ? ' ' : '') + piece;
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks.filter((c) => c.length > 20 || chunks.length === 1);
}
