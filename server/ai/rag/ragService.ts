/**
 * Retrieval over public site content (blogs, help/FAQ/policies) and the
 * user's uploaded documents.
 *
 * Pipeline: chunk → embed (versioned) → store chunks + FTS rows.
 * Search: semantic cosine + FTS5 bm25, fused with reciprocal rank fusion,
 * always filtered to owner_key IN ('public', <current user>).
 */
import { type Db, now, parseJson, transaction } from '../../shared/db.ts';
import { newId, sha256 } from '../../shared/crypto.ts';
import { ApiError } from '../../shared/http.ts';
import { publicCorpus, type CorpusDoc } from '../../catalog.ts';
import { cosine, type EmbeddingProvider, fromBlob, toBlob } from './embeddings.ts';
import { parseDocument } from './parsers.ts';
import { chunkText, tokenize } from './text.ts';

export const PUBLIC_OWNER = 'public';

export interface SearchHit {
  documentId: string;
  title: string;
  link: string | null;
  sourceType: 'blog' | 'help' | 'upload';
  chunkIndex: number;
  content: string;
  score: number;
}

export interface DocumentInfo {
  id: string;
  title: string;
  sourceType: 'blog' | 'help' | 'upload';
  mimeType: string | null;
  sizeBytes: number | null;
  chunkCount: number;
  embeddingVersion: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface DocRow {
  id: string;
  owner_key: string;
  source_type: 'blog' | 'help' | 'upload';
  source_ref: string;
  title: string;
  link: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  content_hash: string;
  embedding_version: string;
  chunk_count: number;
  metadata: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const toInfo = (r: DocRow): DocumentInfo => ({
  id: r.id,
  title: r.title,
  sourceType: r.source_type,
  mimeType: r.mime_type,
  sizeBytes: r.size_bytes,
  chunkCount: r.chunk_count,
  embeddingVersion: r.embedding_version,
  metadata: parseJson(r.metadata, {}),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const MAX_DOCS_PER_USER = 50;

export class RagService {
  private readonly db: Db;
  private readonly embedder: EmbeddingProvider;
  private publicIndexed: Promise<void> | null = null;

  constructor(db: Db, embedder: EmbeddingProvider) {
    this.db = db;
    this.embedder = embedder;
  }

  /** Indexes public content once per process (incremental: unchanged docs are skipped). */
  ensurePublicIndex(): Promise<void> {
    this.publicIndexed ??= this.syncPublic(publicCorpus()).then(
      () => undefined,
      (err) => {
        this.publicIndexed = null;
        throw err;
      },
    );
    return this.publicIndexed;
  }

  async syncPublic(corpus: CorpusDoc[]): Promise<{ indexed: number; removed: number }> {
    let indexed = 0;
    for (const d of corpus) {
      if (await this.upsert(PUBLIC_OWNER, d.sourceType, d.ref, d.title, d.link, d.text, { mimeType: 'text/plain', metadata: d.metadata })) indexed++;
    }
    // Drop public docs that no longer exist in the corpus.
    const refs = new Set(corpus.map((d) => `${d.sourceType}:${d.ref}`));
    const stale = (this.db.prepare('SELECT id, source_type, source_ref FROM ai_documents WHERE owner_key = ? AND deleted_at IS NULL').all(PUBLIC_OWNER) as { id: string; source_type: string; source_ref: string }[]).filter(
      (r) => !refs.has(`${r.source_type}:${r.source_ref}`),
    );
    for (const s of stale) this.purge(s.id);
    return { indexed, removed: stale.length };
  }

  /** Creates or refreshes a document; returns true when (re)indexed. */
  private async upsert(
    owner: string,
    sourceType: DocRow['source_type'],
    ref: string,
    title: string,
    link: string | null,
    text: string,
    extra: { mimeType?: string; sizeBytes?: number; metadata?: Record<string, unknown> } = {},
  ): Promise<string | null> {
    const hash = sha256(text);
    const existing = this.db.prepare('SELECT * FROM ai_documents WHERE owner_key = ? AND source_type = ? AND source_ref = ?').get(owner, sourceType, ref) as DocRow | undefined;
    if (existing && !existing.deleted_at && existing.content_hash === hash && existing.embedding_version === this.embedder.version) return null;

    const chunks = chunkText(text);
    const vectors = await this.embedder.embed(chunks.map((c) => `${title}\n${c}`));
    return transaction(this.db, () => {
      const t = now();
      let id = existing?.id;
      if (id) {
        this.deleteChunks(id);
        this.db
          .prepare('UPDATE ai_documents SET title = ?, link = ?, mime_type = ?, size_bytes = ?, content_hash = ?, embedding_version = ?, chunk_count = ?, metadata = ?, updated_at = ?, deleted_at = NULL WHERE id = ?')
          .run(title, link, extra.mimeType ?? null, extra.sizeBytes ?? null, hash, this.embedder.version, chunks.length, JSON.stringify(extra.metadata ?? {}), t, id);
      } else {
        id = newId();
        this.db
          .prepare(
            `INSERT INTO ai_documents (id, owner_key, source_type, source_ref, title, link, mime_type, size_bytes, content_hash, embedding_version, chunk_count, metadata, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(id, owner, sourceType, ref, title, link, extra.mimeType ?? null, extra.sizeBytes ?? null, hash, this.embedder.version, chunks.length, JSON.stringify(extra.metadata ?? {}), t, t);
      }
      const insertChunk = this.db.prepare('INSERT INTO ai_document_chunks (document_id, owner_key, chunk_index, content, embedding, embedding_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
      const insertFts = this.db.prepare('INSERT INTO ai_chunks_fts (rowid, title, content) VALUES (?, ?, ?)');
      chunks.forEach((c, i) => {
        const r = insertChunk.run(id!, owner, i, c, toBlob(vectors[i]), this.embedder.version, t);
        insertFts.run(Number(r.lastInsertRowid), title, c);
      });
      return id!;
    });
  }

  // ---------- uploads ----------

  async upload(userId: string, filename: string, data: Buffer): Promise<DocumentInfo> {
    const count = (this.db.prepare('SELECT COUNT(*) AS n FROM ai_documents WHERE owner_key = ? AND deleted_at IS NULL').get(userId) as { n: number }).n;
    if (count >= MAX_DOCS_PER_USER) throw new ApiError(400, `Tối đa ${MAX_DOCS_PER_USER} tài liệu; hãy xoá bớt.`, 'limit');
    let parsed;
    try {
      parsed = parseDocument(filename, data);
    } catch (err) {
      throw new ApiError(400, (err as Error).message, 'unsupported_document');
    }
    const title = filename.replace(/[\\/]/g, '_').slice(0, 120);
    // Each upload is its own document (same name uploaded twice = two versions).
    const id = await this.upsert(userId, 'upload', newId(), title, null, parsed.text, { mimeType: parsed.mimeType, sizeBytes: data.length, metadata: parsed.metadata });
    return this.get(userId, id!);
  }

  list(userId: string): DocumentInfo[] {
    return (this.db.prepare("SELECT * FROM ai_documents WHERE owner_key = ? AND source_type = 'upload' AND deleted_at IS NULL ORDER BY created_at DESC").all(userId) as unknown as DocRow[]).map(toInfo);
  }

  /** A user's own upload. Public documents are readable via `read` but not listed/deleted here. */
  get(userId: string, id: string): DocumentInfo {
    const r = this.db.prepare('SELECT * FROM ai_documents WHERE id = ? AND owner_key = ? AND deleted_at IS NULL').get(id, userId) as DocRow | undefined;
    if (!r) throw new ApiError(404, 'Không tìm thấy tài liệu.', 'not_found');
    return toInfo(r);
  }

  /** Removes a document from the index (chunks, FTS rows) and soft-deletes the record. */
  remove(userId: string, id: string): DocumentInfo {
    const doc = this.get(userId, id);
    transaction(this.db, () => {
      this.deleteChunks(id);
      this.db.prepare('UPDATE ai_documents SET deleted_at = ?, chunk_count = 0 WHERE id = ? AND owner_key = ?').run(now(), id, userId);
    });
    return doc;
  }

  /** Full text (joined chunks) of a document the user may read. */
  read(userId: string, id: string, opts: { fromChunk?: number; maxChars?: number } = {}): { document: DocumentInfo & { link: string | null }; text: string; nextChunk: number | null } {
    const r = this.db.prepare('SELECT * FROM ai_documents WHERE id = ? AND owner_key IN (?, ?) AND deleted_at IS NULL').get(id, PUBLIC_OWNER, userId) as DocRow | undefined;
    if (!r) throw new ApiError(404, 'Không tìm thấy tài liệu.', 'not_found');
    const chunks = this.db.prepare('SELECT chunk_index, content FROM ai_document_chunks WHERE document_id = ? AND chunk_index >= ? ORDER BY chunk_index').all(id, opts.fromChunk ?? 0) as { chunk_index: number; content: string }[];
    const max = opts.maxChars ?? 6000;
    let text = '';
    let next: number | null = null;
    for (const c of chunks) {
      if (text && text.length + c.content.length > max) {
        next = c.chunk_index;
        break;
      }
      text += (text ? '\n' : '') + c.content;
    }
    return { document: { ...toInfo(r), link: r.link }, text, nextChunk: next };
  }

  // ---------- search ----------

  async search(userId: string, query: string, opts: { limit?: number; sourceTypes?: ('blog' | 'help' | 'upload')[]; documentIds?: string[] } = {}): Promise<SearchHit[]> {
    await this.ensurePublicIndex();
    const limit = Math.min(opts.limit ?? 5, 10);
    const types = opts.sourceTypes?.length ? opts.sourceTypes : ['blog', 'help', 'upload'];
    const typeSql = types.map(() => '?').join(',');
    const docFilter = opts.documentIds?.length ? ` AND d.id IN (${opts.documentIds.map(() => '?').join(',')})` : '';
    const params = [PUBLIC_OWNER, userId, ...types, ...(opts.documentIds ?? [])];

    const candidates = this.db
      .prepare(
        `SELECT c.id, c.document_id, c.chunk_index, c.content, c.embedding, d.title, d.link, d.source_type
         FROM ai_document_chunks c JOIN ai_documents d ON d.id = c.document_id
         WHERE c.owner_key IN (?, ?) AND d.deleted_at IS NULL AND d.source_type IN (${typeSql})${docFilter}`,
      )
      .all(...params) as { id: number; document_id: string; chunk_index: number; content: string; embedding: Uint8Array; title: string; link: string | null; source_type: SearchHit['sourceType'] }[];
    if (!candidates.length) return [];

    // Semantic ranking.
    const [qv] = await this.embedder.embed([query]);
    const semantic = candidates.map((c) => ({ id: c.id, s: cosine(qv, fromBlob(c.embedding)) })).sort((a, b) => b.s - a.s).slice(0, 50);

    // Keyword ranking (FTS5 bm25) restricted to the same candidate set.
    const allowed = new Set(candidates.map((c) => c.id));
    const terms = [...new Set(tokenize(query))].slice(0, 12);
    let keyword: number[] = [];
    if (terms.length) {
      const match = terms.map((t) => `"${t}"`).join(' OR ');
      keyword = (this.db.prepare('SELECT rowid FROM ai_chunks_fts WHERE ai_chunks_fts MATCH ? ORDER BY bm25(ai_chunks_fts, 2.0, 1.0) LIMIT 200').all(match) as { rowid: number }[])
        .map((r) => r.rowid)
        .filter((id) => allowed.has(id))
        .slice(0, 50);
    }

    // Reciprocal rank fusion.
    const K = 60;
    const fused = new Map<number, number>();
    semantic.forEach((r, i) => fused.set(r.id, (fused.get(r.id) ?? 0) + 1 / (K + i)));
    keyword.forEach((id, i) => fused.set(id, (fused.get(id) ?? 0) + 1 / (K + i)));
    const byId = new Map(candidates.map((c) => [c.id, c]));
    const ranked = [...fused.entries()].sort((a, b) => b[1] - a[1]);

    // At most two chunks per document keeps results diverse.
    const perDoc = new Map<string, number>();
    const hits: SearchHit[] = [];
    for (const [id, score] of ranked) {
      const c = byId.get(id)!;
      const n = perDoc.get(c.document_id) ?? 0;
      if (n >= 2) continue;
      perDoc.set(c.document_id, n + 1);
      hits.push({ documentId: c.document_id, title: c.title, link: c.link, sourceType: c.source_type, chunkIndex: c.chunk_index, content: c.content, score: Number(score.toFixed(4)) });
      if (hits.length >= limit) break;
    }
    return hits;
  }

  /** Re-embeds, in place, every chunk whose embedding version differs from the current embedder. */
  async reindexStale(): Promise<number> {
    const stale = this.db.prepare('SELECT c.id, c.content, d.title FROM ai_document_chunks c JOIN ai_documents d ON d.id = c.document_id WHERE c.embedding_version != ?').all(this.embedder.version) as { id: number; content: string; title: string }[];
    for (let i = 0; i < stale.length; i += 64) {
      const batch = stale.slice(i, i + 64);
      const vectors = await this.embedder.embed(batch.map((c) => `${c.title}
${c.content}`));
      transaction(this.db, () => {
        const upd = this.db.prepare('UPDATE ai_document_chunks SET embedding = ?, embedding_version = ? WHERE id = ?');
        batch.forEach((c, j) => upd.run(toBlob(vectors[j]), this.embedder.version, c.id));
      });
    }
    this.db.prepare('UPDATE ai_documents SET embedding_version = ? WHERE embedding_version != ?').run(this.embedder.version, this.embedder.version);
    return stale.length;
  }

  private deleteChunks(documentId: string) {
    const ids = this.db.prepare('SELECT id FROM ai_document_chunks WHERE document_id = ?').all(documentId) as { id: number }[];
    const del = this.db.prepare('DELETE FROM ai_chunks_fts WHERE rowid = ?');
    for (const { id } of ids) del.run(id);
    this.db.prepare('DELETE FROM ai_document_chunks WHERE document_id = ?').run(documentId);
  }

  private purge(documentId: string) {
    transaction(this.db, () => {
      this.deleteChunks(documentId);
      this.db.prepare('DELETE FROM ai_documents WHERE id = ?').run(documentId);
    });
  }
}
