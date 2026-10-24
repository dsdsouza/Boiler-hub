import { test, expect } from '@playwright/test';
import { addTask, openDemo, score } from './helpers';

test.beforeEach(async ({ page }) => { await openDemo(page); });

test('QA-001 personal status propagates to the demo team card', async ({ page }) => {
  await page.getByRole('button', { name: 'Product Squad', exact: true }).click();
  await page.getByRole('button', { name: 'Away', exact: true }).click();
  const note = page.getByRole('textbox', { name: 'Status note (shown to your teams)', exact: true });
  await note.fill('QA team synchronization');
  await note.press('Enter');
  const maya = page.getByRole('region', { name: 'Product Squad boilers', exact: true }).getByRole('article').filter({ has: page.getByRole('heading', { name: 'Maya', exact: true }) });
  await expect(maya).toContainText('QA team synchronization');
  await expect(maya).toContainText('Away');
});

test('QA-002 manual tasks offer an undated option', async ({ page }) => {
  const due = page.getByRole('region', { name: 'Tasks', exact: true }).getByRole('combobox', { name: 'Due', exact: true });
  expect(await due.locator('option').allTextContents()).toContain('No due date');
  const before = await score(page);
  await addTask(page, 'QA undated task', 'L', 'none');
  const row = page.getByRole('listitem').filter({ has: page.getByRole('button', { name: 'Complete: QA undated task', exact: true }) });
  await expect(row).toContainText('No due date');
  expect(await score(page)).toBeGreaterThan(before);
  await row.getByRole('button', { name: 'Complete: QA undated task', exact: true }).click();
  await expect.poll(() => score(page)).toBe(before);
});
