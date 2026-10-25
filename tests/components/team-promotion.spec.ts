import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { world } from '../workflows/local/world';

const teamId = '00000000-0000-4000-a000-000000000010';

async function setup(page: Page, context: BrowserContext, type: 'work' | 'class' = 'work', name = 'Jungle') {
  const service = world();
  await service.connect(context);
  service.users[1].name = name;
  service.teams.push({ id: teamId, name: 'Workshop', type, inviteCode: 'WF1234', members: [
    { user: service.users[0], role: 'lead', visibility: 'everyone' },
    { user: service.users[1], role: 'member', visibility: 'lead' },
  ] });
  let browserDialogs = 0;
  page.on('dialog', async dialog => { browserDialogs++; await dialog.dismiss(); });
  await page.goto(`/qa-workflows?view=engine&team=${teamId}`);
  const role = type === 'class' ? 'teacher' : 'lead';
  const trigger = page.getByRole('button', { name: `Make co-${role}`, exact: true }).first();
  await expect(trigger).toBeVisible();
  const dialog = page.getByRole('dialog', { name: `Make ${name} a co-${role}?`, exact: true });
  return { service, trigger, dialog, browserDialogs: () => browserDialogs };
}

test('promotion uses an app popup with keyboard cancellation and no membership write', async ({ page, context }, info) => {
  const { service, trigger, dialog, browserDialogs } = await setup(page, context);
  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('They’ll see boilers shared with “Lead only” and can post assignments for this team.');
  const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true });
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Make co-lead', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(cancel).toBeFocused();
  await page.evaluate(() => document.fonts.ready);
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(15);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width - 15);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (info.project.name === 'chromium' || info.project.name === 'narrow') {
    await info.attach('promotion-dialog.png', { body: await page.screenshot(), contentType: 'image/png' });
  }
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(service.writes.filter(write => write.endsWith('/membership'))).toEqual([]);
  expect(browserDialogs()).toBe(0);
});

for (const type of ['work', 'class'] as const) {
  test(`confirming a ${type} promotion sends one request and prevents duplicate actions`, async ({ page, context }) => {
    const { service, trigger, dialog, browserDialogs } = await setup(page, context, type);
    const writes: unknown[] = [];
    let finish!: () => void;
    const pending = new Promise<void>(resolve => { finish = resolve; });
    await page.route(`**/api/teams/${teamId}/membership`, async route => {
      writes.push(route.request().postDataJSON());
      await pending;
      service.teams[0].members[1].role = 'lead';
      await route.fulfill({ json: {} });
    });
    try {
      await trigger.click();
      await dialog.getByRole('button', { name: `Make co-${type === 'class' ? 'teacher' : 'lead'}`, exact: true }).click();
      await expect.poll(() => writes.length).toBe(1);
      await expect(dialog.getByRole('button', { name: 'Promoting…', exact: true })).toBeDisabled();
      await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeVisible();
      expect(writes).toEqual([{ userId: service.users[1].id, role: 'lead' }]);
      finish();
      await expect(dialog).not.toBeVisible();
      await page.reload();
      await expect(page.getByRole('button', { name: /^Make co-/ })).toHaveCount(0);
      expect(service.teams[0].members[1].role).toBe('lead');
      expect(browserDialogs()).toBe(0);
    } finally { finish(); }
  });
}

test('a rejected promotion stays in the popup and can be retried', async ({ page, context }) => {
  const { trigger, dialog } = await setup(page, context);
  let writes = 0;
  await page.route(`**/api/teams/${teamId}/membership`, async route => {
    writes++;
    await route.fulfill(writes === 1 ? { status: 503, json: { error: 'Promotion unavailable. Try again.' } } : { json: {} });
  });
  await trigger.click();
  const confirm = dialog.getByRole('button', { name: 'Make co-lead', exact: true });
  await confirm.click();
  await expect(dialog.getByRole('alert')).toHaveText('Promotion unavailable. Try again.');
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(dialog).not.toBeVisible();
  expect(writes).toBe(2);
  await trigger.click();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
});

test('a long member name fits in the promotion popup', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const { trigger, dialog } = await setup(page, context, 'class', 'J'.repeat(80));
  await trigger.click();
  await expect(dialog.getByRole('heading')).toBeVisible();
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
