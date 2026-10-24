import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testDir: './tests/exploration',
  testIgnore: [],
  timeout: 180_000,
  use: { ...base.use, video: 'off', actionTimeout: 8000, navigationTimeout: 15_000 },
  projects: base.projects!.filter((p) => ['desktop-chromium', 'desktop-firefox', 'desktop-webkit', 'mobile-chromium'].includes(p.name!)),
});
