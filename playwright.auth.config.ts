import { defineConfig, devices } from '@playwright/test';

// Deliberately separate: public CI must never silently claim authenticated coverage.
const baseURL = process.env.PLAYWRIGHT_BASE_URL;
const storageState = process.env.QA_STORAGE_STATE;
if (!baseURL || !storageState) throw new Error('Set PLAYWRIGHT_BASE_URL and QA_STORAGE_STATE after pnpm qa:session. See docs/qa-automation.md.');
const url = new URL(baseURL);
if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Expected an HTTP(S) test deployment');

export default defineConfig({
  testDir: './tests/e2e', testMatch: '**/authenticated.spec.ts',
  workers: 1, retries: 0, timeout: 45_000,
  reporter: [['list']], // Authenticated traces/reports can contain private data; keep them off by default.
  use: { ...devices['Desktop Chrome'], baseURL, storageState, trace: 'off', screenshot: 'off', video: 'off' },
});
