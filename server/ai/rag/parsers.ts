/**
 * Document text extraction for uploads. Parsers are looked up by file
 * extension; add a format by registering another parser here.
 *
 * DOCX and XLSX are ZIP archives of XML: a tiny central-directory reader
 * with node:zlib extracts the parts we need, so no dependency is required.
 * PDF is not supported yet (needs a real PDF text extractor).
 */
import { inflateRawSync } from 'node:zlib';

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_CHARS = 400_000;

export interface ParsedDocument {
  text: string;
  mimeType: string;
  metadata?: Record<string, unknown>;
}

type Parser = (data: Buffer) => ParsedDocument;

const decodeUtf8 = (data: Buffer) => {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(data).replace(/^﻿/, '');
  if (/\u0000/.test(text.slice(0, 2000))) throw new Error('Tệp có vẻ là tệp nhị phân, không phải văn bản.');
  return text;
};

const xmlText = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');

/** Reads files from a ZIP archive (stored or deflated entries). */
export function readZip(data: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  let eocd = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65_557); i--) {
    if (data.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Tệp ZIP không hợp lệ.');
  const count = data.readUInt16LE(eocd + 10);
  let p = data.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (data.readUInt32LE(p) !== 0x02014b50) throw new Error('Tệp ZIP bị hỏng.');
    const method = data.readUInt16LE(p + 10);
    const compressed = data.readUInt32LE(p + 20);
    const nameLen = data.readUInt16LE(p + 28);
    const extraLen = data.readUInt16LE(p + 30);
    const commentLen = data.readUInt16LE(p + 32);
    const local = data.readUInt32LE(p + 42);
    const name = data.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    const start = local + 30 + data.readUInt16LE(local + 26) + data.readUInt16LE(local + 28);
    const raw = data.subarray(start, start + compressed);
    if (method === 0) files.set(name, raw);
    else if (method === 8) files.set(name, inflateRawSync(raw, { maxOutputLength: 20 * 1024 * 1024 }));
  }
  return files;
}

function parseDocx(data: Buffer): ParsedDocument {
  const xml = readZip(data).get('word/document.xml')?.toString('utf8');
  if (!xml) throw new Error('Không đọc được nội dung DOCX.');
  const text = xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<\/w:tc>/g, '\t')
    .replace(/<[^>]+>/g, '');
  return { text: xmlText(text), mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
}

function parseXlsx(data: Buffer): ParsedDocument {
  const zip = readZip(data);
  const shared = [...(zip.get('xl/sharedStrings.xml')?.toString('utf8') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    xmlText(m[1].replace(/<rPh[\s\S]*?<\/rPh>/g, '').replace(/<[^>]+>/g, '')),
  );
  const sheets = [...zip.keys()].filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort();
  const lines: string[] = [];
  for (const sheet of sheets) {
    lines.push(`# ${sheet.replace(/^.*\//, '').replace('.xml', '')}`);
    const xml = zip.get(sheet)!.toString('utf8');
    for (const row of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells = [...row[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)].map(([, attrs, inner]) => {
        const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? inner.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? '';
        return /t="s"/.test(attrs) ? (shared[Number(v)] ?? '') : xmlText(v);
      });
      if (cells.some((c) => c.trim())) lines.push(cells.join(' | '));
    }
  }
  return { text: lines.join('\n'), mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', metadata: { sheets: sheets.length } };
}

function parseCsv(data: Buffer): ParsedDocument {
  const text = decodeUtf8(data);
  const rows = text.split(/\r?\n/).filter((l) => l.trim());
  return { text: rows.map((r) => r.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((c) => c.replace(/^"|"$/g, '').trim()).join(' | ')).join('\n'), mimeType: 'text/csv', metadata: { rows: rows.length } };
}

const PARSERS: Record<string, Parser> = {
  txt: (d) => ({ text: decodeUtf8(d), mimeType: 'text/plain' }),
  md: (d) => ({ text: decodeUtf8(d), mimeType: 'text/markdown' }),
  markdown: (d) => ({ text: decodeUtf8(d), mimeType: 'text/markdown' }),
  csv: parseCsv,
  docx: parseDocx,
  xlsx: parseXlsx,
};

export const SUPPORTED_EXTENSIONS = Object.keys(PARSERS);

export function parseDocument(filename: string, data: Buffer): ParsedDocument {
  if (data.length > MAX_UPLOAD_BYTES) throw new Error(`Tệp vượt quá ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  const parser = PARSERS[ext];
  if (!parser) {
    throw new Error(ext === 'pdf' ? 'Chưa hỗ trợ PDF. Hãy tải lên DOCX, TXT, MD, CSV hoặc XLSX.' : `Định dạng .${ext} chưa được hỗ trợ (${SUPPORTED_EXTENSIONS.join(', ')}).`);
  }
  const doc = parser(data);
  const text = doc.text.replace(/\u0000/g, '').trim();
  if (!text) throw new Error('Không tìm thấy nội dung văn bản trong tệp.');
  return { ...doc, text: text.slice(0, MAX_TEXT_CHARS), metadata: { ...doc.metadata, truncated: text.length > MAX_TEXT_CHARS } };
}
