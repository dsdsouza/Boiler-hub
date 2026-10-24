import { expect, test } from '@playwright/test';

test('a provisioned identity can open its boiler, teams and permitted team members', async ({ page, request }, testInfo) => {
  const teams = await request.get('/api/teams');
  expect(teams.status()).toBe(200);
  const body = await teams.json();
  expect(Array.isArray(body.teams)).toBe(true);
  const { teamId, visibleUserIds } = testInfo.project.metadata;
  if (teamId) {
    expect(body.teams.map((team: { id: string }) => team.id)).toEqual([teamId]);
    const engine = await request.get(`/api/teams/${teamId}/engine-room`);
    expect(engine.status()).toBe(200);
    const room = await engine.json();
    expect(room.boilers.map((member: { userId: string }) => member.userId).sort()).toEqual([...visibleUserIds].sort());
  } else if (visibleUserIds) expect(body.teams).toEqual([]);
  await page.goto('/boiler');
  await expect(page.getByRole('region', { name: 'Gauge and status', exact: true }).getByRole('img')).toBeVisible({ timeout: 30_000 });
  await page.goto('/teams');
  await expect(page).toHaveURL(/\/teams$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('QA-003 live aggregate counts respect the caller’s role and anonymity threshold', async ({ request }, testInfo) => {
  const { teamId, hiddenCount } = testInfo.project.metadata;
  const teams = await request.get('/api/teams');
  expect(teams.status()).toBe(200);
  const listed = (await teams.json()).teams;
  if (!teamId) {
    // A single supplied storage state may belong to any role or team.
    for (const team of listed) {
      expect(team.role === 'lead' ? team.hiddenCount === 0 || team.hiddenCount >= 2 : team.hiddenCount === 0).toBe(true);
    }
    return;
  }
  const response = await request.get(`/api/teams/${teamId}/engine-room`);
  expect(response.status()).toBe(200);
  const team = listed.find((entry: { id: string }) => entry.id === teamId);
  expect([(await response.json()).hiddenCount, team.hiddenCount]).toEqual([hiddenCount, hiddenCount]);
});

const subscriptionEndpoint = '**/api/calendar/subscription';
const testFeed = `/api/calendar/feed/${'a'.repeat(64)}.ics`;

test('subscription privacy is confirmed before a link is created', async ({ page }) => {
  let writes = 0;
  await page.route(subscriptionEndpoint, async (route) => {
    if (route.request().method() !== 'GET') writes++;
    await route.fulfill({ json: { feedPath: null } });
  });
  await page.goto('/settings/sources');
  const subscribe = page.getByRole('button', { name: 'Subscribe in Apple Calendar', exact: true });
  const warning = page.getByText('Anyone with this private link can read these deadlines.', { exact: false });
  await expect(subscribe).toBeEnabled();
  await expect(warning).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Copy subscription link' })).toHaveCount(0);
  await subscribe.click();
  const confirmation = page.getByRole('group', { name: 'Subscribe to your deadlines?', exact: true });
  await expect(confirmation).toBeVisible();
  await expect(warning).toBeVisible();
  await expect(confirmation.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  expect(writes).toBe(0);
  await page.keyboard.press('Escape');
  await expect(confirmation).toHaveCount(0);
  await expect(subscribe).toBeFocused();
  await subscribe.click();
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(warning).toHaveCount(0);
  await expect(subscribe).toBeFocused();
  expect(writes).toBe(0);
});

test('disabling a subscription supports cancellation, failure and a confirmed retry', async ({ page }) => {
  let deletes = 0;
  let feedPath: string | null = testFeed;
  await page.route(subscriptionEndpoint, async (route) => {
    if (route.request().method() === 'DELETE') {
      deletes++;
      if (deletes === 1) return route.fulfill({ status: 503, json: { error: 'Subscription unavailable. Try again.' } });
      feedPath = null;
    }
    await route.fulfill({ json: { feedPath } });
  });
  await page.goto('/settings/sources');
  const disable = page.getByRole('button', { name: 'Disable subscription', exact: true });
  const link = page.getByLabel('Private calendar URL', { exact: true });
  await expect(disable).toBeEnabled();
  await expect(link).toHaveValue(new RegExp('/api/calendar/feed/'));
  await expect(page.getByText('Anyone with this private link', { exact: false })).toHaveCount(0);
  await disable.click();
  const confirmation = page.getByRole('group', { name: 'Disable this subscription?', exact: true });
  await expect(confirmation).toBeVisible();
  expect(deletes).toBe(0);
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(disable).toBeFocused();
  await expect(link).toBeVisible();
  expect(deletes).toBe(0);
  await disable.click();
  await confirmation.getByRole('button', { name: 'Confirm disabling', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Subscription unavailable. Try again.' })).toBeVisible();
  await expect(link).toBeVisible();
  await expect(confirmation).toBeVisible();
  expect(deletes).toBe(1);
  await confirmation.getByRole('button', { name: 'Confirm disabling', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Subscribe in Apple Calendar', exact: true })).toBeFocused();
  await expect(link).toHaveCount(0);
  await expect(confirmation).toHaveCount(0);
  expect(deletes).toBe(2);
});

test('a confirmed subscription recovers from a failed request without creating extra links', async ({ page }) => {
  let posts = 0;
  await page.route(subscriptionEndpoint, async (route) => {
    if (route.request().method() === 'POST') {
      posts++;
      if (posts === 1) return route.fulfill({ status: 503, json: { error: 'Could not prepare subscription. Try again.' } });
      return route.fulfill({ status: 201, json: { feedPath: testFeed } });
    }
    await route.fulfill({ json: { feedPath: null } });
  });
  await page.goto('/settings/sources');
  await page.getByRole('button', { name: 'Subscribe in Apple Calendar', exact: true }).click();
  const confirm = page.getByRole('button', { name: 'Confirm subscription', exact: true });
  expect(posts).toBe(0);
  await confirm.click();
  await expect(page.getByRole('alert').filter({ hasText: 'Could not prepare subscription. Try again.' })).toBeVisible();
  await expect(confirm).toBeEnabled();
  expect(posts).toBe(1);
  await confirm.click();
  await expect(page.getByRole('link', { name: 'Open Apple Calendar', exact: true })).toBeFocused();
  await expect(page.getByLabel('Private calendar URL', { exact: true })).toHaveValue(new RegExp('/api/calendar/feed/'));
  await expect(page.getByRole('group', { name: 'Subscribe to your deadlines?', exact: true })).toHaveCount(0);
  expect(posts).toBe(2);
});
