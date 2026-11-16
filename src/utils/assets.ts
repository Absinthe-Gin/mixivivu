import { SITE } from '@/config/site';

const BASE = import.meta.env.BASE_URL;

/** Path to a file in /public, respecting the app base path. */
export const publicAsset = (path: string) => `${BASE}${path.replace(/^\//, '')}`;

/** Absolute URL of a product/blog image. The API stores CDN-relative keys. */
export function cdnImage(path: string | undefined | null): string {
  if (!path) return publicAsset('assets/images/thumb.png');
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:')) return path;
  return SITE.cdnBase + path.split('/').map(encodeURIComponent).join('/');
}

/** Rewrite root-relative asset links found in CMS HTML. */
export const withBasePath = (html: string) => html.replace(/(src|href)="\/assets\//g, `$1="${BASE}assets/`);
