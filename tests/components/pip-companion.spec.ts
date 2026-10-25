import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// This fixture uses invented sessions and intercepted services only; failed
// traces help diagnose browser setup races without recording live accounts.
test.use({ trace: 'retain-on-failure' });

const userId = '00000000-0000-4000-a000-000000000099';
const companion = (page: Page) => page.locator('[data-pip-companion]');
const pip = (page: Page) => companion(page).getByRole('button', { name: 'Chat with Pip', exact: true });
async function signIn(context: BrowserContext) {
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: userId, exp: expiry })).toString('base64url')}.fixture`;
  const session = { access_token: token, refresh_token: 'fixture-only', token_type: 'bearer', expires_in: 3600, expires_at: expiry, user: { id: userId, aud: 'authenticated', role: 'authenticated', email: 'pip@example.test', app_metadata: {}, user_metadata: {} } };
  await context.addCookies([{ name: 'sb-qa-project-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'), url: 'http://localhost:' + (process.env.QA_COMPONENT_PORT || '3219'), sameSite: 'Lax' }]);
  // Test-only session and service responses never reach an external backend.
  await context.route('https://qa-project.supabase.co/**', (route) => new URL(route.request().url()).pathname === '/auth/v1/user'
    ? route.fulfill({ json: session.user })
    : route.fulfill({ status: 503, json: { error: 'Reading unavailable' } }));
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

test('the bare larger companion survives failed readings and stays absent when signed out', async ({ page: signedOutPage, context }) => {
  await signedOutPage.goto('/qa-components?mode=pip');
  // Absence also passes during the loading fallback. Finish the first document
  // and its Link preloads before changing cookies and navigating again in WebKit.
  await expect(signedOutPage.getByRole('heading', { name: 'Pip movement check', exact: true })).toBeVisible();
  await signedOutPage.waitForLoadState('networkidle');
  await expect(companion(signedOutPage)).toHaveCount(0);
  // Install the synthetic session into a fresh document. WebKit can otherwise
  // start a competing same-URL navigation when cookies change on a loaded page.
  await signedOutPage.close();
  const page = await context.newPage();
  try {
    const failedReading = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.hostname === 'qa-project.supabase.co' && url.pathname === '/rest/v1/pressure_snapshots' && response.status() === 503;
    });
    await open(page, context);
    await failedReading;
    await expect(pip(page)).toBeVisible();
    const style = await pip(page).evaluate(el => { const s = getComputedStyle(el); return { background: s.backgroundColor, border: s.borderWidth, width: el.getBoundingClientRect().width }; });
    expect(style.background).toBe('rgba(0, 0, 0, 0)'); expect(style.border).toBe('0px'); expect(style.width).toBeGreaterThanOrEqual(112);
    await page.waitForLoadState('networkidle');
    await context.clearCookies(); await page.reload();
    await expect(page.getByRole('heading', { name: 'Pip movement check', exact: true })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expect(companion(page)).toHaveCount(0);
  } finally { await page.close(); }
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
  if (process.env.CALENDAR_SCREENSHOTS) { await mkdir(process.env.CALENDAR_SCREENSHOTS, { recursive: true }); await page.screenshot({ path: `${process.env.CALENDAR_SCREENSHOTS}/chat-${test.info().project.name}.png` }); }
  await page.keyboard.press('Escape'); await expect(pip(page)).toBeFocused();
});

test('keyboard movement, screen boundaries and resizing keep both Pip and chat reachable', async ({ page, context }) => {
  await open(page, context); await pip(page).focus();
  const original = (await pip(page).boundingBox())!;
  await pip(page).press('ArrowLeft');
  await expect.poll(async () => Math.round((await pip(page).boundingBox())!.x)).toBe(Math.round(original.x - 12));
  await pip(page).press('Home'); await expect.poll(async () => Math.round((await pip(page).boundingBox())!.x)).toBe(Math.round(original.x));
  await pip(page).press('Enter');
  const compact = companion(page).getByRole('dialog');
  await expect(compact).toBeVisible();
  const compactBox = (await compact.boundingBox())!;
  expect(compactBox.width).toBeLessThanOrEqual(288);
  expect(compactBox.height).toBeLessThan(230);
  expect(compactBox.y + compactBox.height).toBeCloseTo(original.y - 12, 0);
  await expect(compact).not.toContainText('Hi, I’m Pip.');
  await expect(compact.getByRole('button', { name: 'New conversation', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await drag(page, { x: 0, y: 0 }); await page.mouse.up();
  await expect.poll(async () => Math.round((await pip(page).boundingBox())!.x)).toBe(12);
  await page.setViewportSize({ width: 320, height: 600 });
  await pip(page).press('Enter'); const panel = companion(page).getByRole('dialog'); await expect(panel).toBeVisible();
  const bounds = (await panel.boundingBox())!; expect(bounds.x).toBeGreaterThanOrEqual(12); expect(bounds.x + bounds.width).toBeLessThanOrEqual(308); expect(bounds.y + bounds.height).toBeLessThanOrEqual(520);
  const form = panel.getByRole('textbox', { name: 'Message Pip', exact: true });
  await form.fill('A local draft');
  const formBox = (await form.boundingBox())!;
  const shortcutBox = (await panel.getByRole('button', { name: 'What’s due next?', exact: true }).boundingBox())!;
  const studyShortcutBox = (await panel.getByRole('button', { name: 'Plan study time', exact: true }).boundingBox())!;
  expect(formBox.y + formBox.height).toBeLessThan(shortcutBox.y);
  expect(shortcutBox.y).toBeCloseTo(studyShortcutBox.y, 0);
  await expect(panel.getByRole('group', { name: 'Pip shortcuts' }).getByRole('button')).toHaveCount(2);
  await expect(panel).not.toContainText('Quick questions');
  const window = panel.locator('.pip-chat-window');
  await expect(window.getByRole('heading', { name: 'Chat with Pip', exact: true })).toBeVisible();
  const expand = window.getByRole('button', { name: 'Expand conversation', exact: true });
  const expandBox = (await expand.boundingBox())!;
  const arrowBox = (await expand.locator('svg').boundingBox())!;
  const windowBox = (await window.boundingBox())!;
  expect(arrowBox.x + arrowBox.width / 2).toBeCloseTo(expandBox.x + expandBox.width / 2, 0);
  expect(expandBox.x + expandBox.width / 2).toBeCloseTo(windowBox.x + windowBox.width / 2, 0);
  await expand.click();
  const history = window.getByRole('log', { name: 'Conversation with Pip', exact: true });
  await expect(history).toBeVisible();
  expect((await history.boundingBox())!.height).toBeLessThanOrEqual(112);
  await window.getByRole('button', { name: 'Collapse conversation', exact: true }).click();
  await expect(history).toBeHidden();
  await expect(panel.getByRole('link', { name: 'Open My Boiler', exact: true })).toHaveCount(0);
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

test('touch dragging moves Pip without scrolling the page or opening chat', { tag: '@chromium-touch' }, async ({ browser }) => {
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


test('expanded history keeps the full reply panel visible when Pip sits higher on a phone screen', async ({ page, context }) => {
  const reply = "Well now, ol' friend, you ain't got any open assignments on the board right now, so there's nothing pressing to clock in for. Enjoy the quiet engine room while it lasts!";
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/pip/chat', route => route.fulfill({ json: { reply } }));
  await open(page, context);
  await pip(page).focus();
  for (let step = 0; step < 5; step++) await pip(page).press('Shift+ArrowUp');
  await pip(page).press('Enter');
  const panel = companion(page).getByRole('dialog');
  await panel.getByRole('button', { name: 'What’s due next?', exact: true }).click();
  await expect(panel.getByRole('status', { name: "Pip's reply", exact: true })).toContainText(reply);
  await panel.getByRole('button', { name: 'Expand conversation', exact: true }).click();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: width === 320 ? 740 : 844 });
    await expect.poll(async () => panel.evaluate(el => {
      const reply = el.querySelector('.pip-speech-bubble')!.getBoundingClientRect();
      const body = el.querySelector('.pip-chat-body')!;
      const card = el.querySelector('.pip-chat-window')!;
      const collapse = card.querySelector('[aria-expanded="true"]')!.getBoundingClientRect();
      const history = card.querySelector('[role="log"]')!;
      const controls = history.parentElement!;
      return reply.bottom <= el.getBoundingClientRect().bottom + 1
        && body.scrollHeight <= body.clientHeight + 1
        && collapse.bottom <= card.getBoundingClientRect().bottom - 1
        && history.getBoundingClientRect().bottom <= controls.getBoundingClientRect().bottom + 1
        && controls.scrollHeight <= controls.clientHeight + 1;
    })).toBe(true);
    const history = panel.getByRole('log', { name: 'Conversation with Pip', exact: true });
    await expect(history).toBeVisible();
    const historyBox = (await history.boundingBox())!;
    // Firefox can round a transformed box a few fractional pixels past its CSS height.
    expect(historyBox.height).toBeGreaterThanOrEqual(31.9);
    expect(historyBox.height).toBeLessThanOrEqual(96.1);
    await expect(panel.getByRole('textbox', { name: 'Message Pip', exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Collapse conversation', exact: true })).toBeVisible();
    if (process.env.PIP_SCREENSHOTS) {
      await mkdir(process.env.PIP_SCREENSHOTS, { recursive: true });
      await page.screenshot({ path: `${process.env.PIP_SCREENSHOTS}/pip-expanded-${width}-${test.info().project.name}.png` });
    }
  }
});


test('a saved session rejected by auth cannot reveal Pip', async ({ page, context }) => {
  await signIn(context);
  await context.route('https://qa-project.supabase.co/auth/v1/user', route => route.fulfill({ status: 401, json: { message: 'Invalid fixture session' } }));
  await page.goto('/qa-components?mode=pip');
  await expect(page.getByRole('heading', { name: 'Pip movement check', exact: true })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await expect(companion(page)).toHaveCount(0);
});
