import { test, expect } from '@playwright/test';
import { addTask, openBoilerFixture, score, noOverflow } from '../e2e/helpers';

const room = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'Product Squad boilers', exact: true });
const maya = (page: import('@playwright/test').Page) => room(page).getByRole('article').filter({ has: page.getByRole('heading', { name: 'Maya', exact: true }) });

test.beforeEach(async ({ page }) => {
  await openBoilerFixture(page);
  await page.getByRole('button', { name: 'Product Squad', exact: true }).click();
});

test('exploration: personal changes update the shared team pressure and counts', async ({ page }) => {
  const assignment = page.getByRole('complementary', { name: 'New assignment', exact: true });
  await assignment.getByRole('textbox', { name: 'Title', exact: true }).fill('');
  const before = await score(page);
  await addTask(page, 'Explorer shared pressure', 'L');
  expect(await score(page)).toBeGreaterThan(before);
  await expect(maya(page).getByRole('img')).toHaveAttribute('aria-label', new RegExp(`pressure ${await score(page)},`));
  await expect(maya(page)).toContainText('5 due');
  await page.getByRole('button', { name: 'Complete: Explorer shared pressure', exact: true }).click();
  await expect(maya(page).getByRole('img')).toHaveAttribute('aria-label', new RegExp(`pressure ${before},`));
  await expect(maya(page)).toContainText('4 due');
});

test('exploration: posting to Maya’s team creates her assignment and matches the preview', async ({ page }) => {
  const assignment = page.getByRole('complementary', { name: 'New assignment', exact: true });
  await assignment.getByRole('textbox', { name: 'Title', exact: true }).fill('Explorer team fanout');
  const preview = Number((await maya(page).getByRole('img').getAttribute('aria-label'))?.match(/pressure (\d+)/)?.[1]);
  await assignment.getByRole('button', { name: /^Post to / }).click();
  const row = page.getByRole('region', { name: 'Tasks', exact: true }).getByRole('listitem').filter({ has: page.getByRole('button', { name: 'Complete: Explorer team fanout', exact: true }) });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Source: Team');
  await expect(row.getByRole('combobox')).toHaveCount(0);
  expect(await score(page)).toBe(preview);
  await page.getByRole('button', { name: 'Complete: Explorer team fanout', exact: true }).click();
  expect(await score(page)).toBeLessThan(preview);
  await expect(maya(page).getByRole('img')).toHaveAttribute('aria-label', new RegExp(`pressure ${await score(page)},`));
});

test('exploration: a full-length unbroken status note stays inside its card', async ({ page }) => {
  const note = page.getByRole('textbox', { name: 'Status note (shown to your teams)', exact: true });
  await note.fill('x'.repeat(80));
  await note.press('Enter');
  const text = maya(page).locator('p').filter({ hasText: 'x'.repeat(80) });
  await expect(text).toBeVisible();
  expect(await text.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await noOverflow(page);
});

test('exploration: a long assignment title wraps in the posted confirmation', async ({ page }) => {
  const assignment = page.getByRole('complementary', { name: 'New assignment', exact: true });
  await assignment.getByRole('textbox', { name: 'Title', exact: true }).fill('x'.repeat(200));
  await assignment.getByRole('button', { name: /^Post to / }).click();
  const text = assignment.getByRole('status').locator('p');
  expect(await text.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  const overflow = await page.evaluate(() => [...document.querySelectorAll('main *')].filter((el) => el instanceof HTMLElement && el.getClientRects().length && el.getBoundingClientRect().right > document.documentElement.clientWidth + 1).slice(-10).map((el) => ({ tag: el.tagName, css: el.className, width: el.clientWidth, text: el.textContent?.slice(0, 60) })));
  expect(overflow, 'All assignment surfaces fit the viewport').toEqual([]);
  await noOverflow(page);
});

test('exploration: returning to the landing page hydrates without browser errors', async ({ page }) => {
  const errors: string[] = [];
  // Exercise the product's navigation while collecting every runtime error.
  // Cold-document bootstrap and assets are checked separately in public.spec.
  page.on('pageerror', (e) => errors.push(e.message));
  for (const path of ['/', '/how', '/', '/onboarding', '/', '/']) {
    if (path === '/') await page.getByRole('banner').getByRole('link', { name: 'Boilerplate', exact: true }).click();
    else if (path === '/how') await page.goto('/how');
    else await page.getByRole('main').getByRole('link', { name: 'Set up my boiler', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path === '/' ? '/' : path}$`));
    await expect(page.getByRole('main')).toBeVisible();
    if (path === '/') {
      const slider = page.getByRole('slider');
      await expect(slider).toBeEnabled();
      await slider.press('Home');
      await expect(slider).toHaveValue('0');
      await slider.press('ArrowRight');
      await expect(page.getByRole('img', { name: /^Boiler at pressure 1, Cool/ })).toBeVisible();
    } else {
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
    await page.waitForLoadState('networkidle');
  }
  await expect(page.getByRole('slider')).toBeEnabled();
  expect(errors).toEqual([]);
});
