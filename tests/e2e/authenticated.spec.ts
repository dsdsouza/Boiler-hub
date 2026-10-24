import { expect, test } from '@playwright/test';

test('a provisioned identity can open its own boiler and teams', async ({ page, request }) => {
  const teams = await request.get('/api/teams');
  expect(teams.status()).toBe(200);
  const body = await teams.json();
  expect(Array.isArray(body.teams)).toBe(true);
  await page.goto('/boiler');
  await expect(page.getByRole('region', { name: 'Gauge and status', exact: true }).getByRole('img')).toBeVisible({ timeout: 30_000 });
  await page.goto('/teams');
  await expect(page).toHaveURL(/\/teams$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
