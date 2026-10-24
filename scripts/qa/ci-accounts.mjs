import { mkdir, writeFile, chmod } from 'node:fs/promises';
import { resolve } from 'node:path';
import { accountBank, QA_MARKER } from './accounts.mjs';

// This workflow uses only ordinary synthetic user credentials, never a Supabase admin key.
try {
  let bank;
  try { bank = JSON.parse(process.env.QA_ACCOUNT_BANK_JSON || ''); }
  catch { throw new Error('QA_ACCOUNT_BANK_JSON is missing or invalid JSON'); }
  if (bank.marker !== QA_MARKER || !bank.provisionedAt) throw new Error('Expected a provisioned QA bank');
  const plan = accountBank(bank.namespace);
  if (bank.supabaseUrl !== process.env.QA_EXPECTED_SUPABASE_URL) throw new Error('QA bank belongs to a different Supabase project');
  if (!Array.isArray(bank.users) || bank.users.length !== plan.users.length || !Array.isArray(bank.teams)) throw new Error('Incomplete QA bank');
  for (const persona of plan.users) {
    const identity = bank.users.find((u) => u.key === persona.key);
    if (!identity?.id || identity.email !== persona.email || typeof identity.password !== 'string' || identity.password.length < 20) throw new Error('Invalid synthetic QA identity');
  }
  for (const team of plan.teams) {
    if (!bank.teams.some((t) => t.key === team.key && t.id === team.id)) throw new Error('Unexpected QA team');
  }
  const directory = resolve('.qa');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const file = resolve(directory, `credentials-${bank.namespace}.json`);
  await writeFile(file, JSON.stringify(bank), { mode: 0o600 });
  await chmod(file, 0o600);
  console.log(`Prepared ${bank.users.length} synthetic identities privately. No accounts were created or changed.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
