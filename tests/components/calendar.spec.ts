import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('month navigation, day selection, midnight zones and keyboard use retain the full month', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-24T16:00:00Z') });
  await page.route('**/api/me/boiler', route => route.fulfill({ status: 401, json: { error: 'fixture' } }));
  await page.route('**/api/calendar/month?**', route => {
    const month = new URL(route.request().url()).searchParams.get('month');
    const deadlines = month === '2026-10' ? [
      { id: 'one', title: 'Research reflection and annotated bibliography for the semester project', dueAt: '2026-10-25T21:00:00Z', source: 'ics', course: 'Writing 101' },
      { id: 'two', title: 'Team project review', dueAt: '2026-10-26T00:30:00Z', source: 'team', course: 'Design studio' },
    ] : [{ id: 'end', title: 'End-of-month assignment', dueAt: '2026-11-30T23:00:00Z', source: 'manual' }];
    return route.fulfill({ json: { deadlines, unavailableSources: 0, truncated: false } });
  });
  await page.goto('/qa-components?mode=calendar');
  await expect(page.getByRole('heading', { name: 'October 2026' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '2 open deadlines' })).toBeVisible();
  const day = page.getByRole('button', { name: 'Sunday, October 25, 2026, 2 deadlines', exact: true });
  await day.click();
  await expect(page.getByText('Team project review', { exact: true }).last()).toBeVisible();
  await expect(page.locator('time').filter({ hasText: '8:30 PM' })).toBeVisible();
  await day.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Monday, October 26, 2026, 0 deadlines', exact: true })).toBeFocused();
  await day.click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => innerWidth));
  if (process.env.CALENDAR_SCREENSHOTS) {
    await mkdir(process.env.CALENDAR_SCREENSHOTS, { recursive: true });
    await page.screenshot({ path: `${process.env.CALENDAR_SCREENSHOTS}/calendar-${test.info().project.name}.png`, fullPage: true });
  }
  await page.getByRole('button', { name: 'Next month', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'November 2026' })).toBeVisible();
  await page.getByRole('button', { name: 'Monday, November 30, 2026, 1 deadline', exact: true }).click();
  await expect(page.getByText('End-of-month assignment', { exact: true }).last()).toBeVisible();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'October 2026' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Saturday, October 24, 2026, 0 deadlines', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('a failed month load can recover and distinguish an empty calendar', async ({ page }) => {
  let fail = true;
  await page.route('**/api/me/boiler', route => route.fulfill({ status: 401, json: { error: 'fixture' } }));
  await page.route('**/api/calendar/month?**', route => route.fulfill({ status: fail ? 503 : 200, json: fail ? { error: 'unavailable' } : { deadlines: [], unavailableSources: 0, truncated: false } }));
  await page.goto('/qa-components?mode=calendar');
  await expect(page.getByRole('region', { name: 'Deadline calendar', exact: true }).getByRole('alert')).toContainText('Your deadlines couldn’t load');
  fail = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Deadline calendar', exact: true }).getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('No deadlines on this day. This month has no open deadlines.', { exact: true })).toBeVisible();
});
