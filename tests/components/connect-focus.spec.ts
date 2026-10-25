import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { world } from '../workflows/local/world';

const focus = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'Focus with Pip', exact: true });

test('Connect owns focus setup and completing focus updates the same My Boiler task', async ({ page, context }, info) => {
  const service = world(); await service.connect(context);
  service.users[0].tasks.push({ id: '00000000-0000-4000-a000-000000000099', title: 'Prepare the class presentation', dueAt: new Date(Date.now() + 86400000).toISOString(), size: 'M', source: 'manual', assignmentId: null, doneAt: null });
  await page.goto('/qa-workflows?view=boiler');
  await expect(page.getByRole('heading', { name: 'My Boiler', exact: true })).toBeVisible();
  await expect(focus(page)).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Workflow pages' }).getByRole('link', { name: 'Connect', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Connect', exact: true })).toBeVisible();
  await expect(focus(page).getByRole('combobox', { name: 'One task', exact: true })).toHaveValue(service.users[0].tasks[0].id);
  if (process.env.CONNECT_SCREENSHOTS) {
    await mkdir(process.env.CONNECT_SCREENSHOTS, { recursive: true });
    await page.screenshot({ path: `${process.env.CONNECT_SCREENSHOTS}/connect-${info.project.name}.png`, fullPage: true, animations: 'disabled' });
  }
  await focus(page).getByRole('button', { name: 'Start focus', exact: true }).click();
  await expect(focus(page).getByRole('status')).toContainText('Time to come back. One small step.');
  await focus(page).getByRole('checkbox', { name: 'I finished the whole assignment', exact: true }).check();
  await focus(page).getByRole('button', { name: 'Mark done & release', exact: true }).click();
  await expect(focus(page).getByText('You followed through. Your task is marked done and the focus block is released.', { exact: true })).toBeVisible();
  expect(service.users[0].tasks[0].doneAt).toBeTruthy();
  await page.getByRole('navigation', { name: 'Workflow pages' }).getByRole('link', { name: 'boiler', exact: true }).click();
  await expect(focus(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mark not done: Prepare the class presentation', exact: true, includeHidden: true })).toHaveCount(1);
});

test('Connect can recover task loading and points empty focus setup back to My Boiler', async ({ page, context }) => {
  const service = world(); await service.connect(context);
  service.failOnce('GET /api/me/boiler');
  await page.goto('/qa-workflows?view=sources');
  await expect(focus(page).getByRole('alert')).toContainText('temporarily unavailable');
  await focus(page).getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(focus(page).getByRole('link', { name: 'My Boiler', exact: true })).toHaveAttribute('href', '/boiler');
  await focus(page).getByText('Connect the focus extension', { exact: true }).click();
  await expect(focus(page).getByRole('link', { name: 'Download focus extension', exact: true })).toBeVisible();
  await expect(focus(page)).toContainText('Then reload Connect.');
});
