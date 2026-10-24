import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { accountBank, QA_MARKER } from './scripts/qa/accounts.mjs';

// Deliberately separate: public CI must never silently claim authenticated coverage.
const baseURL = process.env.PLAYWRIGHT_BASE_URL;
const storageState = process.env.QA_STORAGE_STATE;
const bankPath = process.env.QA_ACCOUNT_BANK;
if (!baseURL || (!storageState && !bankPath)) throw new Error('Set PLAYWRIGHT_BASE_URL and QA_STORAGE_STATE or QA_ACCOUNT_BANK after pnpm qa:session. See docs/qa-automation.md.');
const url = new URL(baseURL);
if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Expected an HTTP(S) test deployment');
const workers = Number(process.env.QA_AUTH_WORKERS || 2);
if (!Number.isInteger(workers) || workers < 1 || workers > 4) throw new Error('QA_AUTH_WORKERS must be 1 to 4');
const bank = bankPath ? JSON.parse(readFileSync(bankPath, 'utf8')) : null;
if (bank && (bank.marker !== QA_MARKER || !bank.provisionedAt)) throw new Error('Expected a provisioned QA credential bank');
const personas = bank ? accountBank(bank.namespace) : null;
const projects = bank ? personas!.users.map((persona) => {
  const identity = bank.users.find((u: { key: string; id: string }) => u.key === persona.key);
  if (!identity?.id) throw new Error(`Missing provisioned QA identity ${persona.key}`);
  const team = bank.teams.find((t: { key: string }) => t.key === persona.team);
  const visible = personas!.users.filter((target) => target.team === persona.team && persona.team &&
    (target.key === persona.key || target.visibility === 'everyone' || (persona.role === 'lead' && target.visibility === 'lead')))
    .map((target) => bank.users.find((u: { key: string }) => u.key === target.key).id);
  return { name: persona.key, use: { storageState: resolve(dirname(bankPath!), 'auth', `${persona.key}.json`) },
    metadata: { teamId: team?.id, role: persona.role, visibleUserIds: visible } };
}) : [{ name: 'qa-account', use: { storageState } }];

export default defineConfig({
  testDir: './tests/e2e', testMatch: '**/authenticated.spec.ts',
  workers, retries: 0, timeout: 45_000, projects,
  reporter: [['list']], // Authenticated traces/reports can contain private data; keep them off by default.
  use: { ...devices['Desktop Chrome'], baseURL, trace: 'off', screenshot: 'off', video: 'off' },
});
