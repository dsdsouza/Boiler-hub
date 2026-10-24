import { test, expect } from '@playwright/test';
import { noOverflow } from './helpers';

test('public home offers a working demo and formula link', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('pressure');
  await noOverflow(page);
  await page.getByRole('main').getByRole('link', { name: 'Try the demo', exact: true }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await page.goto('/');
  await page.getByRole('banner').getByRole('link', { name: 'How it works', exact: true }).click();
  await expect(page).toHaveURL(/\/how$/);
  await expect(page.getByRole('main')).toContainText('8.5');
  await noOverflow(page);
});

for (const [value, zone] of [[0, 'Cool'], [39, 'Cool'], [40, 'Working'], [69, 'Working'], [70, 'Hot'], [89, 'Hot'], [90, 'Redline'], [100, 'Redline']] as const) {
  test(`public gauge boundary ${value} is ${zone}`, async ({ page }) => {
    await page.goto('/');
    const slider = page.getByRole('slider');
    await slider.focus();
    await slider.press('Home');
    for (let i = 0; i < value; i++) await slider.press('ArrowRight');
    await expect(slider).toHaveValue(String(value));
    await expect(page.getByRole('img', { name: new RegExp(`^Boiler at pressure ${value}, ${zone}`) })).toBeVisible();
  });
}

for (const path of ['/boiler', '/teams', '/settings/sources']) {
  test(`signed-out ${path} preserves the intended destination`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`\\?next=${encodeURIComponent(path)}`));
    await expect(page.getByRole('main')).toContainText('Sign in to open that page.');
  });
}

test('signed-out private APIs reject reads and writes', async ({ request }) => {
  const operations = [
    request.get('/api/me/boiler'),
    request.post('/api/tasks', { data: { title: 'Unauthorized QA task' } }),
    request.patch('/api/me/status', { data: { status: 'away', note: 'unauthorized' } }),
    request.get('/api/teams'),
  ];
  for (const response of await Promise.all(operations)) {
    expect(response.status(), response.url()).toBe(401);
  }
});

test('sign-in return path cannot point at another site', async ({ page }) => {
  await page.goto('/?next=https://example.com');
  const links = page.getByRole('link', { name: 'Sign in with Google', exact: true });
  const hrefs = await links.evaluateAll((elements) => elements.map((el) => el.getAttribute('href')));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) expect(href).toBe('/auth/signin?next=%2Fonboarding');
});

test('public routes load their assets without missing chunks or runtime errors', async ({ page }) => {
  const failures: { path: string; status: number }[] = [];
  const errors: string[] = [];
  page.on('response', (response) => {
    const path = new URL(response.url()).pathname;
    if (path.startsWith('/_next/static/') && response.status() >= 400) failures.push({ path, status: response.status() });
  });
  page.on('pageerror', (error) => errors.push(error.message));
  for (const path of ['/', '/demo', '/how', '/privacy']) {
    await page.goto(path);
    await expect(page.getByRole('main')).toBeVisible();
  }
  expect(failures, 'HTML must reference assets available on the same deployment').toEqual([]);
  expect(errors).toEqual([]);
});
