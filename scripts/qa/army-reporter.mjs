import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function summarizeTests(tests, privateRun = false) {
  const summary = { total: tests.length, passed: 0, failed: 0, flaky: 0, skipped: 0, failures: [] };
  for (const test of tests) {
    const outcome = test.outcome();
    if (outcome === 'skipped') summary.skipped++;
    else if (outcome === 'flaky') summary.flaky++;
    else if (outcome === 'expected' && test.expectedStatus === 'passed') summary.passed++;
    else summary.failed++;
    if (!privateRun && (outcome === 'unexpected' || outcome === 'flaky' || test.expectedStatus === 'failed')) {
      summary.failures.push({ title: test.titlePath().filter(Boolean).join(' › '),
        file: test.location.file, line: test.location.line,
        error: test.results.flatMap((r) => r.errors).map((e) => e.message ?? '').join('\n').slice(0, 4000) });
    }
  }
  return summary;
}

export default class ArmyReporter {
  onBegin(_config, suite) { this.suite = suite; }
  onEnd(result) {
    const output = process.env.QA_ARMY_RESULT_FILE;
    if (!output) throw new Error('QA_ARMY_RESULT_FILE is required');
    const summary = summarizeTests(this.suite.allTests(), process.env.QA_ARMY_PRIVATE === '1');
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, JSON.stringify({ ...summary, status: result.status, duration: result.duration }, null, 2), { mode: 0o600 });
  }
}
