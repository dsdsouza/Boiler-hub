import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { accountBank, QA_MARKER } from './scripts/qa/accounts.mjs';

const baseURL = process.env.PLAYWRIGHT_BASE_URL;
if (!baseURL || !['https://boilerhub.work', 'https://boilerplate.zhomander.workers.dev'].includes(baseURL)) throw new Error('Signed-in exploration requires a verified Boilerplate origin');
const bankPath = resolve(process.env.QA_ACCOUNT_BANK || '.qa/credentials-regression.json');
const bank = JSON.parse(readFileSync(bankPath, 'utf8'));
if (bank.marker !== QA_MARKER || bank.namespace !== 'regression' || bank.supabaseUrl !== 'https://dtnjfycvhbbhzfkfnfio.supabase.co' || !bank.provisionedAt) throw new Error('A provisioned synthetic account bank is required');
const personas = accountBank(bank.namespace);
const engines = [devices['Desktop Chrome'], devices['Desktop Firefox'], devices['Desktop Safari'], devices['Pixel 7']];

export default defineConfig({
  testDir: './tests/signed-exploration', outputDir: '.qa/signed-exploration-artifacts',
  fullyParallel: false, workers: 16, retries: 0, forbidOnly: true, failOnFlakyTests: true,
  timeout: 240_000, expect: { timeout: 15_000 },
  reporter: [['list'], ['./scripts/qa/signed-reporter.mjs']],
  use: { baseURL, timezoneId: 'America/New_York', reducedMotion: 'reduce',
    trace: 'off', screenshot: 'off', video: 'off', actionTimeout: 12_000, navigationTimeout: 30_000 },
  projects: personas.users.map((persona, index) => {
    const identity = bank.users.find((u: { key: string; id: string; email: string }) => u.key === persona.key);
    if (!identity?.id || identity.email !== persona.email) throw new Error('Synthetic identity mismatch');
    const team = personas.teams.find((t) => t.key === persona.team);
    return { name: persona.key, use: { ...engines[index % engines.length],
      storageState: resolve(dirname(bankPath), 'auth', `${persona.key}.json`) },
      metadata: { userId: identity.id, teamId: team?.id, role: persona.role } };
  }),
});
