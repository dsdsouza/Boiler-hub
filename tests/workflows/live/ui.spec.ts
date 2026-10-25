import { test, expect, type Request } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inspectUI, inspectKeyboardFocus } from '../../ui/inspect';

const screens = [['Personal workload', '/boiler'], ['Calendar', '/calendar'], ['Teams', '/teams'], ['Connect', '/settings/sources']] as const;
const plan = [...screens.map(([name]) => `Inspect ${name} with both system color preferences`), 'Verify all signed-in UI findings'];

test('Signed-in screens remain readable, consistent and keyboard accessible', {
  annotation: { type: 'workflow-steps', description: JSON.stringify(plan) },
}, async ({ page }, info) => {
  const widths = [1280, 768, 320, 390];
  const personaIndex = info.config.projects.findIndex(project => project.name === info.project.name);
  await page.setViewportSize({ width: widths[personaIndex % widths.length], height: 900 });
  const observations: unknown[] = [];
  const findings: unknown[] = [];
  const pending = new Set<Request>();
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) pending.add(request); });
  page.on('requestfinished', request => pending.delete(request));
  page.on('requestfailed', request => pending.delete(request));
  try {
    for (const [name, path] of screens) {
      await test.step(`Inspect ${name} with both system color preferences`, async () => {
        const response = await page.goto(path);
        expect(response?.status()).toBe(200);
        await expect(page).toHaveURL(new RegExp(`${path}$`));
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
        if (path === '/boiler') await expect(page.getByRole('region', { name: 'Tasks', exact: true })).toBeVisible();
        if (path === '/calendar') await expect(page.getByRole('button', { name: 'Next month', exact: true })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        for (const theme of ['dark', 'light'] as const) {
          // The shipped design is dark; both OS preferences must remain usable.
          await page.emulateMedia({ colorScheme: theme });
          await page.bringToFront();
          await expect.poll(() => pending.size, { timeout: 15_000 }).toBe(0);
          if (path === '/calendar') await expect(page.getByText('Loading this month’s deadlines…', { exact: true })).toHaveCount(0);
          await page.mouse.move(0, 0);
          const report = await inspectUI(page);
          await page.locator('main').first().evaluate(el => el.setAttribute('data-qa-app', ''));
          const focus = await inspectKeyboardFocus(page);
          observations.push({ path, theme, ...report, focus });
          findings.push(...[...report.findings, ...focus].map(finding => ({ path, theme, ...finding })));
        }
      });
    }
    await test.step('Verify all signed-in UI findings', async () => expect(findings, 'Inspect the private signed-in UI diagnostic for exact elements and routes').toEqual([]));
  } finally {
    // Authenticated UI evidence remains private; shared workflow reports contain
    // only scenario names, stopping points and counts, never account content.
    const directory = resolve('.qa/live-ui');
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(resolve(directory, `${info.project.name}.json`), JSON.stringify({ observations, findings }, null, 2), { mode: 0o600 });
  }
});
