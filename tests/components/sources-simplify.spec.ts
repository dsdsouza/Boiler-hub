import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { world } from '../workflows/local/world';

test('calendar source tabs retain drafts, link to the right guides, and recover from a failed connection', async ({ page, context }, info) => {
  const service = world(); await service.connect(context);
  await page.goto('/qa-workflows?view=sources');
  const tabs = page.getByRole('tablist', { name: 'Source type', exact: true });
  await expect(tabs.getByRole('tab')).toHaveCount(2);
  const schedule = tabs.getByRole('tab', { name: 'Class schedule', exact: true });
  const calendar = tabs.getByRole('tab', { name: 'Calendar feed', exact: true });
  const panel = page.getByRole('tabpanel');
  await expect(panel.getByRole('link', { name: 'How to find your school calendar link', exact: true })).toHaveAttribute('href', '/calendar-helper?guide=schedule');
  const draft = 'https://school.example.edu/d2l/le/calendar/feed/user/feed.ics?token=fictional-draft';
  await panel.getByRole('textbox', { name: 'Brightspace subscription link', exact: true }).fill(draft);
  if (process.env.SOURCES_SCREENSHOTS) {
    await mkdir(process.env.SOURCES_SCREENSHOTS, { recursive: true });
    await page.screenshot({ path: `${process.env.SOURCES_SCREENSHOTS}/sources-schedule-${info.project.name}.png`, fullPage: true, animations: 'disabled' });
  }
  await schedule.focus(); await schedule.press('ArrowRight');
  await expect(calendar).toBeFocused();
  await expect(panel.getByRole('link', { name: 'How to find your school calendar link', exact: true })).toHaveAttribute('href', '/calendar-helper');
  await panel.getByRole('textbox', { name: 'Calendar feed link (.ics or webcal://)', exact: true }).fill('https://school.example.edu/course.ics');
  await panel.getByRole('textbox', { name: 'Name (optional)', exact: true }).fill('Semester calendar');
  await calendar.focus(); await calendar.press('ArrowLeft');
  await expect(panel.getByRole('textbox', { name: 'Brightspace subscription link', exact: true })).toHaveValue(draft);
  await schedule.press('End'); await expect(calendar).toBeFocused();
  await expect(panel.getByRole('textbox', { name: 'Name (optional)', exact: true })).toHaveValue('Semester calendar');
  await expect(page.getByText(/^How to:/)).toHaveCount(0);
  await expect(page.getByText('Find your Brightspace link', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'GitHub', exact: true })).toHaveCount(0);
  if (process.env.SOURCES_SCREENSHOTS) await page.screenshot({ path: `${process.env.SOURCES_SCREENSHOTS}/sources-calendar-${info.project.name}.png`, fullPage: true, animations: 'disabled' });
  service.failOnce('POST /api/sources');
  await panel.getByRole('button', { name: 'Add feed', exact: true }).click();
  await expect(panel.getByText('Workflow service temporarily unavailable. Try again.', { exact: true })).toBeVisible();
  await expect(panel.getByRole('textbox', { name: 'Name (optional)', exact: true })).toHaveValue('Semester calendar');
  await panel.getByRole('button', { name: 'Add feed', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Test Semester calendar', exact: true })).toBeVisible();
  expect(service.users[0].sources).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => innerWidth));
});

test('a retired source can be removed but cannot be tested or reconnected', async ({ page, context }) => {
  const service = world(); await service.connect(context);
  service.users[0].sources.push({ id: '11111111-1111-4111-8111-111111111111', kind: 'github', label: 'Retired source', coursework: false, status: 'ok', error: null, lastSyncedAt: null });
  await page.goto('/qa-workflows?view=sources');
  await expect(page.getByText('Disconnected', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Test Retired source', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Remove Retired source', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm removal', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove Retired source', exact: true })).toHaveCount(0);
  expect(service.users[0].sources).toHaveLength(0);
});
