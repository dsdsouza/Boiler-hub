import { test, expect, type Page } from '@playwright/test';
import { computePressure } from '../../lib/pressure/compute';
import type { BoilerResponse } from '../../lib/pressure/api-types';

const teamId = '00000000-0000-4000-a000-000000000001';
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>((r) => { resolve = r; }); return { promise, resolve }; };
function fixture(): BoilerResponse {
  const now = new Date();
  const tasks: BoilerResponse['tasks'] = ['First task', 'Second task'].map((title, i) => ({ id: `00000000-0000-4000-a000-00000000000${i + 2}`, title, dueAt: new Date(now.getTime() + 3 * 86_400_000).toISOString(), size: 'M', source: 'manual', assignmentId: null, doneAt: null }));
  return { tasks, events: [], sources: [], result: computePressure(tasks.map((t) => ({ id: t.id, title: t.title, source: t.source, kind: 'task', due: t.dueAt!, size: t.size })), now), status: { status: 'open', note: '' }, calendar: 'ok', computedAt: now.toISOString() };
}
async function open(page: Page, mode: string) {
  await page.route('**/api/me/boiler', (r) => r.fulfill({ json: fixture() }));
  await page.route('**/api/calendar/subscription', (r) => r.fulfill({ json: { feedPath: null } }));
  if (mode === 'onboarding') await page.route('**/api/sync', (r) => r.fulfill({ json: fixture() }));
  await page.goto(`/qa-components?mode=${mode}`);
}

test('visibility cannot start a second save while the first choice is pending', async ({ page }) => {
  const release = deferred(); let writes = 0;
  await page.route(`**/api/teams/${teamId}/membership`, async (r) => { writes++; await release.promise; await r.fulfill({ json: {} }); });
  await open(page, 'visibility');
  await page.getByRole('radio', { name: 'Hidden', exact: false }).check();
  await expect.poll(() => writes).toBe(1);
  const lead = page.getByRole('radio', { name: 'Lead only', exact: false });
  try { await expect(lead).toBeDisabled(); }
  finally { release.resolve(); }
  await expect(lead).toBeEnabled();
  await expect(page.getByRole('radio', { name: 'Hidden', exact: false })).toBeChecked();
});

test('creating a team preserves the next name drafted while the request is pending', async ({ page }) => {
  const release = deferred(); let writes = 0;
  await page.route('**/api/teams', async (r) => { writes++; await release.promise; await r.fulfill({ json: { team: { name: 'First team', inviteCode: 'ABC123' } } }); });
  await open(page, 'forms');
  const name = page.getByRole('textbox', { name: 'Name', exact: true });
  await name.fill('First team');
  await page.getByRole('button', { name: 'Create team', exact: true }).click();
  await expect.poll(() => writes).toBe(1);
  await name.fill('Next team');
  release.resolve();
  await expect(page.getByRole('status')).toContainText('Created First team');
  await expect(name).toHaveValue('Next team');
});

test('joining a team preserves the next invite drafted while the request is pending', async ({ page }) => {
  const release = deferred(); let writes = 0;
  await page.route('**/api/teams/join', async (r) => { writes++; await release.promise; await r.fulfill({ json: { teamId } }); });
  await open(page, 'forms');
  const code = page.getByRole('textbox', { name: 'Invite code', exact: true });
  await code.fill('ABC123'); await page.getByRole('button', { name: 'Join team', exact: true }).click();
  await expect.poll(() => writes).toBe(1); await code.fill('DEF456'); release.resolve();
  await expect(page.getByRole('status')).toContainText('Joined.');
  await expect(code).toHaveValue('DEF456');
});

test('a failed visibility save restores the previous choice and supports retry', async ({ page }) => {
  let writes = 0;
  await page.route(`**/api/teams/${teamId}/membership`, async (r) => {
    writes++; await r.fulfill(writes === 1 ? { status: 503, json: { error: 'Visibility unavailable' } } : { json: {} });
  });
  await open(page, 'visibility');
  const hidden = page.getByRole('radio', { name: 'Hidden', exact: false });
  await hidden.click();
  await expect(page.getByRole('alert').filter({ hasText: 'Visibility unavailable' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Everyone', exact: false })).toBeChecked();
  await expect(hidden).toBeEnabled(); await hidden.check();
  await expect.poll(() => writes).toBe(2);
  await expect(hidden).toBeEnabled(); await expect(hidden).toBeChecked();
});

test('an unbroken team name in the creation confirmation stays inside its panel', async ({ page }) => {
  await page.route('**/api/teams', (r) => r.fulfill({ json: { team: { name: 'x'.repeat(80), inviteCode: 'ABC123' } } }));
  await open(page, 'forms');
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('x'.repeat(80));
  await page.getByRole('button', { name: 'Create team', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Created');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});

test('an allowed unbroken team name fits the engine room on a phone', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await open(page, 'engine');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('x'.repeat(80));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  if (info.project.name === 'narrow') await info.attach('verified-team-name.png', { body: await page.screenshot(), contentType: 'image/png' });
});

for (const mode of ['boiler', 'onboarding']) test(`status does not claim Saved until accepted in ${mode}`, async ({ page }, info) => {
  const release = deferred(); let writes = 0;
  await page.route('**/api/me/status', async (r) => { writes++; await release.promise; await r.fulfill({ status: 503, json: { error: 'Status could not be saved' } }); });
  await open(page, mode);
  const note = page.getByRole('textbox', { name: 'Status note (shown to your teams)', exact: true });
  await note.fill('A new note'); await note.press('Enter');
  await expect.poll(() => writes).toBe(1);
  try { expect(await page.getByText('Saved', { exact: true }).count()).toBe(0); }
  finally { release.resolve(); }
  await expect(page.getByRole('alert').filter({ hasText: 'Status could not be saved' })).toBeVisible();
  await expect(page.getByText('Saved', { exact: true })).toHaveCount(0);
  await expect(note).toHaveValue('A new note');
  if (mode === 'boiler' && info.project.name === 'narrow') await info.attach('verified-note.png', { body: await page.screenshot(), contentType: 'image/png' });
});

test('a note drafted during a successful save is preserved and is not labeled Saved', async ({ page }) => {
  const release = deferred(); let writes = 0;
  await page.route('**/api/me/status', async (r) => { writes++; await release.promise; await r.fulfill({ json: { status: 'open', note: 'First note' } }); });
  await open(page, 'boiler');
  const note = page.getByRole('textbox', { name: 'Status note (shown to your teams)', exact: true });
  await note.fill('First note'); await note.press('Enter');
  await expect.poll(() => writes).toBe(1); await note.fill('Next note');
  const response = page.waitForResponse('**/api/me/status'); release.resolve(); await (await response).finished();
  await expect(note).toHaveValue('Next note');
  await expect(page.getByText('Saving…', { exact: true })).toHaveCount(0);
  expect(await page.getByText('Saved', { exact: true }).count()).toBe(0);
});

test('a slow task response cannot overwrite a newer status choice', async ({ page }) => {
  const release = deferred(); let statusWrites = 0;
  const old = fixture();
  await page.route('**/api/tasks/*', async (r) => {
    const snapshot = structuredClone(old);
    snapshot.tasks[0].doneAt = new Date().toISOString();
    await release.promise; await r.fulfill({ json: { boiler: snapshot } });
  });
  await page.route('**/api/me/status', async (r) => { statusWrites++; await r.fulfill({ json: { status: 'away', note: '' } }); });
  await open(page, 'boiler');
  const taskReply = page.waitForResponse('**/api/tasks/*');
  await page.getByRole('button', { name: 'Complete: First task', exact: true }).click();
  const away = page.getByRole('button', { name: 'Away', exact: true });
  await away.click();
  await expect(away).toHaveAttribute('aria-pressed', 'true');
  release.resolve(); await (await taskReply).finished();
  await expect.poll(() => statusWrites).toBe(1);
  await expect(away).toHaveAttribute('aria-pressed', 'true');
});

test('a slow refresh cannot overwrite a newer status choice', async ({ page }) => {
  const release = deferred(); let statusWrites = 0;
  await page.route('**/api/sync', async (r) => { await release.promise; await r.fulfill({ json: fixture() }); });
  await page.route('**/api/me/status', async (r) => { statusWrites++; await r.fulfill({ json: { status: 'away', note: '' } }); });
  await open(page, 'boiler');
  const refreshReply = page.waitForResponse('**/api/sync');
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  const away = page.getByRole('button', { name: 'Away', exact: true });
  await away.click();
  release.resolve(); await (await refreshReply).finished();
  await expect.poll(() => statusWrites).toBe(1);
  await expect(away).toHaveAttribute('aria-pressed', 'true');
});

test('a task awaiting its server identity cannot be completed or resized yet', async ({ page }) => {
  const release = deferred(); let creates = 0;
  await page.route('**/api/tasks', async (r) => { creates++; await release.promise; await r.fulfill({ status: 201, json: { boiler: fixture() } }); });
  await open(page, 'boiler');
  await page.getByRole('textbox', { name: 'New task', exact: true }).fill('Task still saving');
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect.poll(() => creates).toBe(1);
  try {
    await expect(page.getByRole('button', { name: 'Complete: Task still saving', exact: true })).toBeDisabled();
    await expect(page.getByRole('combobox', { name: 'Size: Task still saving', exact: true })).toBeDisabled();
  } finally { release.resolve(); }
});

test('an expired session clears the retained private boiler during refresh', async ({ page }) => {
  await page.route('**/api/sync', r => r.fulfill({ status: 401, json: { error: 'Not signed in' } }));
  await open(page, 'boiler');
  const gauge = page.getByRole('region', { name: 'Gauge and status', exact: true }).getByRole('img');
  await expect(gauge).toBeVisible();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: /^Not signed in$/ })).toBeVisible();
  await expect(gauge).toHaveCount(0);
});
