import { defineConfig, devices } from '@playwright/test';
import { APP_BASE_PATH, DEV_PORT } from './app.config';

// Set PW_CHROMIUM_PATH to reuse a locally installed Chromium build instead
// of downloading the one bundled with this Playwright version.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${DEV_PORT}${APP_BASE_PATH}`,
    launchOptions: { executablePath },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, grepInvert: /@mobile/ },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }, grep: /@mobile/ },
  ],
  webServer: {
    command: `npx vite --port ${DEV_PORT} --strictPort`,
    url: `http://localhost:${DEV_PORT}${APP_BASE_PATH}`,
    reuseExistingServer: true,
  },
});
