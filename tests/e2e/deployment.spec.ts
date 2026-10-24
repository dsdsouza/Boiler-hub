import { test, expect } from '@playwright/test';

test('QA-007 recovers when a deployment loses bootstrap assets', async ({ page }) => {
  let documents = 0;
  let failed = 0;
  page.on('request', (request) => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++; });
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (request.isNavigationRequest() && request.frame() === page.mainFrame() && documents === 1) {
      // Model old HTML referencing a retired build, then serve fresh HTML on reload.
      // Edit plain HTML; Cloudflare can otherwise send zstd bytes the test client does not decode.
      const response = await route.fetch({ headers: { ...request.headers(), 'accept-encoding': 'identity' } });
      expect(response.status()).toBe(200);
      const original = await response.text();
      expect(original).toContain('/_next/static/');
      const html = original.replace(/((?:src|href)=")\/_next\/static\//g, '$1/_next/static/qa-retired/');
      return route.fulfill({ response, body: html });
    }
    if (request.url().includes('/_next/static/qa-retired/')) {
      failed++;
      return route.fulfill({ status: 404, headers: { 'cache-control': 'no-store' }, body: 'Old deployment asset missing' });
    }
    return route.continue();
  });
  await page.goto('/', { waitUntil: 'commit' });
  await page.waitForURL(/__boiler_reload=/);
  const slider = page.getByRole('slider');
  await expect(slider).toBeEnabled();
  await slider.focus();
  await slider.press('End');
  await expect(page.getByRole('img', { name: /^Boiler at pressure 100, Redline/ })).toBeVisible();
  expect(failed).toBeGreaterThan(0);
  expect(documents).toBe(2);
  const styles = await page.locator('link[rel="stylesheet"]').evaluateAll((links) => links.every((link) => (link as HTMLLinkElement).sheet !== null));
  expect(styles).toBe(true);
  await expect(page.getByText('A site update could not load.', { exact: false })).toHaveCount(0);
});

test('QA-007 persistent missing assets show a retry without a reload loop', async ({ page }) => {
  let documents = 0;
  page.on('request', (request) => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++; });
  await page.route('**/_next/static/**', (route) => /\.(js|css)(\?|$)/.test(route.request().url())
    ? route.fulfill({ status: 404, body: 'Persistent asset outage' }) : route.continue());
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.getByRole('alert')).toContainText('A site update could not load');
  await expect(page.getByRole('link', { name: 'Reload Boilerplate', exact: true })).toBeVisible();
  expect(documents).toBe(2);
});

test('cancelled asset requests do not reload a healthy page', async ({ page }) => {
  let probes = 0;
  let documents = 0;
  page.on('request', (request) => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++; });
  await page.route('**/_next/static/qa-cancelled.js', (route) => {
    if (route.request().method() === 'HEAD') { probes++; return route.fulfill({ status: 200, body: '' }); }
    return route.abort('aborted');
  });
  await page.goto('/');
  await expect(page.getByRole('slider')).toBeEnabled();
  await page.evaluate(() => {
    const script = document.createElement('script');
    script.src = '/_next/static/qa-cancelled.js';
    document.head.append(script);
  });
  await expect.poll(() => probes).toBe(1);
  await page.goto('/demo');
  await expect(page.getByRole('region', { name: 'Gauge and status', exact: true }).getByRole('img')).toBeVisible();
  expect(documents).toBe(2);
  expect(page.url()).not.toContain('__boiler_reload');
});
