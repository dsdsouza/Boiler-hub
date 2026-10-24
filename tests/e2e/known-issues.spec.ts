import { test, expect } from '@playwright/test';
import { addTask, openDemo } from './helpers';
import { COMPLETED_RELEASE, SIZE_POINTS } from '../../lib/pressure/config';
import { formatPoints } from '../../components/boiler/format';

test.beforeEach(async ({ page }) => { await openDemo(page); });

test('QA-001 @known-issue personal status propagates to the demo team card', async ({ page }) => {
  await page.getByRole('button', { name: 'Product Squad', exact: true }).click();
  await page.getByRole('button', { name: 'Away', exact: true }).click();
  const note = page.getByRole('textbox', { name: 'Status note (shown to your teams)', exact: true });
  await note.fill('QA team synchronization');
  await note.press('Enter');
  const maya = page.getByRole('region', { name: 'Product Squad boilers', exact: true }).getByRole('article').filter({ has: page.getByRole('heading', { name: 'Maya', exact: true }) });
  await expect(maya).toContainText('QA team synchronization');
  await expect(maya).toContainText('Away');
});

test('QA-002 @known-issue manual tasks offer an undated option', async ({ page }) => {
  const due = page.getByRole('region', { name: 'Tasks', exact: true }).getByRole('combobox', { name: 'Due', exact: true });
  expect(await due.locator('option').allTextContents()).toContain('No due date');
});

test('QA-004 @known-issue resizing a completed demo task recalculates its release', async ({ page }) => {
  await addTask(page, 'QA completed resize', 'L');
  await page.getByRole('button', { name: 'Complete: QA completed resize', exact: true }).click();
  await page.getByRole('combobox', { name: 'Size: QA completed resize', exact: true }).selectOption('S');
  const row = page.getByRole('region', { name: 'Tasks', exact: true }).getByRole('listitem').filter({ has: page.getByRole('button', { name: 'Mark not done: QA completed resize', exact: true }) });
  await expect(row).toContainText(formatPoints(-COMPLETED_RELEASE * SIZE_POINTS.S));
});
