import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { world } from '../workflows/local/world';
import { inspectUI, inspectKeyboardFocus } from './inspect';

async function check(page: Page, info: TestInfo, focusFindings: { rule: string; element: string; actual: string }[] = []) {
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  const report = await inspectUI(page);
  report.findings.push(...focusFindings);
  const directory = resolve(process.env.QA_UI_REPORT_DIR || 'qa-runs/ui-latest');
  await mkdir(directory, { recursive: true });
  const filename = createHash('sha256').update(info.testId + ':' + info.repeatEachIndex).digest('hex').slice(0, 18) + '.png';
  await page.screenshot({ path: resolve(directory, filename), fullPage: true, animations: 'disabled' });
  await info.attach('ui-inspection', { body: Buffer.from(JSON.stringify({ ...report, screenshot: filename })), contentType: 'application/json' });
  expect(report.body.background, 'Shared soot page background').toBe('rgb(21, 18, 14)');
  expect(report.body.font, 'Shared body font').toContain('Inter');
  expect(report.findings, 'Rendered UI inconsistencies; inspect the screenshot and element details in the UI report').toEqual([]);
}

for (const [name, url] of [['Landing', '/'], ['Demo', '/demo'], ['Help', '/how'], ['Calendar helper', '/calendar-helper']]) {
  test(`${name}: layout, control tokens and text contrast`, async ({ page }, info) => {
    await test.step('Load the public screen', async () => {
      // Wider May date labels exposed clipping that October labels did not.
      if (url === '/demo') await page.clock.setFixedTime(new Date('2028-05-21T16:00:00Z'));
      await page.goto(url);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      if (url === '/demo') await expect(page.getByRole('region', { name: 'Tasks', exact: true })).toBeVisible();
    });
    await test.step('Capture and inspect the rendered UI', () => check(page, info));
  });
}

for (const [name, view] of [['Workload', 'boiler'], ['Team forms', 'teams'], ['Sources', 'sources'], ['Onboarding', 'onboarding']]) {
  test(`${name}: signed-in components and keyboard focus`, async ({ page, context }, info) => {
    const service = world(); await service.connect(context);
    await test.step('Load synthetic signed-in components', async () => {
      await page.goto(`/qa-workflows?view=${view}`);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      if (view === 'boiler') await expect(page.getByRole('textbox', { name: 'Status note (shown to your teams)', exact: true })).toBeVisible();
    });
    const focusFindings = await test.step('Check keyboard focus remains visible', () => inspectKeyboardFocus(page));
    await test.step('Capture and inspect the rendered UI', () => check(page, info, focusFindings));
  });
}

test('Long content and validation errors stay inside their panels', async ({ page, context }, info) => {
  const service = world(); await service.connect(context); service.failOnce('POST /api/teams');
  await page.goto('/qa-workflows?view=teams');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('UnbrokenTeam'.repeat(7).slice(0, 80));
  await page.getByRole('button', { name: 'Create team', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'temporarily unavailable' })).toBeVisible();
  await page.getByRole('button', { name: 'Create team', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Created' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Invite code', exact: true }).fill('BAD000');
  await page.getByRole('button', { name: 'Join team', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'No team found' })).toBeVisible();
  await check(page, info);
});

test('Detector catches deliberately injected style drift', async ({ page }) => {
  await page.setContent('<style>body{margin:0;background:#15120e;color:#f1e7d3}.bp-field{height:18px;border-radius:0;font-size:11px;outline:none} .low{color:#25201b} .wide{width:1800px} .bp-card{border-radius:0}</style><main data-qa-app><input class="bp-field" aria-label="Injected field"><p class="low">Unreadable text</p><div class="wide">Overflow</div><section class="bp-card">Wrong corner radius</section><span hidden class="bp-field">Hidden UI is ignored</span></main>');
  const result = await inspectUI(page);
  result.findings.push(...await inspectKeyboardFocus(page));
  for (const rule of ['horizontal-overflow', 'field-radius', 'field-text-size', 'shared-control-height', 'text-contrast', 'card-radius', 'keyboard-focus']) {
    expect(result.findings.some(f => f.rule === rule), `Detector must catch ${rule}`).toBe(true);
  }
  expect(result.findings.some(f => f.element.startsWith('span'))).toBe(false);
  await page.setContent('<style>body{margin:0;background:#15120e;color:#f1e7d3}.bp-field{box-sizing:border-box;height:44px;border-radius:10px;font-size:16px;color:#f1e7d3;background:#18140f}.bp-field:focus-visible{outline:2px solid #e3be74}.group{border:1px solid #6b5a44}.group:focus-within{border-color:#e3be74}.group input{outline:none}.bp-card{border-radius:14px}</style><main data-qa-app><input class="bp-field" aria-label="Repaired field"><div class="group"><input class="bp-field" aria-label="Group focus field"></div><section class="bp-card">Readable text</section></main>');
  expect((await inspectUI(page)).findings).toEqual([]);
  expect(await inspectKeyboardFocus(page)).toEqual([]);
});
