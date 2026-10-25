import { defineConfig, devices } from '@playwright/test';
const port = Number(process.env.QA_COMPONENT_PORT || 3219);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid component QA port');
export default defineConfig({
  testDir: './tests/components', fullyParallel: true, workers: 4, retries: 0,
  forbidOnly: true, failOnFlakyTests: true, timeout: 45_000, expect: { timeout: 10_000 },
  outputDir: '.qa/component-artifacts',
  reporter: [['list'], ['json', { outputFile: process.env.QA_COMPONENT_RESULTS || '.qa/component-results.json' }]],
  use: { baseURL: `http://localhost:${port}`, reducedMotion: 'reduce', trace: 'off', video: 'off', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', grepInvert: /@chromium-touch/, use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', grepInvert: /@chromium-touch/, use: { ...devices['Desktop Safari'] } },
    { name: 'narrow', use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 740 } } },
  ],
  webServer: { command: 'node scripts/qa/component-server.mjs', url: `http://localhost:${port}/qa-components`,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    reuseExistingServer: false, timeout: 120_000 },
});
