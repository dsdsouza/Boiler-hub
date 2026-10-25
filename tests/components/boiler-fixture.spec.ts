import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { addTask, gauge, noOverflow, openBoilerFixture, score } from '../e2e/helpers';

test.beforeEach(async ({ page }) => {
  // Compare pressure edits at one instant; real timers still run size debounces.
  await page.clock.setFixedTime(Date.now());
  await openBoilerFixture(page);
});

test('demo loads without browser exceptions and fits the viewport', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.reload();
  await expect(gauge(page)).toBeVisible();
  await noOverflow(page);
  const tasks = page.getByRole('region', { name: 'Tasks', exact: true });
  const size = (await tasks.getByRole('combobox', { name: 'Size', exact: true }).boundingBox())!;
  const due = (await tasks.getByRole('combobox', { name: 'Due', exact: true }).boundingBox())!;
  expect(Math.abs(size.width - due.width)).toBeLessThanOrEqual(1);
  if (Math.abs(size.x - due.x) > 1) expect(Math.abs(size.y - due.y)).toBeLessThanOrEqual(1);
  else expect(due.y).toBeGreaterThanOrEqual(size.y + size.height);
  expect(size.height).toBe(44);
  expect(due.height).toBe(44);
  const labels = await tasks.getByRole('combobox', { name: 'Due', exact: true }).evaluate(async (element) => {
    await document.fonts.ready;
    const select = element as HTMLSelectElement;
    const style = getComputedStyle(select);
    const context = document.createElement('canvas').getContext('2d')!;
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    return {
      widest: Math.max(...Array.from(select.options).map((option) => context.measureText(option.text.trim()).width)),
      available: select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
    };
  });
  expect(labels.widest, 'Every deadline label should fit beside the dropdown arrow').toBeLessThanOrEqual(labels.available + 1);
  expect(errors).toEqual([]);
});

test('add, complete and reopen a task restores its pressure', async ({ page }) => {
  const before = await score(page);
  await addTask(page, 'QA task lifecycle', 'M');
  const added = await score(page);
  expect(added).toBeGreaterThan(before);
  await page.getByRole('button', { name: 'Complete: QA task lifecycle', exact: true }).click();
  expect(await score(page)).toBe(before);
  await page.locator('summary').filter({ hasText: 'Completed or cleared' }).click();
  await page.getByRole('button', { name: 'Mark not done: QA task lifecycle', exact: true }).click();
  expect(await score(page)).toBe(added);
});

test('open task sizes change pressure after the size debounce', async ({ page }) => {
  await addTask(page, 'QA size comparison', 'S');
  const small = await score(page);
  await page.getByRole('combobox', { name: 'Size: QA size comparison', exact: true }).selectOption('L');
  await expect.poll(() => score(page)).toBeGreaterThan(small);
  await page.getByRole('combobox', { name: 'Size: QA size comparison', exact: true }).selectOption('S');
  await expect.poll(() => score(page)).toBe(small);
});

test('whitespace task titles do not create tasks', async ({ page }) => {
  const before = await score(page);
  const tasks = page.getByRole('region', { name: 'Tasks', exact: true });
  const count = await tasks.getByRole('listitem').count();
  await tasks.getByRole('textbox', { name: 'New task' }).fill('   ');
  await tasks.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(tasks.getByRole('listitem')).toHaveCount(count);
  expect(await score(page)).toBe(before);
});

test('task titles render Unicode and markup as literal text', async ({ page }) => {
  const title = 'QA Δ 中文 <img src=x onerror=alert(1)>';
  let dialog = false;
  page.on('dialog', async (event) => { dialog = true; await event.dismiss(); });
  await addTask(page, title);
  await expect(page.getByRole('region', { name: 'Tasks', exact: true })).toContainText(title);
  expect(dialog).toBe(false);
  await noOverflow(page);
});

test('demo changes reset when reloaded', async ({ page }) => {
  const before = await score(page);
  await addTask(page, 'QA transient fixture');
  await page.reload();
  await expect(gauge(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Complete: QA transient fixture', exact: true })).toHaveCount(0);
  expect(await score(page)).toBe(before);
});

test('status and note save without changing pressure', async ({ page }) => {
  const before = await score(page);
  await page.getByRole('button', { name: 'Away', exact: true }).click();
  const note = page.getByRole('textbox', { name: 'Status note (shown to your teams)', exact: true });
  await note.fill('QA status Δ');
  await note.press('Enter');
  await expect(note).toHaveValue('QA status Δ');
  await expect(gauge(page)).toHaveAttribute('aria-label', /Away/);
  expect(await score(page)).toBe(before);
});

test('status note enforces its documented 80-character limit', async ({ page }) => {
  const note = page.getByRole('textbox', { name: 'Status note (shown to your teams)', exact: true });
  await note.fill('x'.repeat(100));
  await expect(note).toHaveValue('x'.repeat(80));
  await note.press('Enter');
  await expect(note).toHaveValue('x'.repeat(80));
});

test('event weights raise pressure and restore the original value', async ({ page }) => {
  const before = await score(page);
  await page.getByRole('region', { name: 'Why is my needle here?', exact: true }).getByRole('button', { name: /^Show all/ }).click();
  const weights = page.getByRole('group', { name: 'Weight for Design review', exact: true });
  await weights.getByRole('button', { name: /^Light/ }).click();
  const light = await score(page);
  expect(light).toBeLessThan(before);
  await weights.getByRole('button', { name: /^Normal/ }).click();
  const normal = await score(page);
  expect(normal).toBeGreaterThan(light);
  await weights.getByRole('button', { name: /^Heavy/ }).click();
  expect(await score(page)).toBe(before);
});

test('forecast has seven days and today agrees with the gauge', async ({ page }) => {
  const forecast = page.getByRole('region', { name: '7-day forecast', exact: true });
  await expect(forecast.getByRole('listitem')).toHaveCount(7);
  await expect(forecast.getByRole('button', { name: /^Today,/ })).toHaveAttribute('aria-label', new RegExp(`score ${await score(page)},`));
  await addTask(page, 'QA forecast update');
  await expect(forecast.getByRole('button', { name: /^Today,/ })).toHaveAttribute('aria-label', new RegExp(`score ${await score(page)},`));
});

test('zone filter supports an empty state and switching teams resets it', async ({ page }) => {
  // A major exam gives this fixture an empty Cool zone even when routine task weights change.
  await page.getByRole('complementary', { name: 'New assignment', exact: true }).getByRole('textbox', { name: 'Title', exact: true }).fill('Final exam QA filter');
  const filters = page.getByRole('group', { name: 'Filter by zone', exact: true });
  await expect(filters.getByRole('button', { name: /^Cool/ })).toHaveText('Cool · 0');
  await filters.getByRole('button', { name: /^Cool/ }).click();
  await expect(page.getByRole('region', { name: 'AP Bio P3 boilers', exact: true })).toContainText('No visible students in this zone.');
  await page.getByRole('button', { name: 'Product Squad', exact: true }).click();
  await expect(filters.getByRole('button', { name: /^All/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: 'Product Squad boilers', exact: true }).getByRole('article')).toHaveCount(6);
});

test('assignment requires a title, previews size and posts with feedback', async ({ page }) => {
  const assignment = page.getByRole('complementary', { name: 'New assignment', exact: true });
  await assignment.getByRole('textbox', { name: 'Title', exact: true }).fill('  ');
  await expect(assignment.getByRole('button', { name: /^Post to / })).toBeDisabled();
  await assignment.getByRole('textbox', { name: 'Title', exact: true }).fill('QA shared assignment');
  const size = assignment.getByRole('group', { name: 'Size', exact: true });
  await size.getByRole('button', { name: 'S · 2', exact: true }).click();
  const small = await assignment.getByRole('status').innerText();
  await size.getByRole('button', { name: 'L · 8', exact: true }).click();
  expect(await assignment.getByRole('status').innerText()).not.toBe(small);
  await assignment.getByRole('button', { name: /^Post to / }).click();
  await expect(assignment.getByRole('status')).toContainText('QA shared assignment');
  await expect(assignment.getByRole('status')).toContainText('Posted');
  await assignment.getByRole('button', { name: 'Draft another', exact: true }).click();
  await expect(assignment.getByRole('textbox', { name: 'Title', exact: true })).toBeEmpty();
  await expect(assignment.getByRole('button', { name: /^Post to / })).toBeDisabled();
});

test('guest demo keeps the boiler gauge but hides Pip and his wardrobe', async ({ page }) => {
  await page.waitForLoadState('networkidle');
  await expect(gauge(page)).toHaveAttribute('aria-label', /^Boiler at pressure /);
  await expect(page.locator('[data-pip-companion]')).toHaveCount(0);
  await expect(page.getByRole('img', { name: /^Pip/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Dress up', exact: true })).toHaveCount(0);
  await noOverflow(page);
});


test('resizing a completed task leaves other assignments at their original pressure', async ({ page }) => {
  const before = await score(page);
  await addTask(page, 'QA completed resize', 'S');
  const small = await score(page);
  await page.getByRole('combobox', { name: 'Size: QA completed resize', exact: true }).selectOption('L');
  await expect.poll(() => score(page)).toBeGreaterThan(small);
  await page.getByRole('button', { name: 'Complete: QA completed resize', exact: true }).click();
  expect(await score(page)).toBe(before);
  await page.locator('summary').filter({ hasText: 'Completed or cleared' }).click();
  await page.getByRole('combobox', { name: 'Size: QA completed resize', exact: true }).selectOption('S');
  await expect.poll(() => score(page)).toBe(before);
  const row = page.getByRole('region', { name: 'Tasks', exact: true }).getByRole('listitem').filter({ has: page.getByRole('button', { name: 'Mark not done: QA completed resize', exact: true }) });
  await expect(row).toContainText('Completed or cleared');
  await expect(row).not.toContainText('−');
  await page.getByRole('button', { name: 'Mark not done: QA completed resize', exact: true }).click();
  await expect.poll(() => score(page)).toBe(small);
});

test('task tabs filter by completion and class with keyboard navigation', async ({ page }) => {
  const tasks = page.getByRole('region', { name: 'Tasks', exact: true });
  const open = tasks.getByRole('tab', { name: /^Open/ });
  const done = tasks.getByRole('tab', { name: /^Done/ });
  await done.click();
  await expect(tasks.getByRole('button', { name: 'Mark not done: Fix signup bug', exact: true })).toBeVisible();
  await expect(tasks.getByRole('button', { name: /^Complete:/ })).toHaveCount(0);
  await done.press('End');
  await expect(tasks.getByRole('tab', { name: /^All/ })).toBeFocused();
  await tasks.getByRole('group', { name: 'Filter by class', exact: true }).getByRole('button', { name: 'Platform', exact: true }).click();
  await expect(tasks.getByRole('button', { name: 'Complete: Review 3 PRs', exact: true })).toBeVisible();
  await expect(tasks.getByRole('button', { name: 'Complete: Q4 roadmap deck', exact: true })).toHaveCount(0);
  await expect(tasks.getByRole('button', { name: 'Mark not done: Fix signup bug', exact: true })).toHaveCount(0);
  await open.click();
  await open.press('ArrowRight');
  await expect(done).toBeFocused();
  await expect(done).toHaveAttribute('aria-selected', 'true');
  await expect(tasks.getByText('No completed or cleared tasks.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(tasks.getByRole('tab', { name: /^Done/ })).toHaveAttribute('aria-selected', 'true');
  await expect(tasks.getByRole('button', { name: 'Mark not done: Fix signup bug', exact: true })).toBeVisible();
});

test('forecast details show the selected day and restore focus when closed', async ({ page }, info) => {
  const forecast = page.getByRole('region', { name: '7-day forecast', exact: true });
  const tomorrow = forecast.getByRole('button').nth(1);
  await tomorrow.click();
  const panel = page.locator('#forecast-day-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Design review');
  await expect(tomorrow).toHaveAttribute('aria-expanded', 'true');
  if (process.env.SOURCES_SCREENSHOTS) {
    await mkdir(process.env.SOURCES_SCREENSHOTS, { recursive: true });
    await page.screenshot({ path: `${process.env.SOURCES_SCREENSHOTS}/forecast-${info.project.name}.png`, fullPage: true, animations: 'disabled' });
    await panel.screenshot({ path: `${process.env.SOURCES_SCREENSHOTS}/forecast-panel-${info.project.name}.png`, animations: 'disabled' });
  }
  if (page.viewportSize()!.width < 640) {
    await expect(panel).toHaveAttribute('role', 'dialog');
    await expect(panel).toHaveAttribute('aria-modal', 'true');
    await panel.getByRole('button', { name: 'Close', exact: true }).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(panel.getByRole('button').last()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(panel.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
  } else await expect(panel).toHaveAttribute('role', 'region');
  await noOverflow(page);
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(tomorrow).toBeFocused();
});

test('completing a forecast contributor updates its day and the main gauge, and undo restores both', async ({ page }) => {
  const forecast = page.getByRole('region', { name: '7-day forecast', exact: true });
  const tomorrow = forecast.getByRole('button').nth(1);
  const forecastScore = async () => Number((await tomorrow.getAttribute('aria-label'))!.match(/score (\d+)/)![1]);
  const beforeDay = await forecastScore();
  const beforeGauge = await score(page);
  await tomorrow.click();
  const panel = page.locator('#forecast-day-panel');
  const causes = panel.getByRole('list', { name: 'Pressure contributors', exact: true });
  // Safari does not consistently focus buttons clicked with a mouse. This
  // assertion covers keyboard focus recovery when the contributor disappears.
  const complete = causes.getByRole('button', { name: 'Complete: Finish onboarding v2 spec', exact: true });
  await complete.focus();
  await complete.press('Space');
  await expect(panel).toBeVisible();
  await expect.poll(forecastScore).toBeLessThan(beforeDay);
  await expect.poll(() => score(page)).toBeLessThan(beforeGauge);
  await expect(causes.getByText('Finish onboarding v2 spec', { exact: true })).toHaveCount(0);
  await expect(panel.getByRole('heading', { level: 3 })).toBeFocused();
  const undo = panel.getByRole('button', { name: 'Undo completion: Finish onboarding v2 spec', exact: true });
  await undo.focus();
  await undo.press('Enter');
  await expect.poll(forecastScore).toBe(beforeDay);
  await expect.poll(() => score(page)).toBe(beforeGauge);
  await expect(causes.getByRole('button', { name: 'Complete: Finish onboarding v2 spec', exact: true })).toBeVisible();
  await expect(panel.getByRole('heading', { level: 3 })).toBeFocused();
});
