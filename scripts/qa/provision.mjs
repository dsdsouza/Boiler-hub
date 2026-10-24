import { randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { accountBank, QA_MARKER, uuidFor } from './accounts.mjs';

export async function provision() {
  try { process.loadEnvFile('.env.qa.local'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const namespace = process.env.QA_NAMESPACE || 'regression';
  const bank = accountBank(namespace);
  if (!process.argv.includes('--apply')) {
    console.log(JSON.stringify({ mode: 'plan-only', ...bank }, null, 2));
    return;
  }
  const url = process.env.QA_SUPABASE_URL;
  const key = process.env.QA_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Live provisioning requires QA_SUPABASE_URL and QA_SUPABASE_SERVICE_ROLE_KEY. No accounts were created.');
  const endpoint = new URL(url);
  if (!['https:', 'http:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw new Error('Supabase URL must be HTTP(S) without embedded credentials');
  if (endpoint.protocol !== 'https:' && !['localhost','127.0.0.1'].includes(endpoint.hostname)) throw new Error('Supabase must use HTTPS outside localhost');
  const directory = resolve('.qa');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const file = resolve(directory, `credentials-${namespace}.json`);
  let state;
  try {
    state = JSON.parse(await readFile(file, 'utf8'));
    if (state.marker !== QA_MARKER || state.namespace !== namespace || state.supabaseUrl !== endpoint.origin) throw new Error('Credential file belongs to another QA bank or Supabase project');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    state = { marker: QA_MARKER, namespace, supabaseUrl: endpoint.origin,
      users: bank.users.map((u) => ({ key: u.key, email: u.email, password: randomBytes(32).toString('base64url'), id: null })) };
  }
  const save = async () => {
    await writeFile(file, JSON.stringify(state, null, 2), { mode: 0o600 });
    await chmod(file, 0o600);
  };
  await save(); // Passwords survive a partial API failure; they are never printed.
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const check = (result, operation) => { if (result.error) throw new Error(`${operation}: ${result.error.message}`); return result.data; };
  for (const credential of state.users) {
    const persona = bank.users.find((u) => u.key === credential.key);
    if (!persona) throw new Error('Unexpected account in private QA credential file');
    if (credential.id) {
      const { user } = check(await admin.auth.admin.getUserById(credential.id), 'Read QA user');
      if (user.email !== credential.email || user.app_metadata?.qa_fixture !== QA_MARKER || user.app_metadata?.qa_namespace !== namespace) throw new Error('Refusing to modify a non-QA account');
    } else {
      const { user } = check(await admin.auth.admin.createUser({
        email: credential.email, password: credential.password, email_confirm: true,
        app_metadata: { qa_fixture: QA_MARKER, qa_namespace: namespace },
        user_metadata: { full_name: persona.name },
      }), `Create ${persona.key}`);
      credential.id = user.id;
      await save();
    }
    check(await admin.from('profiles').upsert({ id: credential.id, name: persona.name, status: persona.status, status_note: persona.note }), 'Seed QA profile');
  }
  const idFor = (key) => state.users.find((u) => u.key === key).id;
  for (const team of bank.teams) {
    const lead = bank.users.find((u) => u.team === team.key && u.role === 'lead');
    const existing = check(await admin.from('teams').select('created_by,name').eq('id', team.id).maybeSingle(), 'Check QA team');
    if (existing && (existing.created_by !== idFor(lead.key) || existing.name !== team.name)) throw new Error('Refusing to overwrite a non-QA team');
    check(await admin.from('teams').upsert({ id: team.id, name: team.name, type: team.type, invite_code: team.inviteCode, created_by: idFor(lead.key) }), 'Seed QA team');
    for (const u of bank.users.filter((u) => u.team === team.key)) {
      check(await admin.from('memberships').upsert({ team_id: team.id, user_id: idFor(u.key), role: u.role, visibility: u.visibility }), 'Seed QA membership');
    }
  }
  const now = Date.now();
  for (const u of bank.users) {
    const id = idFor(u.key);
    if (u.hasSnapshot) check(await admin.from('pressure_snapshots').upsert({ user_id: id, score: u.score, raw: u.raw, zone: u.zone,
      counts: { meetings: 0, meetingHours: 0, tasksDue: 3, overdue: 1 }, forecast: [],
      computed_at: new Date(now - u.ageHours * 3600000).toISOString() }), 'Seed synthetic QA snapshot');
    check(await admin.from('tasks').upsert([
      { id: uuidFor(`${namespace}:task:${u.key}:undated`), owner_id: id, title: `QA ${u.key}: undated task`, due_at: null, size: 'S', source: 'manual' },
      { id: uuidFor(`${namespace}:task:${u.key}:tomorrow`), owner_id: id, title: `QA ${u.key}: tomorrow task`, due_at: new Date(now + 86400000).toISOString(), size: 'M', source: 'manual' },
      { id: uuidFor(`${namespace}:task:${u.key}:overdue`), owner_id: id, title: `QA ${u.key}: overdue task`, due_at: new Date(now - 86400000).toISOString(), size: 'L', source: 'manual' },
    ]), 'Seed synthetic QA tasks');
  }
  state.provisionedAt = new Date().toISOString();
  state.teams = bank.teams;
  await save();
  console.log(`Provisioned ${state.users.length} QA users, 2 isolated teams, and 96 synthetic tasks. Private credentials: ${file}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  provision().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
