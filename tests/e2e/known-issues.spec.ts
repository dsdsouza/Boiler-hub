import { test, expect } from '@playwright/test';
import { openDemo } from './helpers';

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
