import { defineConfig, devices } from '@playwright/test';
import { APP_BASE_PATH, DEV_PORT } from './app.config';

// Set PW_CHROMIUM_PATH to reuse a locally installed Chromium build instead
// of downloading the one bundled with this Playwright version.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;
// PW_PORT runs the suite against another dev server port (e.g. when 5288 is busy).
const port = Number(process.env.PW_PORT ?? DEV_PORT);

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${port}${APP_BASE_PATH}`,
    launchOptions: { executablePath },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, grepInvert: /@mobile/ },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }, grep: /@mobile/ },
  ],
  webServer: {
    command: `npx vite --port ${port} --strictPort`,
    url: `http://localhost:${port}${APP_BASE_PATH}`,
    reuseExistingServer: true,
  },
});
