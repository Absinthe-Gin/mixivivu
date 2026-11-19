# Retrieval (RAG) pipeline

`server/ai/rag/ragService.ts`, tools `search_documents`, `read_document`,
`list_documents`, `delete_document`, and `search_help` (FAQ/policies).

## Sources

| Source | owner_key | Indexed |
|---|---|---|
| Blog articles (`public/data/blogs/*.json`, 131) | `public` | lazily on first search, incremental by content hash |
| Help: site guide, FAQs, policy pages | `public` | same |
| User uploads | user id | on upload |

Public documents that disappear from the corpus are purged on the next
sync.

## Indexing

1. **Parse** (`parsers.ts`): TXT, MD, CSV, DOCX, XLSX (ZIP/XML read with
   `node:zlib`, no dependency). Limit 2 MB per file, 400k characters of
   text, 50 documents per user. PDF is not supported yet; binaries are
   rejected.
2. **Chunk** (`text.ts`): ~900 characters on paragraph/sentence
   boundaries, 150-character overlap.
3. **Embed** (`embeddings.ts`): default `HashingEmbedder` (local feature
   hashing of word unigrams, bigrams and character trigrams, 512 dims,
   diacritics folded; version `hash-v1-512`). Optional
   `AI_EMBEDDINGS=ollama:<model>` uses Ollama `/api/embed`.
4. **Store**: chunk text + Float32 embedding + `embedding_version` in
   `ai_document_chunks`; the same text in the FTS5 table `ai_chunks_fts`
   (`unicode61 remove_diacritics 2`).

Metadata: title, link, MIME type, size, content hash, chunk count, source
metadata (blog date/category, sheet count…).

## Search

1. Candidate chunks: `owner_key IN ('public', <session user>)`, document
   not deleted, optional source types / document ids.
2. Semantic ranking: cosine similarity with the query embedding (top 50).
3. Keyword ranking: FTS5 `MATCH` of the query terms (OR), `bm25` with the
   title weighted ×2, restricted to the candidates (top 50).
4. Reciprocal rank fusion (k = 60), max two chunks per document, top N
   (default 5, max 10).
5. Results go to the model wrapped with a note that retrieved text is
   untrusted data, and are numbered as citations (`Cite as: [1] …`). The UI
   lists sources under the answer, labelled Blog / Hướng dẫn / Tài liệu của
   bạn / Internet.

## Updating and deleting

- Changed content (hash) or embedder (version) → document re-chunked and
  re-embedded; `reindexStale()` re-embeds chunks in place after an
  embedder change.
- Deleting an upload removes its chunks and FTS rows in one transaction and
  soft-deletes the document record.

## Scale

Brute-force cosine over a few thousand chunks takes milliseconds. If the
corpus grows to hundreds of thousands of chunks, move embeddings to a
vector index (e.g. PostgreSQL + pgvector or sqlite-vec) behind the same
`RagService.search` signature.

## Web search

`web_search` is off unless the server has a backend
(`AI_WEB_SEARCH=searxng`, `AI_SEARXNG_URL=…`) and the user enables it in
Settings → Công cụ. Results are labelled as Internet sources. Add another
backend by implementing `WebSearchProvider` in `server/ai/web/webSearch.ts`.
