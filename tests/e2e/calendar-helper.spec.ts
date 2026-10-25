import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';
import { noOverflow } from './helpers';

const scanner = readFileSync('browser-helper/scan.js', 'utf8').replace('export function', 'function');
async function scan(page: Page) {
  return page.evaluate(() => (window as unknown as { scanCalendarPage: () => { candidates: { url: string }[]; provider: string } }).scanCalendarPage());
}

test('class schedule has its own guide and returns to the schedule import', async ({ page }, info) => {
  await page.goto('/calendar-helper?guide=schedule');
  await expect(page.getByRole('heading', { level: 1, name: 'Find your class schedule', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Get your Brightspace schedule link', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Sources', exact: true })).toHaveAttribute('href', '/settings/sources#class-schedule');
  await expect(page.getByText('Import schedule', { exact: true })).toBeVisible();
  if (process.env.SOURCES_SCREENSHOTS) {
    await mkdir(process.env.SOURCES_SCREENSHOTS, { recursive: true });
    await page.screenshot({ path: `${process.env.SOURCES_SCREENSHOTS}/schedule-guide-${info.project.name}.png`, fullPage: true, animations: 'disabled' });
  }
  await noOverflow(page);
});
for (const [provider, url] of [
  ['Brightspace', 'https://school.example.edu/d2l/le/calendar/feed/user/feed.ics?token=fictional'],
  ['Canvas', 'https://school.example.edu/feeds/calendars/user_fake.ics'],
  ['Moodle', 'https://school.example.edu/calendar/export_execute.php?authtoken=fictional'],
  ['Blackboard', 'https://school.example.edu/webapps/calendar/calendarFeed/fake/learn.ics'],
] as const) {
  test(`Calendar Finder detects ${provider} in a revealed feed dialog without changing the school page`, async ({ page }) => {
    await page.setContent(`<h1>Fictional school calendar</h1><button type="button" onclick="document.querySelector('section').hidden=false">Show subscription</button><section hidden><label>Subscription link<input readonly value="${url}"></label><a href="${url}">Subscribe</a></section><input type="password" value="https://school.example.edu/password.ics"><input hidden value="https://school.example.edu/hidden.ics"><a hidden href="https://school.example.edu/hidden-link.ics">Hidden</a>`);
    await page.addScriptTag({ content: scanner });
    expect((await scan(page)).candidates).toEqual([]);
    await page.getByRole('button', { name: 'Show subscription' }).click();
    const before = await page.locator('body').innerHTML();
    const result = await scan(page);
    expect(result.provider).toBe(provider);
    expect(result.candidates.map(c => c.url)).toEqual([url]);
    expect(await page.locator('body').innerHTML()).toBe(before);
  });
}

test('Calendar Finder traverses open shadow roots and skips executable and private-address links', async ({ page }) => {
  await page.setContent('<h1>Fictional school</h1><div id="calendar"></div><a href="javascript:alert(1)">Bad</a><a href="https://user:password@school.example.edu/private.ics">Credentials</a><a href="https://127.0.0.1/local.ics">Local</a>');
  await page.locator('#calendar').evaluate(el => { el.attachShadow({ mode: 'open' }).innerHTML = '<a href="https://school.example.edu/schedule.ics">My timetable</a>'; });
  await page.addScriptTag({ content: scanner });
  expect((await scan(page)).candidates.map(c => c.url)).toEqual(['https://school.example.edu/schedule.ics']);
});

test('helper handoff is public, strips the fragment, retains a sign-in draft and allows discard', async ({ page, request }) => {
  const feed = 'https://school.example.edu/feeds/calendars/user_fake.ics';
  await page.goto(`/calendar-helper#feed=${encodeURIComponent(feed)}`);
  await expect(page.getByRole('heading', { name: 'Review your calendar link' })).toBeVisible();
  await expect(page).toHaveURL(/\/calendar-helper$/);
  const draft = await page.evaluate(() => JSON.parse(sessionStorage.getItem('boiler:calendar-helper:v1') || 'null'));
  expect(draft.url).toBe(feed);
  await expect(page.getByRole('link', { name: 'Sign in with Google', exact: true })).toHaveAttribute('href', '/auth/signin?next=%2Fcalendar-helper');
  await noOverflow(page);
  const download = await request.get('/downloads/boiler-calendar-helper.zip');
  expect(download.status()).toBe(200);
  expect((await download.body()).readUInt32LE(0)).toBe(0x04034b50);
  await page.getByRole('button', { name: 'Discard this link', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review your calendar link' })).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('boiler:calendar-helper:v1'))).toBeNull();
  await expect(page.getByRole('heading', {name:'Find a link in your browser'})).toBeFocused();
});


test('an already-open helper receives a new link in the same tab', async ({ page }) => {
  await page.goto('/calendar-helper');
  await expect(page.getByText('Checking for a calendar link…')).toHaveCount(0);
  await page.goto('/calendar-helper#feed=' + encodeURIComponent('https://school.example.edu/fresh.ics'));
  await expect(page.getByRole('heading', {name:'Review your calendar link'})).toBeVisible();
  await expect(page).toHaveURL(/\/calendar-helper$/);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('boiler:calendar-helper:v1') || 'null').url)).toBe('https://school.example.edu/fresh.ics');
});
