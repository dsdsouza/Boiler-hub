import { describe, expect, it } from 'vitest';
import { parseOptions, browserArgs, healthyStats, renderReport } from './army.mjs';
import { summarizeTests } from './army-reporter.mjs';

it('defaults to an isolated local run with two workers', () => {
  expect(parseOptions([])).toMatchObject({ workers: 2, repeat: 1, accounts: false, url: null });
});
it('supports explicit parallel repetitions and the trusted live account bank', () => {
  expect(parseOptions(['--workers=8', '--repeat', '3', '--url', 'https://boilerhub.work/', '--accounts']))
    .toMatchObject({ workers: 8, repeat: 3, url: 'https://boilerhub.work', accounts: true });
});
it.each([
  ['--workers', '0'], ['--workers', '17'], ['--workers', 'NaN'], ['--repeat', '0'], ['--repeat', '101'],
  ['--url'], ['--url', 'file:///tmp/test'], ['--url', 'https://user:password@example.com'],
  ['--url', 'https://example.com?key=private'], ['--url', 'https://example.com/path'], ['--unknown'],
  ['--quick=true'], ['--accounts'], ['--accounts', '--url', 'https://other.vercel.app'],
  ['--accounts', '--url', 'https://boilerhub.work', '--ui'],
])('rejects unsafe or invalid options %j', (...argv) => { expect(() => parseOptions(argv)).toThrow(); });
it('runs the requested instances and keeps authenticated evidence private', () => {
  const options = parseOptions(['--workers', '16', '--repeat', '2', '--url', 'https://boilerhub.work', '--accounts']);
  const pub = browserArgs(options, '/tmp/qa-run');
  expect(pub).toContain('--workers=16');
  expect(pub).toContain('--repeat-each=2');
  expect(pub).toContain('--retries=0');
  const auth = browserArgs(options, '/tmp/qa-run', true);
  expect(auth).toContain('--workers=4');
  expect(auth.find((arg: string) => arg.startsWith('--reporter='))).not.toContain('html');
});
it('keeps the interactive dashboard bound to localhost', () => {
  const args = browserArgs(parseOptions(['--ui']), '/tmp/run');
  expect(args).toContain('--ui-host=127.0.0.1');
  expect(args.some((arg: string) => arg.startsWith('--reporter='))).toBe(false);
});
it('selects exploration with a replayable seed and bounded walk sizes', () => {
  const options = parseOptions(['--explore', '--workers=8', '--walks=12', '--steps=100', '--seed=10424']);
  expect(options).toMatchObject({ explore: true, walks: 12, steps: 100, seed: 10424 });
  expect(browserArgs(options, '/tmp/run')).toContain('--config=playwright.explore.config.ts');
  for (const argv of [['--walks=0'], ['--steps=201'], ['--seed=NaN']]) {
    expect(() => parseOptions(argv)).toThrow();
  }
});
it('routes signed-in exploration through the synthetic bank and private reporter', () => {
  const options = parseOptions(['--explore', '--accounts', '--url=https://boilerhub.work', '--workers=16']);
  const args = browserArgs(options, '/tmp/run', true);
  expect(args).toContain('--workers=16');
  expect(args).toContain('--config=playwright.signed-explore.config.ts');
  expect(args).toContain('--reporter=list,./scripts/qa/signed-reporter.mjs');
  expect(args.join(' ')).not.toContain('html');
});

const fake = (outcome: string, expectedStatus = 'passed') => ({ outcome: () => outcome, expectedStatus,
  titlePath: () => ['synthetic test'], location: { file: 'fixture.spec.ts', line: 1 },
  results: [{ errors: [{ message: 'not-for-private-report' }] }] });
describe('honest run outcomes', () => {
  it('does not count flaky, skipped or quarantined cases as passes', () => {
    const result = summarizeTests([fake('expected'), fake('unexpected'), fake('flaky'), fake('skipped'), fake('expected', 'failed')]);
    expect(result).toMatchObject({ total: 5, passed: 1, failed: 2, flaky: 1, skipped: 1 });
    expect(healthyStats(result)).toBe(false);
    expect(healthyStats(summarizeTests([]))).toBe(false);
    expect(healthyStats(summarizeTests([fake('expected')]))).toBe(true);
  });
  it('never copies authenticated failure contents into an artifact', () => {
    const result = summarizeTests([fake('unexpected')], true);
    expect(result.failed).toBe(1);
    expect(result.failures).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('not-for-private-report');
  });
  it('escapes report text from targets and failure messages', () => {
    const report = renderReport({ status: 'failed', workers: 2, repeat: 1, target: '<img onerror=bad>',
      commit: 'fixture', startedAt: 'fixture', error: '<script>bad</script>', quick: false,
      stages: [{ name: 'Browser checks', status: 'failed', stats: { total: 1, passed: 0, failed: 1, failures: [{ title: 'bad <title>', error: '<script>bad</script>' }] } }] });
    expect(report).toContain('&lt;script&gt;');
    expect(report).not.toContain('<script>');
    expect(report).not.toContain('<img onerror');
  });
});
