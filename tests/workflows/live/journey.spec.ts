import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { BoilerResponse } from '../../../lib/pressure/api-types';

const steps = ['Verify the synthetic session', 'Read the onboarding gauge', 'Save an onboarding note', 'Continue to the personal workload',
  'Create a dated task', 'Verify task persistence after reopening', 'Resize the task', 'Complete the task', 'Verify completion after reopening',
  'Visit the permitted team workflow', 'Review source and subscription settings', 'Restore test data'];
const step = (name: string, body: () => Promise<unknown>) => test.step(name, body, { timeout: 40_000 });
const note = (page: Page) => page.getByRole('textbox', { name: 'Status note (shown to your teams)', exact: true });
async function reopen(page: Page) {
  const fresh = await page.context().newPage();
  await fresh.goto(page.url());
  await page.close();
  return fresh;
}
async function navigate(page: Page, label: string, href: string) {
  // The real app uses a bottom navigation on phones and a header on desktop.
  const links = page.locator(`a[href="${href}"]`).filter({ hasText: label });
  for (const link of await links.all()) if (await link.isVisible()) { await link.click(); return; }
  throw new Error(`No visible ${label} navigation is available`);
}
async function completed(page: Page, title: string) {
  const control = page.getByRole('button', { name: `Mark not done: ${title}`, exact: true, includeHidden: true });
  await expect(control).toHaveCount(1);
  const details = page.locator('details').filter({ has: control });
  if (await details.getAttribute('open') === null) await details.locator('summary').click();
  await expect(control).toBeVisible();
}

test('Signed-in onboarding through a persisted completed task', { annotation: { type: 'workflow-steps', description: JSON.stringify(steps) } }, async ({ page, request }, info) => {
  const title = `QA workflow ${info.project.name} ${randomUUID().slice(0, 12)}`;
  const draft = `Workflow ${randomUUID().slice(0, 8)}`;
  let original: BoilerResponse | undefined;
  let failure: unknown;
  try {
    await step('Verify the synthetic session', async () => { const response = await request.get('/api/me/boiler'); expect(response.status()).toBe(200); original = await response.json(); });
    await step('Read the onboarding gauge', async () => { await page.goto('/onboarding'); await expect(note(page)).toBeVisible(); await expect(page.getByRole('heading', { name: 'First sync', exact: true })).toBeVisible(); });
    await step('Save an onboarding note', async () => { await note(page).fill(draft); const reply = page.waitForResponse(r => new URL(r.url()).pathname === '/api/me/status' && r.request().method() === 'PATCH'); await note(page).press('Enter'); expect((await reply).status()).toBe(200); await expect(page.getByText('Saved', { exact: true })).toBeVisible(); });
    await step('Continue to the personal workload', async () => { await page.getByRole('link', { name: 'Go to my boiler', exact: true }).click(); await expect(page).toHaveURL(/\/boiler$/); await expect(note(page)).toHaveValue(draft); });
    await step('Create a dated task', async () => {
      const tasks = page.getByRole('region', { name: 'Tasks', exact: true });
      await tasks.getByRole('textbox', { name: 'New task', exact: true }).fill(title);
      await tasks.getByRole('combobox', { name: 'Size', exact: true }).selectOption('L');
      await tasks.getByRole('combobox', { name: 'Due', exact: true }).selectOption('tomorrow');
      const reply = page.waitForResponse(r => new URL(r.url()).pathname === '/api/tasks' && r.request().method() === 'POST');
      await tasks.getByRole('button', { name: 'Add task', exact: true }).click(); expect((await reply).status()).toBe(201);
      await expect(page.getByRole('button', { name: `Complete: ${title}`, exact: true })).toBeEnabled();
    });
    await step('Verify task persistence after reopening', async () => { page = await reopen(page); await expect(page.getByRole('combobox', { name: `Size: ${title}`, exact: true })).toHaveValue('L'); });
    await step('Resize the task', async () => { const reply = page.waitForResponse(r => new URL(r.url()).pathname.startsWith('/api/tasks/') && r.request().method() === 'PATCH'); await page.getByRole('combobox', { name: `Size: ${title}`, exact: true }).selectOption('S'); expect((await reply).status()).toBe(200); page = await reopen(page); await expect(page.getByRole('combobox', { name: `Size: ${title}`, exact: true })).toHaveValue('S'); });
    await step('Complete the task', async () => { const reply = page.waitForResponse(r => new URL(r.url()).pathname.startsWith('/api/tasks/') && r.request().method() === 'PATCH'); await page.getByRole('button', { name: `Complete: ${title}`, exact: true }).click(); expect((await reply).status()).toBe(200); await completed(page, title); });
    await step('Verify completion after reopening', async () => { page = await reopen(page); await completed(page, title); const body = await (await request.get('/api/me/boiler')).json(); const task = body.tasks.find((t: { title: string }) => t.title === title); expect(task?.doneAt).toBeTruthy(); expect(task?.size).toBe('S'); });
    await step('Visit the permitted team workflow', async () => { await navigate(page, 'Teams', '/teams'); await expect(page).toHaveURL(/\/teams$/); const id = info.project.metadata.teamId as string | undefined; if (id) { await page.locator(`a[href="/teams/${id}"]`).first().click(); await expect(page.getByRole('heading', { level: 1 })).toBeVisible(); await expect(page.getByRole('heading', { name: 'New assignment', exact: true })).toHaveCount(info.project.metadata.role === 'lead' ? 1 : 0); } else await expect(page.getByRole('button', { name: 'Create team', exact: true })).toBeVisible(); });
    await step('Review source and subscription settings', async () => { await navigate(page, 'Sources', '/settings/sources'); await expect(page).toHaveURL(/\/settings\/sources$/); await expect(page.getByRole('tablist', { name: 'Source type', exact: true })).toBeVisible(); await expect(page.getByRole('heading', { name: 'Deadlines in Apple Calendar', exact: true })).toBeVisible(); });
  } catch (error) {
    failure = error;
    const path = info.outputPath('stuck.png'); await mkdir(dirname(path), { recursive: true });
    await page.screenshot({ path, timeout: 2000 }).catch(() => {});
    await info.attach('private-stuck-screen', { path, contentType: 'image/png' }).catch(() => {});
    throw error;
  } finally {
    await step('Restore test data', async () => {
      // Close the UI before restoring; no later click or debounced edit can run.
      await page.close();
      const response = await request.get('/api/me/boiler'); expect(response.status()).toBe(200);
      const body = await response.json();
      for (const task of body.tasks.filter((t: { title: string; source: string }) => t.title === title && t.source === 'manual')) expect((await request.delete(`/api/tasks/${task.id}`)).status()).toBe(200);
      if (original) expect((await request.patch('/api/me/status', { data: original.status })).status()).toBe(200);
      const verify = await (await request.get('/api/me/boiler')).json();
      expect(verify.tasks.some((t: { title: string }) => t.title === title)).toBe(false);
      if (original) expect(verify.status).toEqual(original.status);
      if (failure) info.annotations.push({ type: 'cleanup', description: 'Restored after a failed workflow' });
    });
  }
});
