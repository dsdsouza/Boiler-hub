import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile, open, unlink } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TRUSTED_ACCOUNT_ORIGIN = 'https://boilerhub.work';
const HELP = `Local QA army — browser instances run on your computer.

pnpm qa:army                            Full local checks and six browser configurations
pnpm qa:army --quick                    Desktop Chromium smoke check
pnpm qa:army --workers 4 --repeat 3      Repeat every browser case three times
pnpm qa:army --url https://boilerhub.work --accounts
pnpm qa:ui                              Interactive browser test dashboard
pnpm qa:explore --workers 8              Discover action sequences and check invariants
pnpm qa:explore --url https://boilerhub.work --accounts --workers 16 --walks 2

Options: --workers 1..16 (default 2), --repeat 1..100 (default 1),
         --quick, --url ORIGIN, --accounts, --ui, --explore,
         --walks 1..100, --steps 1..200, --seed INTEGER, --plan, --help
Reports: qa-runs/<run>/index.html. Account sessions stay private in .qa/.
`;

export function parseOptions(argv) {
  const options = { workers: 2, repeat: 1, quick: false, accounts: false, ui: false, explore: false, walks: 8, steps: 60,
    seed: Date.now() % 2_147_483_647 || 1, plan: false, help: false, url: null };
  const bools = new Set(['quick', 'accounts', 'ui', 'explore', 'plan', 'help']);
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split(/=(.*)/s, 2);
    const key = flag.replace(/^--/, '');
    if (!flag.startsWith('--')) throw new Error('Use named options; see --help.');
    if (bools.has(key)) {
      if (inline !== undefined) throw new Error('Boolean options do not take values.');
      options[key] = true;
    } else if (['workers', 'repeat', 'url', 'walks', 'steps', 'seed'].includes(key)) {
      const value = inline ?? argv[++i];
      if (!value || value.startsWith('--')) throw new Error('A required option value is missing.');
      options[key] = key === 'url' ? value : Number(value);
    } else throw new Error('Unknown option; see --help.');
  }
  if (!Number.isInteger(options.workers) || options.workers < 1 || options.workers > 16) throw new Error('Workers must be 1 to 16.');
  if (!Number.isInteger(options.repeat) || options.repeat < 1 || options.repeat > 100) throw new Error('Repeat must be 1 to 100.');
  for (const [key, max] of [['walks', 100], ['steps', 200], ['seed', 2_147_483_647]]) {
    if (!Number.isInteger(options[key]) || options[key] < 1 || options[key] > max) throw new Error(`Invalid exploration ${key}.`);
  }
  if (options.url) {
    let url;
    try { url = new URL(options.url); } catch { throw new Error('URL must be an HTTP(S) origin.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      throw new Error('URL must be an HTTP(S) origin with no credentials, path, query or fragment.');
    }
    options.url = url.origin;
  }
  if (options.accounts && options.url !== TRUSTED_ACCOUNT_ORIGIN) throw new Error('Account checks require --url https://boilerhub.work so test sessions reach only the verified app.');
  if (options.ui && options.accounts) throw new Error('Use a separate --accounts run; the interactive dashboard covers public/demo tests.');
  return options;
}

export function browserArgs(options, runDir, authenticated = false) {
  const args = ['exec', 'playwright', 'test', `--workers=${authenticated && !options.explore ? Math.min(options.workers, 4) : options.workers}`,
    `--repeat-each=${options.repeat}`, `--global-timeout=${20 * 60_000 * options.repeat}`, '--retries=0', '--fail-on-flaky-tests', '--forbid-only'];
  if (authenticated) args.push(options.explore ? '--config=playwright.signed-explore.config.ts' : '--config=playwright.auth.config.ts',
    `--reporter=list,./scripts/qa/${options.explore ? 'signed-reporter' : 'army-reporter'}.mjs`);
  else {
    if (options.explore) args.push('--config=playwright.explore.config.ts');
    if (!options.ui) args.push('--reporter=list,html,./scripts/qa/army-reporter.mjs');
    args.push(`--output=${resolve(runDir, 'artifacts')}`);
  }
  if (options.quick && !authenticated) args.push('--project=desktop-chromium');
  if (options.ui) args.push('--ui', '--ui-host=127.0.0.1', '--ui-port=0');
  return args;
}

export function healthyStats(stats) {
  return Boolean(stats && stats.total > 0 && stats.passed === stats.total && stats.failed === 0 && stats.flaky === 0 && stats.skipped === 0
    && (!stats.status || stats.status === 'passed'));
}
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function renderReport(run) {
  const mode = run.explore ? `exploration · ${run.walks} walks per browser · ${run.steps} steps · seed ${run.seed}` : run.quick ? 'desktop smoke' : 'full suite';
  const replay = `pnpm ${run.explore ? 'qa:explore' : 'qa:army'} --workers ${run.workers} --repeat ${run.repeat}${run.explore ? ` --walks ${run.walks} --steps ${run.steps} --seed ${run.seed}` : ''}${run.url ? ` --url ${run.url}` : ''}${run.accounts ? ' --accounts' : ''}${run.quick ? ' --quick' : ''}`;
  const stats = run.stages.filter((s) => s.stats).map((s) => `<p><strong>${escape(s.name)}</strong>: ${s.stats.passed}/${s.stats.total} passed · ${s.stats.failed} failed · ${s.stats.flaky ?? 0} flaky · ${s.stats.skipped ?? 0} skipped</p>`).join('');
  const failures = run.stages.flatMap((s) => s.stats?.failures ?? []).map((f) => `<details><summary>${escape(f.title)}</summary><pre>${escape(f.error)}</pre></details>`).join('');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Boilerplate · Local QA army</title><style>body{font:17px/1.55 system-ui;background:#15120e;color:#f5ead7;max-width:1000px;margin:40px auto;padding:0 24px}h1{font-size:42px;line-height:1.1}a{color:#e3ba70}small{color:#c9bca8}table{border-collapse:collapse;width:100%}td{border-bottom:1px solid #514330;padding:12px 8px}pre{white-space:pre-wrap;overflow-wrap:anywhere}.status{font-size:24px;color:${run.status === 'passed' ? '#a7d19d' : '#e3ba70'}}details{margin:16px 0}</style><h1>Local QA army</h1><p class="status">${escape(run.status)}</p>${run.error ? `<p>${escape(run.error)}</p>` : ''}<p>Target: ${escape(run.target)}<br>${run.workers} parallel browser workers · ${run.repeat} repetition(s) · ${escape(mode)}<br><small>Checkout ${escape(run.commit)}${run.dirty ? ' (uncommitted changes)' : ''} · ${escape(run.startedAt)}</small></p>${stats}${run.stages.filter(s => s.workflowReport).map(s => `<p><a href="${escape(s.workflowReport)}">${escape(s.name)}: step-by-step results and stopping points</a></p>`).join('')}<table>${run.stages.map((s) => `<tr><td>${escape(s.name)}</td><td>${escape(s.status)}</td><td>${s.duration ? (s.duration / 1000).toFixed(1) + 's' : ''}</td></tr>`).join('')}</table><p><a href="public/index.html">Browser report, screenshots and traces</a> · <a href="run.json">Run details</a></p>${failures}<p>Repeat locally with <code>${escape(replay)}</code>. Use <code>pnpm qa:ui</code> to select and watch tests interactively.</p><small>Browsers run locally. The default target is a local copy with demo data and an ephemeral test database. Optional account checks use the live app and its existing synthetic identities; credentials and authenticated traces are excluded from reports. These scripted checks can be expanded as new bugs are found.</small></html>`;
}

async function freePort() {
  const server = createServer();
  await new Promise((ok, fail) => server.once('error', fail).listen(0, 'localhost', ok));
  const port = server.address().port;
  await new Promise((ok) => server.close(ok));
  return port;
}
async function acquireLock() {
  const file = resolve(ROOT, '.qa/army.lock');
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const lock = await open(file, 'wx', 0o600);
      await lock.writeFile(String(process.pid));
      return async () => { await lock.close(); await unlink(file); };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const owner = Number(await readFile(file, 'utf8'));
      try { process.kill(owner, 0); } catch (e) {
        if (e.code === 'ESRCH') { await unlink(file); continue; }
        throw e;
      }
      throw new Error('A QA army run is already active. Use its worker setting for parallel instances.');
    }
  }
  throw new Error('Could not acquire the local QA lock.');
}
async function readJSON(file) { try { return JSON.parse(await readFile(file, 'utf8')); } catch { return null; } }

export async function main(argv) {
  const options = parseOptions(argv);
  if (options.help) { console.log(HELP); return 0; }
  if (options.plan) {
    console.log(JSON.stringify({ ...options, target: options.url ?? 'local production build on a free port',
      steps: [...(!options.quick ? ['types', 'lint', 'unit/database'] : []), ...(!options.url ? ['build'] : []), options.explore ? 'exploratory browser walks' : 'public/demo browsers', ...(!options.quick ? ['component failure/race regressions', 'complete local workflows'] : []), ...(options.accounts ? ['private QA sessions', options.explore ? 'signed-in exploration' : '32 test accounts', 'complete live personal workflows'] : [])] }, null, 2));
    return 0;
  }
  const target = options.url ?? `http://localhost:${await freePort()}`;
  const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim().length > 0;
  const release = await acquireLock();
  const runDir = resolve(ROOT, 'qa-runs', new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 6));
  let child, interrupted = false;
  const interrupt = () => {
    interrupted = true;
    if (child?.pid) {
      const pid = child.pid;
      try { process.kill(process.platform === 'win32' ? pid : -pid, 'SIGINT'); } catch {}
      setTimeout(() => { try { process.kill(process.platform === 'win32' ? pid : -pid, 'SIGKILL'); } catch {} }, 8000).unref();
    }
  };
  process.on('SIGINT', interrupt); process.on('SIGTERM', interrupt);
  const run = { ...options, target, commit, dirty,
    startedAt: new Date().toISOString(), status: 'running', stages: [] };
  const save = async () => {
    await mkdir(runDir, { recursive: true, mode: 0o700 });
    await writeFile(resolve(runDir, 'run.json'), JSON.stringify(run, null, 2), { mode: 0o600 });
    await writeFile(resolve(runDir, 'index.html'), renderReport(run), { mode: 0o600 });
  };
  const baseEnv = { ...process.env, PLAYWRIGHT_BASE_URL: options.url ?? '', PLAYWRIGHT_PORT: new URL(run.target).port,
    PLAYWRIGHT_PRODUCTION: '1', PLAYWRIGHT_HTML_OPEN: 'never', PLAYWRIGHT_HTML_OUTPUT_DIR: resolve(runDir, 'public'),
    QA_ARMY_RESULT_FILE: resolve(runDir, 'public-summary.json'), QA_ARMY_PRIVATE: '0', QA_ARMY_UI: options.ui ? '1' : '0',
    QA_EXPLORE_WALKS: String(options.walks), QA_EXPLORE_STEPS: String(options.steps), QA_EXPLORE_SEED: String(options.seed) };
  if (!options.url) {
    baseEnv.NEXT_PUBLIC_SUPABASE_URL = 'https://qa-project.supabase.co';
    baseEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'qa-anon-placeholder';
  }
  async function stage(name, args, extraEnv = {}, privateRun = false) {
    if (interrupted) return false;
    const entry = { name, status: 'running', duration: 0 };
    run.stages.push(entry); await save(); console.log(`\n${name}…`);
    const start = Date.now();
    const log = privateRun ? null : createWriteStream(resolve(runDir, `stage-${run.stages.length}.log`), { mode: 0o600 });
    const code = await new Promise((ok) => {
      child = spawn('pnpm', args, { cwd: ROOT, env: { ...baseEnv, ...extraEnv }, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
      for (const stream of [child.stdout, child.stderr]) stream.on('data', (data) => { process.stdout.write(data); log?.write(data); });
      child.on('error', () => ok(1)); child.on('close', (value) => ok(value ?? 1));
    });
    child = undefined; log?.end();
    entry.status = interrupted ? 'interrupted' : code === 0 ? 'passed' : 'failed';
    entry.duration = Date.now() - start;
    await save(); return entry.status === 'passed';
  }
  try {
    console.log(`Local QA army: ${run.target}\n${options.workers} workers · ${options.repeat} repetition(s)\nReport: ${resolve(runDir, 'index.html')}`);
    await save();
    if (options.accounts) {
      const bank = await readJSON(resolve(ROOT, '.qa/credentials-regression.json'));
      if (bank?.marker !== 'boilerplate-qa-v1' || bank.namespace !== 'regression' || !bank.provisionedAt) throw new Error('The private regression account bank is missing; see docs/qa-automation.md.');
    }
    if (!options.quick) {
      await stage('Type checks', ['typecheck']);
      await stage('Lint', ['lint']);
      await stage('Unit and database tests', ['exec', 'vitest', 'run', '--reporter=json', `--outputFile=${resolve(runDir, 'unit.json')}`]);
      const unit = await readJSON(resolve(runDir, 'unit.json'));
      const entry = run.stages.at(-1);
      entry.stats = { total: unit?.numTotalTests ?? 0, passed: unit?.numPassedTests ?? 0, failed: unit?.numFailedTests ?? 0, skipped: unit?.numPendingTests ?? 0, flaky: 0 };
      if (!healthyStats(entry.stats)) entry.status = 'failed';
    }
    const built = options.url || await stage('Production build', ['build']);
    if (built && !interrupted) {
      await stage(options.explore ? 'Exploratory browser walks' : 'Public and demo browsers', browserArgs(options, runDir));
      const entry = run.stages.at(-1);
      entry.stats = await readJSON(resolve(runDir, 'public-summary.json'));
      if (!healthyStats(entry.stats)) entry.status = 'failed';
    } else run.stages.push({ name: 'Public and demo browsers', status: interrupted ? 'interrupted' : 'blocked' });
    if (!options.quick && !interrupted) {
      await stage('Component failure and race regressions', ['test:components', `--workers=${Math.min(options.workers, 8)}`,
        `--repeat-each=${options.repeat}`, '--retries=0'], { QA_COMPONENT_RESULTS: resolve(runDir, 'component-results.json') });
      const entry = run.stages.at(-1), result = await readJSON(resolve(runDir, 'component-results.json'));
      const stats = result?.stats;
      entry.stats = { total: stats ? stats.expected + stats.unexpected + stats.flaky + stats.skipped : 0,
        passed: stats?.expected ?? 0, failed: stats?.unexpected ?? 0, flaky: stats?.flaky ?? 0, skipped: stats?.skipped ?? 0 };
      if (!healthyStats(entry.stats)) entry.status = 'failed';
    }
    if (!options.quick && !interrupted) {
      await stage('Complete local workflows', ['test:workflows', `--workers=${Math.min(options.workers, 8)}`, `--repeat-each=${options.repeat}`, '--retries=0'],
        { QA_WORKFLOW_REPORT_DIR: resolve(runDir, 'workflows'), QA_WORKFLOW_RUN_ID: runDir.split('/').at(-1) });
      const entry = run.stages.at(-1); entry.stats = await readJSON(resolve(runDir, 'workflows/summary.json'));
      entry.workflowReport = 'workflows/index.html';
      if (!healthyStats(entry.stats)) entry.status = 'failed';
    }
    if (options.accounts && !interrupted) {
      const authEnv = { QA_NAMESPACE: 'regression', QA_ACCOUNT_BANK: resolve(ROOT, '.qa/credentials-regression.json'),
        QA_AUTH_WORKERS: String(Math.min(options.workers, 4)), QA_ARMY_PRIVATE: '1', QA_ARMY_RESULT_FILE: resolve(runDir, 'accounts-summary.json'),
        QA_SIGNED_HISTORY_FILE: resolve(ROOT, '.qa', `signed-history-${runDir.split('/').at(-1)}.json`) };
      if (await stage('Private QA sessions', ['qa:session', '--all'], authEnv, true)) {
        await stage(options.explore ? 'Signed-in exploratory walks' : 'Live test accounts', browserArgs(options, runDir, true), authEnv, true);
        const entry = run.stages.at(-1); entry.stats = await readJSON(resolve(runDir, 'accounts-summary.json'));
        if (!healthyStats(entry.stats)) entry.status = 'failed';
        await stage('Complete live personal workflows', ['test:workflows:live', `--workers=${Math.min(options.workers, 8)}`, '--retries=0'],
          { ...authEnv, QA_WORKFLOW_REPORT_DIR: resolve(runDir, 'signed-workflows'), QA_WORKFLOW_RUN_ID: `live-${runDir.split('/').at(-1)}`,
            QA_WORKFLOW_COVERAGE: 'Live personal workflows through the browser, API and persisted data. Existing synthetic accounts only; mutations restored afterward.' }, true);
        const workflows = run.stages.at(-1); workflows.stats = await readJSON(resolve(runDir, 'signed-workflows/summary.json'));
        workflows.workflowReport = 'signed-workflows/index.html';
        if (!healthyStats(workflows.stats)) workflows.status = 'failed';
      } else run.stages.push({ name: 'Live test accounts', status: 'blocked' });
    }
    run.status = interrupted ? 'interrupted' : run.stages.every((s) => s.status === 'passed') ? 'passed' : 'failed';
    run.finishedAt = new Date().toISOString(); await save();
    console.log(`\nQA army ${run.status}.\nReport: ${resolve(runDir, 'index.html')}`);
    return interrupted ? 130 : run.status === 'passed' ? 0 : 1;
  } catch (error) {
    run.status = interrupted ? 'interrupted' : 'failed';
    run.error = error.message; await save(); throw error;
  } finally {
    process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt); await release();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
