import { test, expect } from '@playwright/test';
import { addTask, gauge, noOverflow, openDemo, score } from './helpers';

test.beforeEach(async ({ page }) => { await openDemo(page); });

test('demo loads without browser exceptions and fits the viewport', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.reload();
  await expect(gauge(page)).toBeVisible();
  await noOverflow(page);
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
  await expect(forecast.getByRole('listitem').first()).toContainText(`Today: ${await score(page)},`);
  await addTask(page, 'QA forecast update');
  await expect(forecast.getByRole('listitem').first()).toContainText(`Today: ${await score(page)},`);
});

test('zone filter supports an empty state and switching teams resets it', async ({ page }) => {
  const filters = page.getByRole('group', { name: 'Filter by zone', exact: true });
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

test('Pip accessory is exclusive and hide/show survives a reload', async ({ page }) => {
  const pip = page.getByRole('complementary', { name: 'Pip, your pressure companion', exact: true });
  await pip.getByRole('button', { name: 'Dress up', exact: true }).click();
  await pip.getByRole('radio', { name: 'None', exact: true }).focus();
  await pip.getByRole('radio', { name: 'None', exact: true }).press('ArrowRight');
  await expect(pip.getByRole('radio', { name: 'Top hat', exact: true })).toBeChecked();
  await expect(pip.getByRole('radio', { checked: true })).toHaveCount(1);
  await pip.getByRole('button', { name: 'Done', exact: true }).click();
  await pip.getByRole('button', { name: 'Hide Pip', exact: true }).click();
  await expect(pip).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Show Pip', exact: true }).click();
  await pip.getByRole('button', { name: 'Dress up', exact: true }).click();
  await expect(pip.getByRole('radio', { name: 'Top hat', exact: true })).toBeChecked();
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
