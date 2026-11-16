import { publicAsset } from '@/utils/assets';

/**
 * Mock API client. Data lives in /public/data as static JSON produced by
 * scripts/build-data.py. Responses are cached per URL for the session.
 */
const cache = new Map<string, Promise<unknown>>();

export class NotFoundError extends Error {
  constructor(resource: string) {
    super(`Không tìm thấy: ${resource}`);
    this.name = 'NotFoundError';
  }
}

export function getJson<T>(path: string): Promise<T> {
  const url = publicAsset(`data/${path}`);
  let request = cache.get(url) as Promise<T> | undefined;
  if (!request) {
    request = fetch(url).then(async (res) => {
      const type = res.headers.get('content-type') ?? '';
      if (res.status === 404 || !type.includes('json')) throw new NotFoundError(path);
      if (!res.ok) throw new Error(`Lỗi tải dữ liệu (${res.status})`);
      return (await res.json()) as T;
    });
    request.catch(() => cache.delete(url));
    cache.set(url, request);
  }
  return request;
}
