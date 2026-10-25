import { test, expect } from '@playwright/test';
import { noOverflow } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/what-if-preview');
});

test('what-if preview is labeled synthetic, loads without exceptions and fits the viewport', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.reload();
  await expect(page.getByRole('note').first()).toContainText('Synthetic sample data');
  await expect(page.getByRole('heading', { name: 'Seven-day forecast' })).toBeVisible();
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test('size change, deadline move, completion and reset update the comparison', async ({ page }) => {
  const baseline = page.getByRole('region', { name: 'Today’s pressure' });
  const delta = page.getByTestId('score-delta');
  await expect(delta).toHaveText('No hypothetical change yet');

  await page.getByLabel('Task to change (one at a time)').selectOption('syn-t-essay');
  await page.getByText('Change size').click();
  await page.getByText('S · 2 pts').click();
  await expect(delta).toContainText('Down');
  await expect(page.getByTestId('pip-message')).toContainText('Making “Sample writing essay draft” S instead of L');

  await page.getByText('Move deadline').click();
  await page.getByRole('button', { name: 'Move one day earlier' }).click();
  await expect(page.getByTestId('deadline-readout')).toContainText('(-1 days)');
  await expect(delta).toContainText('Up');

  await page.getByText('Mark complete').click();
  await expect(page.getByTestId('pip-message')).toContainText('Marking “Sample writing essay draft” done would lower');
  await expect(page.getByText('Missing coverage')).toBeVisible();

  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(delta).toHaveText('No hypothetical change yet');
  await expect(page.getByTestId('pip-message')).toContainText('This is your baseline');
  await expect(baseline).toBeVisible();
});

test('an imported deadline change is described as hypothetical', async ({ page }) => {
  await page.getByLabel('Task to change (one at a time)').selectOption('syn-t-lab');
  await page.getByText('Move deadline').click();
  await expect(page.getByText('does not change the school’s deadline')).toBeVisible();
});
