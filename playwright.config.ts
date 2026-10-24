import { defineConfig, devices } from '@playwright/test';

const external = process.env.PLAYWRIGHT_BASE_URL;
const port = Number(process.env.PLAYWRIGHT_PORT || 3100);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PLAYWRIGHT_PORT must be an integer from 1024 to 65535');
// Next normalizes local middleware redirects to localhost. Use that origin for
// the browser too, so WebKit prefetches do not become cross-origin requests.
const baseURL = external || `http://localhost:${port}`;
const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: '**/authenticated.spec.ts',
  fullyParallel: true,
  forbidOnly: ci,
  failOnFlakyTests: ci,
  retries: ci ? 1 : 0,
  workers: ci ? 2 : 4,
  timeout: 30_000,
  globalTimeout: 20 * 60_000,
  expect: { timeout: 8000 },
  reporter: process.env.QA_ARMY_UI === '1'
    ? [['./scripts/qa/army-reporter.mjs'], ['html', { open: 'never' }]]
    : ci ? [['list'], ['blob']] : [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL,
    timezoneId: 'America/New_York',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'desktop-firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 900 } } },
    { name: 'desktop-webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    { name: 'tablet-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: 'narrow-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 740 } } },
  ],
  webServer: external ? undefined : {
    command: process.env.PLAYWRIGHT_CLOUDFLARE === '1'
      ? `pnpm exec opennextjs-cloudflare preview -- --local --ip 127.0.0.1 --port ${port}`
      : process.env.PLAYWRIGHT_PRODUCTION === '1'
      ? `pnpm start --hostname 127.0.0.1 --port ${port}`
      : `pnpm dev --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qa-project.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'qa-anon-placeholder',
    },
  },
});
