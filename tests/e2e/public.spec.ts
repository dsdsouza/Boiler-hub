import { test, expect } from '@playwright/test';
import { noOverflow } from './helpers';

test('signed-out public screens keep app navigation out of the header', async ({ page }) => {
  for (const path of ['/', '/how', '/calendar-helper']) {
    await page.goto(path);
    const header = page.getByRole('banner');
    await expect(header.getByRole('link', { name: 'Boilerplate', exact: true })).toBeVisible();
    await expect(header.getByRole('navigation', { name: 'Main', exact: true })).toHaveCount(0);
    for (const name of ['My Boiler', 'Calendar', 'Teams', 'Connect', 'Help']) {
      await expect(header.getByRole('link', { name, exact: true, includeHidden: true })).toHaveCount(0);
    }
    await expect(page.getByRole('navigation', { name: 'App', exact: true })).toHaveCount(0);
  }
});

test('public home leads to setup and Help stays readable to guests', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('red line');
  await noOverflow(page);
  await expect(page.getByRole('link', { name: 'Try the demo', exact: true })).toHaveCount(0);
  await page.getByRole('main').getByRole('link', { name: 'Set up my boiler', exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole('heading', { name: 'Who are we setting up for?', level: 1, exact: true })).toBeVisible();
  await page.goto('/how');
  await expect(page).toHaveURL(/\/how$/);
  const helpHeader = page.getByRole('banner');
  await expect(page).toHaveTitle('Help · Boilerplate');
  await expect(helpHeader.getByRole('navigation', { name: 'Main', exact: true })).toHaveCount(0);
  await expect(helpHeader.getByRole('link', { name: 'Sign in with Google', exact: true, includeHidden: true })).toHaveAttribute('href', '/auth/signin?next=%2Fhow');
  await expect(helpHeader.getByRole('link', { name: 'Teams', exact: true, includeHidden: true })).toHaveCount(0);
  await expect(page.getByRole('main')).toContainText('8.5');
  await noOverflow(page);
});

for (const [value, zone] of [[0, 'Cool'], [39, 'Cool'], [40, 'Working'], [69, 'Working'], [70, 'Hot'], [89, 'Hot'], [90, 'Redline'], [100, 'Redline']] as const) {
  test(`public gauge boundary ${value} is ${zone}`, async ({ page }) => {
    await page.goto('/');
    const slider = page.getByRole('slider');
    await expect(slider).toBeEnabled();
    await slider.focus();
    await expect(slider).toBeFocused();
    await slider.press('Home');
    await expect(slider).toHaveValue('0');
    for (let i = 0; i < value; i++) await slider.press('ArrowRight');
    await expect(slider).toHaveValue(String(value));
    // Streaming can retain an inert hidden server copy. Inspect the control
    // belonging to the accessible slider; duplicate visible sliders still fail.
    const control = page.locator('.bp-pressure-control').filter({ has: slider });
    await expect(control).toHaveCount(1);
    await expect(control).toHaveAttribute('data-zone', zone.toLowerCase());
    await expect(control.locator('..').locator('output[for="pressure"]')).toContainText(`${value}%`);
    const colors = { Cool: 'rgb(127, 179, 213)', Working: 'rgb(209, 168, 90)', Hot: 'rgb(240, 145, 58)', Redline: 'rgb(242, 92, 69)' };
    await expect(control.locator('.bp-pressure-fill')).toHaveCSS('background-color', colors[zone]);
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
    request.post('/api/pip/chat', { data: { messages: [{ role: 'user', content: 'What is due?' }], timeZone: 'UTC' } }),
  ];
  for (const response of await Promise.all(operations)) {
    expect(response.status(), response.url()).toBe(401);
  }
});

test('sign-in return path cannot point at another site', async ({ page }) => {
  await page.goto('/?next=https://example.com');
  const links = page.getByRole('link', { name: 'Sign in with Google', exact: true, includeHidden: true });
  await expect(page.getByRole('link', { name: 'Set up my boiler', exact: true })).toHaveAttribute('href', '/onboarding');
  const hrefs = await links.evaluateAll((elements) => elements.map((el) => el.getAttribute('href')));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) expect(href).toBe('/auth/signin?next=%2Fonboarding');
});

test('public routes load their assets without missing chunks or runtime errors', async ({ context }) => {
  const failures: { path: string; status: number }[] = [];
  const errors: string[] = [];
  for (const path of ['/', '/how', '/calendar-helper', '/onboarding', '/privacy']) {
    // Each route gets a cold document. Closing it after inspection avoids
    // attributing a departing document's cancelled prefetch to the next route.
    const page = await context.newPage();
    const onError = (error: Error) => errors.push(`${path}: ${error.message}`);
    page.on('response', (response) => {
      const path = new URL(response.url()).pathname;
      if ((path.startsWith('/_next/static/') || path.startsWith('/fonts/')) && response.status() >= 400) failures.push({ path, status: response.status() });
    });
    page.on('pageerror', onError);
    try {
      const response = await page.goto(path);
      expect(response?.status()).toBe(path === '/privacy' ? 404 : 200);
      if (path === '/privacy') {
        await expect(page.getByRole('heading', { name: '404', exact: true })).toBeVisible();
      } else {
        await expect(page.getByRole('main')).toBeVisible();
        await expect(page.getByRole('contentinfo')).toHaveCount(0);
        const fontsLoaded = await page.evaluate(async () => {
          const faces = await Promise.all([
            document.fonts.load('400 16px "Bebas Neue"'),
            document.fonts.load('400 16px "Inter"'),
            document.fonts.load('500 16px "JetBrains Mono"'),
            document.fonts.load('700 16px "JetBrains Mono"'),
          ]);
          return faces.every((family) => family.length > 0 && family.every((face) => face.status === 'loaded'));
        });
        expect(fontsLoaded, 'All bundled font families must load on each public route').toBe(true);
      }
      await page.waitForLoadState('networkidle');
    } finally {
      page.off('pageerror', onError);
      await page.close();
    }
  }
  expect(failures, 'HTML must reference assets available on the same deployment').toEqual([]);
  expect(errors).toEqual([]);
});


test('guests cannot see or open Pip on public screens', async ({ page }) => {
  for (const path of ['/', '/how', '/onboarding', '/mascot-preview']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-pip-companion]')).toHaveCount(0);
    await expect(page.getByRole('img', { name: /^Pip/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Chat with Pip', exact: true })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Message Pip', exact: true })).toHaveCount(0);
    if (path === '/' && process.env.PIP_ACCESS_SCREENSHOTS) {
      await page.screenshot({ path: `${process.env.PIP_ACCESS_SCREENSHOTS}/guest-home.png` });
    }
  }
});


test('the removed demo route returns 404 and has no home page link', async ({ page }) => {
  for (const path of ['/demo', '/qa-boiler']) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: '404', exact: true })).toBeVisible();
  }
  await page.goto('/');
  await expect(page.locator('a[href="/demo"]')).toHaveCount(0);
});
