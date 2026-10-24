import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const userId = '00000000-0000-4000-a000-000000000099';
const companion = (page: Page) => page.locator('[data-pip-companion]');
const pip = (page: Page) => companion(page).getByRole('button', { name: 'Chat with Pip', exact: true });
async function signIn(context: BrowserContext) {
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: userId, exp: expiry })).toString('base64url')}.fixture`;
  const session = { access_token: token, refresh_token: 'fixture-only', token_type: 'bearer', expires_in: 3600, expires_at: expiry, user: { id: userId, aud: 'authenticated', role: 'authenticated', email: 'pip@example.test', app_metadata: {}, user_metadata: {} } };
  await context.addCookies([{ name: 'sb-qa-project-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'), url: 'http://localhost:' + (process.env.QA_COMPONENT_PORT || '3219'), sameSite: 'Lax' }]);
  // Test-only session and service responses never reach an external backend.
  await context.route('https://qa-project.supabase.co/**', (route) => route.fulfill({ status: 503, json: { error: 'Reading unavailable' } }));
}
async function open(page: Page, context: BrowserContext) {
  await signIn(context);
  await page.route('**/api/me/boiler', (route) => route.fulfill({ status: 401, json: { error: 'fixture' } }));
  await page.goto('/qa-components?mode=pip');
  await expect(pip(page)).toBeVisible();
}
async function drag(page: Page, target: { x: number; y: number }) {
  const box = (await pip(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(target.x, target.y, { steps: 12 });
}

test('the bare larger companion survives failed readings and stays absent when signed out', async ({ page, context }) => {
  await page.goto('/qa-components?mode=pip'); await expect(companion(page)).toHaveCount(0);
  await open(page, context);
  const style = await pip(page).evaluate(el => { const s = getComputedStyle(el); return { background: s.backgroundColor, border: s.borderWidth, width: el.getBoundingClientRect().width }; });
  expect(style.background).toBe('rgba(0, 0, 0, 0)'); expect(style.border).toBe('0px'); expect(style.width).toBeGreaterThanOrEqual(112);
  await context.clearCookies(); await page.reload(); await expect(companion(page)).toHaveCount(0);
});

test('dragging carries Pip without opening chat and remembers his place across navigation and reload', async ({ page, context }) => {
  await open(page, context);
  await drag(page, { x: 160, y: 160 });
  await expect(pip(page)).toHaveAttribute('data-dragging', 'true'); await expect(companion(page).locator('[data-pip-grip]')).toBeVisible();
  await page.mouse.up(); await expect(pip(page)).toHaveAttribute('data-dragging', 'false');
  await expect(companion(page).getByRole('dialog')).toHaveCount(0);
  const box = (await pip(page).boundingBox())!;
  await page.getByRole('link', { name: 'Next screen', exact: true }).click();
  await expect.poll(async () => Math.round((await pip(page).boundingBox())!.x)).toBe(Math.round(box.x));
  await page.reload(); await expect.poll(async () => Math.round((await pip(page).boundingBox())!.y)).toBe(Math.round(box.y));
  await pip(page).click(); await expect(companion(page).getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(pip(page)).toBeFocused();
});

test('keyboard movement, screen boundaries and resizing keep both Pip and chat reachable', async ({ page, context }) => {
  await open(page, context); await pip(page).focus();
  const original = (await pip(page).boundingBox())!;
  await pip(page).press('ArrowLeft');
  await expect.poll(async () => Math.round((await pip(page).boundingBox())!.x)).toBe(Math.round(original.x - 12));
  await pip(page).press('Home'); await expect.poll(async () => Math.round((await pip(page).boundingBox())!.x)).toBe(Math.round(original.x));
  await drag(page, { x: 0, y: 0 }); await page.mouse.up();
  await expect.poll(async () => Math.round((await pip(page).boundingBox())!.x)).toBe(12);
  await page.setViewportSize({ width: 320, height: 600 });
  await pip(page).press('Enter'); const panel = companion(page).getByRole('dialog'); await expect(panel).toBeVisible();
  const bounds = (await panel.boundingBox())!; expect(bounds.x).toBeGreaterThanOrEqual(12); expect(bounds.x + bounds.width).toBeLessThanOrEqual(308); expect(bounds.y + bounds.height).toBeLessThanOrEqual(520);
  await panel.getByRole('button', { name: 'Close Pip chat' }).click(); await expect(pip(page)).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test('drag cancellation restores the original position and reduced motion keeps the carried pose still', async ({ page, context }) => {
  await open(page, context);
  const original = (await pip(page).boundingBox())!;
  await drag(page, { x: 170, y: 150 });
  await expect(companion(page).locator('.mp-dangle')).toHaveCSS('animation-name', 'none');
  await pip(page).press('Escape'); await page.mouse.up();
  await expect.poll(async () => Math.round((await pip(page).boundingBox())!.x)).toBe(Math.round(original.x));
  await expect(companion(page).getByRole('dialog')).toHaveCount(0);
});

test('the hanging pose animates only during dragging when motion is allowed', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await open(page, context);
  await drag(page, { x: 170, y: 150 });
  await expect(companion(page).locator('.mp-dangle')).toHaveCSS('animation-name', 'mp-dangle');
  if (process.env.PIP_SCREENSHOTS) {
    await mkdir(process.env.PIP_SCREENSHOTS, { recursive: true });
    await page.screenshot({ path: `${process.env.PIP_SCREENSHOTS}/pip-carried-${test.info().project.name}.png` });
  }
  await page.mouse.up(); await expect(companion(page).locator('.mp-dangle')).toHaveCount(0);
});


test('releasing outside the window cannot steal the next chat click', async ({ page, context }) => {
  await open(page, context); await drag(page, { x: -100, y: -100 }); await page.mouse.up();
  await page.mouse.move(180, 180); await pip(page).press('Enter');
  const panel = companion(page).getByRole('dialog'); await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Close Pip chat' }).click();
  await expect(pip(page)).toBeFocused(); await expect(pip(page)).toHaveAttribute('data-dragging', 'false');
});

test('touch dragging moves Pip without scrolling the page or opening chat', async ({ browser, browserName }) => {
  test.skip(browserName !== 'chromium', 'Native touch input is exercised in Chromium');
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 }, baseURL: test.info().project.use.baseURL });
  const page = await context.newPage();
  try {
    await open(page, context);
    const box = (await pip(page).boundingBox())!;
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 120, y: 200 }] });
    await expect(pip(page)).toHaveAttribute('data-dragging', 'true');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(pip(page)).toHaveAttribute('data-dragging', 'false');
    const after = (await pip(page).boundingBox())!; expect(after.x).toBeLessThan(box.x);
    await expect(companion(page).getByRole('dialog')).toHaveCount(0); expect(await page.evaluate(() => scrollY)).toBe(0);
  } finally { await context.close(); }
});
