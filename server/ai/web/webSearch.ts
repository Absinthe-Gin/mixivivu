/**
 * Web search seam. Off unless a backend is configured; the tool that uses
 * it is opt-in per user. Results are labelled as Internet sources so the
 * model and the UI never mix them up with the user's own data.
 *
 * Built-in backend: SearXNG JSON API (self-hostable, no key):
 *   AI_WEB_SEARCH=searxng  AI_SEARXNG_URL=https://searx.example.org
 */
export interface WebResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchProvider {
  readonly name: string;
  search(query: string, limit: number, signal?: AbortSignal): Promise<WebResult[]>;
}

export class SearxngSearch implements WebSearchProvider {
  readonly name = 'searxng';
  private readonly baseUrl: string;
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async search(query: string, limit: number, signal?: AbortSignal): Promise<WebResult[]> {
    const url = `${this.baseUrl}/search?format=json&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`Web search failed: HTTP ${res.status}`);
    const body = (await res.json()) as { results?: { title?: string; url?: string; content?: string }[] };
    return (body.results ?? [])
      .filter((r) => r.url && /^https?:\/\//.test(r.url))
      .slice(0, limit)
      .map((r) => ({ title: (r.title ?? r.url!).slice(0, 200), url: r.url!, snippet: (r.content ?? '').slice(0, 500) }));
  }
}

export function webSearchFromEnv(env = process.env): WebSearchProvider | null {
  if (env.AI_WEB_SEARCH === 'searxng' && env.AI_SEARXNG_URL) return new SearxngSearch(env.AI_SEARXNG_URL);
  return null;
}
