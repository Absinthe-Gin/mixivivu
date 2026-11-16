import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { APP_BASE_PATH, DEV_PORT } from './app.config';

// The clone is served under a dedicated base path and port so it never
// collides with other local projects that use Vite's defaults (/, 5173).
export default defineConfig({
  base: APP_BASE_PATH,
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: DEV_PORT, strictPort: true },
  preview: { port: DEV_PORT + 1, strictPort: true },
});
