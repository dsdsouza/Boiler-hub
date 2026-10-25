import { defineConfig, devices } from '@playwright/test';
const port = Number(process.env.QA_COMPONENT_PORT || 3219);
export default defineConfig({
  testDir: './tests/workflows/local', testMatch: process.env.QA_WORKFLOW_PROBE ? '**/probe.spec.ts' : '**/journeys.spec.ts',
  fullyParallel: true, workers: 4, retries: 0, forbidOnly: true, failOnFlakyTests: true,
  timeout: 180_000, expect: { timeout: 12_000 }, outputDir: '.qa/workflow-artifacts',
  reporter: [['list'], ['./scripts/qa/workflow-reporter.mjs']],
  use: { baseURL: `http://localhost:${port}`, reducedMotion: 'reduce', timezoneId: 'America/New_York',
    actionTimeout: 12_000, navigationTimeout: 30_000, trace: 'off', video: 'off', screenshot: 'off' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: { command: 'node scripts/qa/component-server.mjs', url: `http://localhost:${port}/qa-workflows`,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 }, reuseExistingServer: false, timeout: 120_000 },
});
