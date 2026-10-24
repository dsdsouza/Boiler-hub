import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.QA_COMPONENT_PORT || 3259);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid UI QA port');
// Only the disposable local app is inspected: screenshots must never contain
// real account data, credentials, or private calendar subscription URLs.
export default defineConfig({
  testDir: './tests/ui', fullyParallel: true, workers: 2, retries: 0,
  forbidOnly: true, failOnFlakyTests: true, timeout: 60_000, expect: { timeout: 12_000 },
  outputDir: '.qa/ui-artifacts',
  reporter: [['list'], ['./scripts/qa/ui-reporter.mjs']],
  use: { baseURL: `http://localhost:${port}`, reducedMotion: 'reduce',
    timezoneId: 'America/New_York', trace: 'off', video: 'off', screenshot: 'off', actionTimeout: 12_000 },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 900 } } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 900 } } },
    { name: 'phone', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: 'narrow', use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 740 } } },
  ],
  webServer: { command: `node scripts/qa/component-server.mjs`, url: `http://localhost:${port}/qa-workflows`,
    env: { QA_COMPONENT_PORT: String(port) }, reuseExistingServer: false, timeout: 120_000 },
});
