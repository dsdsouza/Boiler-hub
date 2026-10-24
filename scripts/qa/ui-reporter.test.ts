import { afterEach, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import UIReporter from './ui-reporter.mjs';
import { healthyStats } from './army.mjs';

const directories: string[] = [];
afterEach(() => { vi.unstubAllEnvs(); for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });
function setup() {
  const directory = mkdtempSync(join(tmpdir(), 'ui-report-test-')); directories.push(directory);
  vi.stubEnv('QA_UI_REPORT_DIR', directory);
  const reporter = new UIReporter();
  const test = { id: 'one', title: 'Inspect controls', parent: { project: () => ({ name: 'phone' }) } };
  reporter.onBegin({}, { allTests: () => [test] });
  return { reporter, test, read: () => JSON.parse(readFileSync(join(directory, 'summary.json'), 'utf8')), html: () => readFileSync(join(directory, 'index.html'), 'utf8') };
}

it('a completed UI report satisfies the army gate', () => {
  const { reporter, test, read } = setup();
  reporter.onTestBegin(test);
  reporter.onTestEnd(test, { status: 'passed', retry: 0, attachments: [] });
  reporter.onEnd({ status: 'passed' });
  expect(healthyStats(read())).toBe(true);
});

it.each(['queued', 'running', 'skipped', 'timedOut'])('an unfinished %s screen cannot produce a green report', status => {
  const { reporter, test, read } = setup();
  if (status === 'running') reporter.onTestBegin(test);
  else if (status !== 'queued') reporter.onTestEnd(test, { status, retry: 0, attachments: [] });
  expect(reporter.onEnd({ status: 'passed' })).toEqual({ status: 'failed' });
  expect(healthyStats(read())).toBe(false);
  expect(read()).toMatchObject({ status: 'failed', passed: 0, failed: 1 });
});

it('a retry cannot turn UI drift into a passing army stage', () => {
  const { reporter, test, read } = setup();
  reporter.onTestEnd(test, { status: 'passed', retry: 1, attachments: [] });
  expect(reporter.onEnd({ status: 'passed' })).toEqual({ status: 'failed' });
  expect(read().flaky).toBe(1);
  expect(healthyStats(read())).toBe(false);
});

it('error text and unrelated attachments stay out of the UI report, and labels are escaped', () => {
  const { reporter, test, read, html } = setup();
  reporter.onTestBegin(test);
  reporter.onStepBegin(test, {}, { category: 'test.step', title: '<script>label</script>' });
  reporter.onTestEnd(test, { status: 'failed', retry: 0, errors: [{ message: 'PRIVATE_ERROR_TOKEN' }], attachments: [{ name: 'other', body: Buffer.from('PRIVATE_ATTACHMENT') }] });
  reporter.onEnd({ status: 'failed' });
  expect(JSON.stringify(read()) + html()).not.toMatch(/PRIVATE_ERROR_TOKEN|PRIVATE_ATTACHMENT/);
  expect(html()).toContain('&lt;script&gt;label&lt;/script&gt;');
  expect(html()).not.toContain('<script>');
});
