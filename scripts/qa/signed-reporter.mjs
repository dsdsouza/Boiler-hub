import { mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import { summarizeTests } from './army-reporter.mjs';

export default class SignedReporter {
  walks = [];
  onBegin(_config, suite) { this.suite = suite; }
  onTestEnd(test, result) {
    for (const a of result.attachments) if (a.name === 'signed-exploration.json' && a.body) {
      this.walks.push({ persona: test.parent.project().name, ...JSON.parse(a.body.toString()) });
    }
  }
  onEnd(result) {
    const directory = resolve('.qa');
    mkdirSync(directory, { recursive: true, mode: 0o700 }); chmodSync(directory, 0o700);
    const output = process.env.QA_ARMY_RESULT_FILE;
    if (!output) throw new Error('QA_ARMY_RESULT_FILE is required');
    const history = resolve(process.env.QA_SIGNED_HISTORY_FILE || '.qa/signed-exploration-history.json');
    if (!history.startsWith(directory + '/')) throw new Error('Signed-in histories must stay in the private QA directory');
    writeFileSync(history, JSON.stringify(this.walks, null, 2), { mode: 0o600 }); chmodSync(history, 0o600);
    // Public summaries intentionally exclude authenticated errors and attachments.
    writeFileSync(output, JSON.stringify({ ...summarizeTests(this.suite.allTests(), true), status: result.status, duration: result.duration,
      walks: this.walks.length, actions: this.walks.reduce((n, w) => n + w.steps, 0), findings: this.walks.reduce((n, w) => n + w.findings.length, 0) }, null, 2), { mode: 0o600 });
  }
}
