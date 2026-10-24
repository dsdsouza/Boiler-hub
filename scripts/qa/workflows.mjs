import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createQASession } from './session.mjs';
import { accountBank, QA_MARKER } from './accounts.mjs';
import { interruptWorkflows, workflowSummary, renderWorkflows } from './workflow-reporter.mjs';

const argv = process.argv.slice(2);
const accounts = argv.includes('--accounts');
let workers = 4, interrupted = false, target = 'https://boilerhub.work';
const allowed = new Set(['--accounts', '--workers', '--url']);
for (let i = 0; i < argv.length; i++) {
  if (!allowed.has(argv[i])) throw new Error('Use --accounts, --url VERIFIED_ORIGIN and/or --workers 1..16');
  if (argv[i] === '--workers') workers = Number(argv[++i]);
  else if (argv[i] === '--url') target = argv[++i];
}
if (!Number.isInteger(workers) || workers < 1 || workers > 16) throw new Error('Workers must be 1 to 16');
if (!['https://boilerhub.work', 'https://boilerplate.zhomander.workers.dev'].includes(target)) throw new Error('Only verified Boilerplate origins are allowed');
if (argv.includes('--url') && !accounts) throw new Error('Use --accounts with --url to run live workflows');
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 6);
const directory = resolve('qa-runs', 'workflows-' + id); await mkdir(directory, { recursive: true, mode: 0o700 });
const env = { ...process.env, QA_WORKFLOW_RUN_ID: id };
async function run(config, mode) {
  const report = resolve(directory, mode);
  const child = spawn('pnpm', ['exec', 'playwright', 'test', '--config=' + config, '--workers=' + workers, '--retries=0'],
    { stdio: 'inherit', env: { ...env, QA_WORKFLOW_REPORT_DIR: report, QA_WORKFLOW_COVERAGE: mode === 'live'
      ? 'Live signed-in workflows: real browser, application API and persisted data on the verified origin. Synthetic accounts only; each run restores its changes.'
      : 'Local team, workload, feed and subscription workflows: actual application components with resettable simulated services. External Google consent and provider connections are not exercised.' } });
  const forward = (signal) => { interrupted = true; child.kill(signal); };
  const int = () => forward('SIGINT'), term = () => forward('SIGTERM'); process.once('SIGINT', int); process.once('SIGTERM', term);
  const code = await new Promise((done) => { child.on('error', () => done(1)); child.on('exit', code => done(code ?? 1)); });
  process.off('SIGINT', int); process.off('SIGTERM', term);
  let summary = JSON.parse(await readFile(resolve(report, 'summary.json'), 'utf8'));
  if (summary.status === 'running' && code !== 0) {
    summary = { ...summary, ...workflowSummary(interruptWorkflows(summary.cases), 'interrupted') };
    await writeFile(resolve(report, 'summary.json'), JSON.stringify(summary, null, 2), { mode: 0o600 });
    await writeFile(resolve(report, 'index.html'), renderWorkflows(summary), { mode: 0o600 });
  }
  console.log(`\n${mode}: ${summary.passed}/${summary.total} workflows completed. Report: ${resolve(report, 'index.html')}`);
  for (const stopped of summary.stuck) console.log(`Stopped at: ${stopped.step}. Last completed: ${stopped.lastCompleted ?? 'None'}. Cleanup: ${stopped.cleanup}.`);
  return code === 0 && summary.status === 'passed';
}
let good = await run('playwright.workflows.config.ts', 'local');
if (accounts && !interrupted) {
  const bank = JSON.parse(await readFile(resolve('.qa/credentials-regression.json'), 'utf8'));
  if (bank.marker !== QA_MARKER || bank.namespace !== 'regression' || bank.supabaseUrl !== 'https://dtnjfycvhbbhzfkfnfio.supabase.co' || !bank.provisionedAt)
    throw new Error('A provisioned synthetic bank on the verified Supabase project is required');
  for (const persona of accountBank('regression').users) {
    if (!bank.users.some(u => u.key === persona.key && u.email === persona.email && u.id)) throw new Error('Synthetic identity mismatch');
  }
  process.env.PLAYWRIGHT_BASE_URL = env.PLAYWRIGHT_BASE_URL = target;
  process.env.QA_NAMESPACE = env.QA_NAMESPACE = 'regression';
  for (const user of accountBank('regression').users) await createQASession(user.key);
  good = await run('playwright.workflows-live.config.ts', 'live') && good;
}
process.exitCode = interrupted ? 130 : good ? 0 : 1;
