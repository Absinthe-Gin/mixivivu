/**
 * Production server: serves dist/ under the app base path and the chat API.
 *   npm run build && npm start
 * Requires Node 22.18+ (runs TypeScript directly, uses node:sqlite).
 * AI providers are configured with environment variables (see .env.example).
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { APP_BASE_PATH } from '../app.config.ts';
import { createApi } from './api.ts';

if (existsSync('.env')) process.loadEnvFile('.env');

const DIST = join(process.cwd(), 'dist');
const PORT = Number(process.env.PORT ?? 5290);
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const api = createApi({ basePath: APP_BASE_PATH });

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname.startsWith(`${APP_BASE_PATH}api/`)) {
    await api.handle(req, res);
    return;
  }
  if (!url.pathname.startsWith(APP_BASE_PATH)) {
    res.writeHead(302, { Location: APP_BASE_PATH });
    res.end();
    return;
  }
  const rel = decodeURIComponent(url.pathname.slice(APP_BASE_PATH.length));
  let file = normalize(join(DIST, rel));
  if (!file.startsWith(DIST + sep) && file !== DIST) {
    res.statusCode = 403;
    res.end();
    return;
  }
  // SPA fallback: unknown non-file paths render index.html; missing data files stay 404.
  if (!existsSync(file) || statSync(file).isDirectory()) {
    if (rel.startsWith('data/') || extname(rel)) {
      res.statusCode = 404;
      res.end();
      return;
    }
    file = join(DIST, 'index.html');
  }
  res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
  createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Mixivivu: http://localhost:${PORT}${APP_BASE_PATH}`));
