/**
 * Embedding providers. The default is a local feature-hashing embedder: no
 * network, deterministic, good enough for keyword-ish semantic recall on a
 * few thousand chunks. An Ollama embedding model can be configured with
 * AI_EMBEDDINGS=ollama:<model>. Every chunk stores the `version` it was
 * embedded with; changing the embedder triggers re-indexing.
 */
import { fold, tokenize } from './text.ts';

export interface EmbeddingProvider {
  readonly version: string;
  embed(texts: string[]): Promise<Float32Array[]>;
}

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function normalizeVector(v: Float32Array): Float32Array {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= n;
  return v;
}

export function cosine(a: Float32Array, b: Float32Array): number {
  let s = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) s += a[i] * b[i];
  return s;
}

/** Unigrams, bigrams and character trigrams hashed into a fixed vector (signed hashing). */
export class HashingEmbedder implements EmbeddingProvider {
  readonly dims: number;
  readonly version: string;

  constructor(dims = 512) {
    this.dims = dims;
    this.version = `hash-v1-${dims}`;
  }

  embedOne(text: string): Float32Array {
    const v = new Float32Array(this.dims);
    const tokens = tokenize(text);
    const add = (feature: string, weight: number) => {
      const h = fnv1a(feature);
      v[h % this.dims] += h & 0x80000000 ? -weight : weight;
    };
    tokens.forEach((t, i) => {
      add(`w:${t}`, 1);
      if (i > 0) add(`b:${tokens[i - 1]}_${t}`, 0.7);
    });
    // Character trigrams give some robustness to typos and compound words.
    for (const word of fold(text).split(/[^a-z0-9]+/)) {
      if (word.length < 4) continue;
      for (let i = 0; i + 3 <= word.length; i++) add(`c:${word.slice(i, i + 3)}`, 0.25);
    }
    return normalizeVector(v);
  }

  async embed(texts: string[]): Promise<Float32Array[]> {
    return texts.map((t) => this.embedOne(t));
  }
}

export class OllamaEmbedder implements EmbeddingProvider {
  readonly version: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(model: string, baseUrl = 'http://localhost:11434') {
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.version = `ollama-${model}`;
  }

  async embed(texts: string[]): Promise<Float32Array[]> {
    const out: Float32Array[] = [];
    for (let i = 0; i < texts.length; i += 32) {
      const res = await fetch(`${this.baseUrl}/api/embed`, {
        method: 'POST',
        body: JSON.stringify({ model: this.model, input: texts.slice(i, i + 32) }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(`Ollama embed failed: HTTP ${res.status}`);
      const body = (await res.json()) as { embeddings: number[][] };
      for (const e of body.embeddings) out.push(normalizeVector(Float32Array.from(e)));
    }
    return out;
  }
}

export function embeddingProviderFromEnv(env = process.env): EmbeddingProvider {
  const spec = env.AI_EMBEDDINGS ?? 'hash';
  if (spec.startsWith('ollama:')) return new OllamaEmbedder(spec.slice(7), env.OLLAMA_BASE_URL);
  return new HashingEmbedder();
}

export const toBlob = (v: Float32Array) => new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
export const fromBlob = (b: Uint8Array) => new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
