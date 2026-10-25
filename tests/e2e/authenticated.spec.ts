import { expect, test, type APIRequestContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { BoilerResponse } from '@/lib/pressure/api-types';

async function ownerBoiler(request: APIRequestContext): Promise<BoilerResponse> {
  // A private synthetic response supports local UI checks without a service key.
  if (process.env.QA_NAV_BOILER_FIXTURE) return JSON.parse(readFileSync(process.env.QA_NAV_BOILER_FIXTURE, 'utf8'));
  const response = await request.get('/api/me/boiler');
  expect(response.status()).toBe(200);
  return response.json();
}

test('tab navigation keeps the owner boiler ready and Refresh still fetches fresh data', async ({ page, request }) => {
  const payload = await ownerBoiler(request);
  let reads = 0;
  let refreshes = 0;
  await page.route('**/api/me/boiler', route => { reads++; return route.fulfill({ json: payload }); });
  await page.route('**/api/sync', route => { refreshes++; return route.fulfill({ json: payload }); });
  await page.goto('/boiler');
  const gauge = page.getByRole('region', { name: 'Gauge and status', exact: true }).getByRole('img');
  await expect(gauge).toBeVisible();
  for (const [name, path] of [['Teams', '/teams'], ['Connect', '/settings/sources'], ['Help', '/how'], ['My Boiler', '/boiler']]) {
    await page.getByRole('banner').getByRole('link', { name, exact: true }).click();
    await page.waitForURL(url => url.pathname === path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
  await expect(gauge).toBeVisible();
  expect(reads).toBe(1);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect.poll(() => refreshes).toBe(1);
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
});

test('connecting a source invalidates the saved boiler on the next tab visit', async ({ page, request }) => {
  const payload = await ownerBoiler(request);
  const updated = { ...payload, tasks: [...payload.tasks, { id: 'navigation-deadline', title: 'Freshly imported deadline',
    dueAt: null, size: 'S', doneAt: null, source: 'ics', assignmentId: null }] };
  let reads = 0;
  await page.route('**/api/me/boiler', route => route.fulfill({ json: ++reads === 1 ? payload : updated }));
  await page.route('**/api/sources', route => route.request().method() === 'POST'
    ? route.fulfill({ status: 201, json: { source: { id: '00000000-0000-4000-8000-000000000001', kind: 'ics',
      label: 'Navigation test calendar', coursework: true, status: 'ok', error: null, lastSyncedAt: new Date().toISOString() },
      boiler: updated, itemCount: 1, tasks: 1, events: 0 } }) : route.continue());
  await page.goto('/boiler');
  await expect(page.getByRole('region', { name: 'Gauge and status', exact: true }).getByRole('img')).toBeVisible();
  await page.getByRole('banner').getByRole('link', { name: 'Connect', exact: true }).click();
  await page.getByLabel('Brightspace subscription link', { exact: true }).fill('https://school.brightspace.com/d2l/le/calendar/feed/user/test.ics');
  await page.getByRole('button', { name: 'Import schedule', exact: true }).click();
  await expect(page.getByText('Navigation test calendar', { exact: true })).toBeVisible();
  await page.getByRole('banner').getByRole('link', { name: 'My Boiler', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Tasks', exact: true }).getByText('Freshly imported deadline', { exact: true })).toBeVisible();
  expect(reads).toBe(2);
});

test('an unauthorized refresh clears the retained private boiler', async ({ page, request }) => {
  const payload = await ownerBoiler(request);
  await page.route('**/api/me/boiler', route => route.fulfill({ json: payload }));
  await page.route('**/api/sync', route => route.fulfill({ status: 401, json: { error: 'Not signed in' } }));
  await page.goto('/boiler');
  const gauge = page.getByRole('region', { name: 'Gauge and status', exact: true }).getByRole('img');
  await expect(gauge).toBeVisible();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert').filter({ hasText: /^Not signed in$/ })).toBeVisible();
  await expect(gauge).toHaveCount(0);
});

test('a task save finishing after navigation reaches the returning boiler', async ({ page, request }) => {
  const payload = await ownerBoiler(request);
  const title = 'Task saved while switching tabs';
  const updated = { ...payload, tasks: [...payload.tasks, { id: 'navigation-saved-task', title,
    dueAt: null, size: 'S', doneAt: null, source: 'manual', assignmentId: null }] };
  let reads = 0;
  let saving = false;
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  await page.route('**/api/me/boiler', route => { reads++; return route.fulfill({ json: payload }); });
  await page.route('**/api/tasks', async route => {
    saving = true;
    await pending;
    await route.fulfill({ status: 201, json: { boiler: updated } });
  });
  try {
    await page.goto('/boiler');
    const tasks = page.getByRole('region', { name: 'Tasks', exact: true });
    await tasks.getByRole('textbox', { name: 'New task', exact: true }).fill(title);
    await tasks.getByRole('combobox', { name: 'Due', exact: true }).selectOption('none');
    await tasks.getByRole('button', { name: 'Add task', exact: true }).click();
    await expect.poll(() => saving).toBe(true);
    await page.getByRole('banner').getByRole('link', { name: 'Help', exact: true }).click();
    await page.waitForURL(url => url.pathname === '/how');
    await page.getByRole('banner').getByRole('link', { name: 'My Boiler', exact: true }).click();
    await page.waitForURL(url => url.pathname === '/boiler');
    await expect.poll(() => reads).toBe(2);
    // The owner's pending draft survives navigation, but cannot be changed
    // until the server supplies its permanent identity.
    const task = tasks.getByRole('button', { name: `Complete: ${title}`, exact: true });
    await expect(task).toHaveCount(1);
    await expect(task).toBeDisabled();
    finish();
    await expect(task).toBeEnabled();
    await expect(task).toHaveCount(1);
  } finally { finish(); }
});

test('a status save finishing after navigation reaches the returning boiler', async ({ page, request }) => {
  const payload = await ownerBoiler(request);
  const label = payload.status.status === 'away' ? 'Open for work' : 'Away';
  let reads = 0;
  let saving = false;
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  await page.route('**/api/me/boiler', route => { reads++; return route.fulfill({ json: payload }); });
  await page.route('**/api/me/status', async route => {
    saving = true;
    await pending;
    await route.fulfill({ status: 204, body: '' });
  });
  try {
    await page.goto('/boiler');
    const status = page.getByRole('button', { name: label, exact: true });
    await status.click();
    await expect.poll(() => saving).toBe(true);
    await page.getByRole('banner').getByRole('link', { name: 'Help', exact: true }).click();
    await page.waitForURL(url => url.pathname === '/how');
    await page.getByRole('banner').getByRole('link', { name: 'My Boiler', exact: true }).click();
    await page.waitForURL(url => url.pathname === '/boiler');
    await expect.poll(() => reads).toBe(2);
    // Keep the newer optimistic choice while the save is still pending.
    await expect(status).toHaveAttribute('aria-pressed', 'true');
    finish();
    await expect(status).toHaveAttribute('aria-pressed', 'true');
  } finally { finish(); }
});

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


test('signed-in home and Help keep the account and app navigation across screen sizes', async ({ page }) => {
  for (const path of ['/', '/how']) {
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      const header = page.getByRole('banner');
      const bottomNavigation = path === '/' && width < 640;
      const nav = page.getByRole('navigation', { name: bottomNavigation ? 'App' : 'Main', exact: true });
      await expect(nav).toHaveCount(1);
      const destinations = [[bottomNavigation ? 'Boiler' : 'My Boiler', '/boiler'], ['Calendar', '/calendar'], ['Teams', '/teams'], ['Connect', '/settings/sources'], ['Help', '/how']];
      for (const [name, href] of destinations) {
        const link = nav.getByRole('link', { name, exact: true });
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute('href', href);
      }
      if (bottomNavigation) await expect(header.getByRole('navigation', { name: 'Main', exact: true })).toHaveCount(0);
      if (path === '/how') {
        await expect(nav.getByRole('link', { name: 'Help', exact: true })).toHaveAttribute('aria-current', 'page');
      }
      await expect(header.getByRole('img', { name: /^Signed in as / })).toBeVisible();
      await expect(header.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
      await expect(header.getByRole('link', { name: 'Sign in with Google', exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
  await page.getByRole('banner').getByRole('link', { name: 'Teams', exact: true }).click();
  await expect(page).toHaveURL(/\/teams$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
