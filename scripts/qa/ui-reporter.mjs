import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export default class UIReporter {
  cases = new Map();
  onBegin(_config, suite) {
    this.directory = resolve(process.env.QA_UI_REPORT_DIR || 'qa-runs/ui-latest');
    mkdirSync(this.directory, { recursive: true });
    for (const test of suite.allTests()) this.cases.set(test.id, { name: test.title, browser: test.parent.project().name, status: 'queued', step: null });
    this.save('running');
  }
  onTestBegin(test) { this.cases.get(test.id).status = 'running'; this.save('running'); }
  onStepBegin(test, _result, step) { if (step.category === 'test.step') this.cases.get(test.id).step = step.title; }
  onTestEnd(test, result) {
    const entry = this.cases.get(test.id);
    entry.status = result.status;
    entry.retries = result.retry || 0;
    const evidence = result.attachments.find(a => a.name === 'ui-inspection')?.body;
    if (evidence) entry.inspection = JSON.parse(evidence.toString());
    this.save('running');
  }
  onEnd(result) {
    const entries = [...this.cases.values()];
    for (const entry of entries) if (['queued', 'running'].includes(entry.status)) entry.status = 'interrupted';
    const good = entries.length > 0 && entries.every(e => e.status === 'passed' && !e.retries);
    this.save(result.status === 'passed' && good ? 'passed' : 'failed');
    if (!good && result.status === 'passed') return { status: 'failed' };
  }
  save(status) {
    const cases = [...this.cases.values()], passed = cases.filter(c => c.status === 'passed').length;
    const report = { status, total: cases.length, passed, failed: cases.length - passed,
      flaky: cases.filter(c => c.retries > 0 && c.status === 'passed').length,
      skipped: cases.filter(c => c.status === 'skipped').length, cases,
      scope: 'Disposable local app: real public pages and signed-in app components backed by synthetic services. Six emulated configurations; no real personal data.',
      limits: 'Checks cover layout, shared field/card tokens, control dimensions, simple text contrast and keyboard focus. Gradients, images, translucent groups and unsupported color paints are counted as unmeasured. Screenshots require human review; this is not a complete accessibility audit or pixel-baseline comparison.' };
    writeFileSync(resolve(this.directory, 'summary.json'), JSON.stringify(report, null, 2));
    writeFileSync(resolve(this.directory, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Boilerplate UI consistency</title><style>body{max-width:1100px;margin:32px auto;padding:0 24px;background:#15120e;color:#f1e7d3;font:16px/1.6 system-ui}a{color:#e3be74}h1{font-size:38px}article{border:1px solid #6b5a44;border-radius:14px;padding:20px;margin:20px 0}img{width:100%;max-height:650px;object-fit:contain;object-position:top;background:#1f1a14}code{overflow-wrap:anywhere}.passed{color:#8ec68d}.failed,.timedOut{color:#ffad93}small{color:#b3a48c}</style><h1>UI consistency checks</h1><p class="${escape(status)}">${escape(status)} · ${passed}/${cases.length} checks passed</p><p>${escape(report.scope)}</p>${cases.map(c => `<article><h2>${escape(c.name)}</h2><p>${escape(c.browser)} · <b class="${escape(c.status)}">${escape(c.status)}</b>${c.status !== 'passed' && c.step ? ' · stopped at ' + escape(c.step) : ''}</p>${c.inspection ? `<p>${c.inspection.inspectedElements} elements · ${c.inspection.inspectedControls} controls inspected. Unmeasured paints: ${escape(JSON.stringify(c.inspection.skipped))}</p>${c.inspection.findings.map(f => `<p><b>${escape(f.rule)}</b><br><code>${escape(f.element)}</code><br>${escape(f.actual)}</p>`).join('')}<details><summary>View captured screen</summary><a href="${escape(c.inspection.screenshot)}"><img loading="lazy" src="${escape(c.inspection.screenshot)}" alt="${escape(c.name + ', ' + c.browser)}"></a></details>` : '<p>No screen evidence (detector self-check or interrupted case).</p>'}</article>`).join('')}<p>${escape(report.limits)}</p><a href="summary.json">Machine-readable results</a></html>`);
  }
}
