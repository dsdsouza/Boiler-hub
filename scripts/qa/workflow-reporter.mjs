import { mkdirSync, writeFileSync, renameSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';

const escape = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function problemKind(error) {
  return /timeout|timed out/i.test(error?.message ?? '') ? 'stuck' : 'failed';
}
export function interruptWorkflows(cases) {
  for (const entry of cases) if (['queued', 'running'].includes(entry.status)) {
    entry.status = 'interrupted';
    for (const step of entry.steps) {
      if (step.status === 'running') step.status = 'stuck';
      if (step.status === 'queued') step.status = 'blocked';
    }
  }
  return cases;
}
export function workflowSummary(cases, status = 'running') {
  const failures = cases.filter((c) => ['failed', 'stuck', 'interrupted', 'incomplete'].includes(c.status));
  return { status, total: cases.length, passed: cases.filter((c) => c.status === 'passed').length,
    failed: failures.length, skipped: cases.filter((c) => c.status === 'skipped').length, flaky: 0,
    stepsPassed: cases.flatMap((c) => c.steps).filter((s) => s.status === 'passed').length,
    stuck: failures.map((c) => ({ workflow: c.name, browser: c.project,
      step: c.steps.find((s) => ['stuck', 'failed', 'running'].includes(s.status))?.name ?? 'Start workflow',
      lastCompleted: c.steps.filter((s) => s.status === 'passed' && s.name !== 'Restore test data').at(-1)?.name ?? null,
      kind: c.status, cleanup: c.steps.find((s) => s.name === 'Restore test data')?.status ?? 'not-run' })), cases };
}
export function renderWorkflows(report) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Boilerplate workflow checks</title><style>body{max-width:1060px;margin:40px auto;padding:0 24px;background:#15120e;color:#f5ead7;font:17px/1.5 system-ui}h1{font-size:38px}a{color:#e3ba70}article{border:1px solid #665334;border-radius:12px;padding:18px;margin:18px 0}li{padding:4px}small{color:#c9bca8}.passed{color:#a7d19d}.stuck,.failed,.interrupted,.incomplete{color:#ffad93}.blocked,.queued{color:#c9bca8}</style><h1>Can a person finish the workflow?</h1><p>${escape(report.coverage)}</p><p><strong>${escape(report.status)}</strong> · ${report.passed}/${report.total} journeys completed · ${report.stepsPassed} steps completed</p>${report.stuck.map((f) => `<article><strong class="${escape(f.kind)}">Stopped: ${escape(f.step)}</strong><p>${escape(f.workflow)} · ${escape(f.browser)}<br>Last completed: ${escape(f.lastCompleted ?? 'None')}<br>Cleanup: ${escape(f.cleanup)}</p></article>`).join('')}${report.cases.map((c) => `<article><strong>${escape(c.name)}</strong> · ${escape(c.project)} · <span class="${escape(c.status)}">${escape(c.status)}</span><ol>${c.steps.map((s) => `<li class="${escape(s.status)}">${escape(s.name)} — ${escape(s.status)}${s.duration !== undefined ? ` (${(s.duration / 1000).toFixed(1)}s)` : ''}</li>`).join('')}</ol></article>`).join('')}<p>Each step has a time limit. A failed journey blocks its remaining goals; cleanup still runs. Pending, interrupted, skipped and incomplete journeys never count as passes.</p><p>Reports contain step names and outcomes. Detailed errors and any signed-in screenshots remain in the private QA folder.</p></html>`;
}

export default class WorkflowReporter {
  cases = new Map();
  errors = [];
  onBegin(_config, suite) {
    this.directory = resolve(process.env.QA_WORKFLOW_REPORT_DIR || 'qa-runs/workflows-latest');
    this.privateDirectory = resolve('.qa/workflow-diagnostics', process.env.QA_WORKFLOW_RUN_ID || 'latest');
    for (const test of suite.allTests()) {
      const plan = JSON.parse(test.annotations.find((a) => a.type === 'workflow-steps')?.description || '[]');
      this.cases.set(test.id, { name: test.title, project: test.parent.project().name, status: 'queued', steps: plan.map((name) => ({ name, status: 'queued' })) });
    }
    this.save();
  }
  onTestBegin(test) { this.cases.get(test.id).status = 'running'; this.save(); }
  onStepBegin(test, _result, step) {
    if (step.category !== 'test.step') return;
    const entry = this.cases.get(test.id)?.steps.find((s) => s.name === step.title);
    if (entry) { entry.status = 'running'; this.save(); }
  }
  onStepEnd(test, _result, step) {
    if (step.category !== 'test.step') return;
    const entry = this.cases.get(test.id)?.steps.find((s) => s.name === step.title);
    if (entry) {
      entry.status = step.error ? problemKind(step.error) : 'passed'; entry.duration = step.duration;
      if (step.error) this.errors.push({ workflow: test.title, project: test.parent.project().name, step: step.title, error: step.error });
      this.save();
    }
  }
  onTestEnd(test, result) {
    const entry = this.cases.get(test.id);
    for (const step of entry.steps) {
      if (step.status === 'running') step.status = result.status === 'timedOut' ? 'stuck' : 'interrupted';
      if (step.status === 'queued') step.status = 'blocked';
    }
    entry.status = result.status === 'passed' && entry.steps.length && entry.steps.every((s) => s.status === 'passed') ? 'passed'
      : result.status === 'passed' ? 'incomplete' : result.status === 'timedOut' || entry.steps.some((s) => s.status === 'stuck') ? 'stuck' : result.status;
    this.errors.push({ workflow: test.title, project: entry.project, errors: result.errors,
      attachments: result.attachments.map((a) => ({ name: a.name, path: a.path })) });
    this.save();
  }
  onError(error) { this.errors.push({ error }); }
  onEnd(result) {
    interruptWorkflows([...this.cases.values()]);
    const healthy = this.cases.size > 0 && [...this.cases.values()].every((c) => c.status === 'passed');
    this.save(result.status === 'passed' && healthy ? 'passed' : result.status === 'passed' ? 'failed' : result.status);
    if (!healthy && result.status === 'passed') return { status: 'failed' };
  }
  save(status = 'running') {
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    mkdirSync(this.privateDirectory, { recursive: true, mode: 0o700 }); chmodSync(resolve('.qa'), 0o700);
    const report = { ...workflowSummary([...this.cases.values()], status), updatedAt: new Date().toISOString(),
      coverage: process.env.QA_WORKFLOW_COVERAGE || 'Local workflows: actual application components with resettable simulated services.' };
    for (const [file, content] of [['summary.json', JSON.stringify(report, null, 2)], ['index.html', renderWorkflows(report)]]) {
      const path = resolve(this.directory, file); writeFileSync(path + '.tmp', content, { mode: 0o600 }); renameSync(path + '.tmp', path);
    }
    writeFileSync(resolve(this.privateDirectory, 'errors.json'), JSON.stringify(this.errors, null, 2), { mode: 0o600 });
  }
}
