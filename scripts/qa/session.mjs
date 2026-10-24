import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServerClient } from '@supabase/ssr';
import { accountBank, QA_MARKER } from './accounts.mjs';

export async function createQASession(key = 'class-lead-01') {
  try { process.loadEnvFile('.env.qa.local'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const namespace = process.env.QA_NAMESPACE || 'regression';
  accountBank(namespace); // Validate before using the namespace in a private file path.
  const bank = JSON.parse(await readFile(resolve(`.qa/credentials-${namespace}.json`), 'utf8'));
  if (bank.marker !== QA_MARKER || bank.namespace !== namespace) throw new Error('Not a Boilerplate QA credential bank');
  const credential = bank.users.find((u) => u.key === key);
  if (!credential?.id) throw new Error('Provision this QA identity before creating a session');
  const anonKey = process.env.QA_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error('QA_SUPABASE_ANON_KEY is required');
  const base = new URL(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3100');
  if (!['http:','https:'].includes(base.protocol)) throw new Error('Base URL must be HTTP or HTTPS');
  const cookies = new Map();
  const client = createServerClient(bank.supabaseUrl, anonKey, { cookies: {
    getAll: () => [...cookies.values()],
    setAll: (values) => values.forEach((c) => cookies.set(c.name, c)),
  } });
  const { data, error } = await client.auth.signInWithPassword({ email: credential.email, password: credential.password });
  if (error || data.user?.id !== credential.id) throw new Error('QA sign-in failed; verify the project and account bank');
  const state = { cookies: [...cookies.values()].map(({ name, value, options = {} }) => ({ name, value,
    domain: base.hostname, path: options.path || '/', expires: options.maxAge ? Math.floor(Date.now()/1000) + options.maxAge : -1,
    httpOnly: Boolean(options.httpOnly), secure: base.protocol === 'https:',
    sameSite: String(options.sameSite || 'lax').replace(/^./, (s) => s.toUpperCase()),
  })), origins: [] };
  const directory = resolve('.qa/auth');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const file = resolve(directory, `${key}.json`);
  await writeFile(file, JSON.stringify(state, null, 2), { mode: 0o600 });
  await chmod(file, 0o600);
  return { file, userId: data.user.id, client };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.includes('--all')) {
      try { process.loadEnvFile('.env.qa.local'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      const bank = accountBank(process.env.QA_NAMESPACE || 'regression');
      for (const user of bank.users) await createQASession(user.key);
      console.log(`Created ${bank.users.length} private QA browser states in .qa/auth. No Google accounts or calendar grants were created.`);
    } else {
      const { file } = await createQASession(process.argv[2]);
      console.log(`Authenticated QA browser state saved privately to ${file}. No Google account or calendar grant was created.`);
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
