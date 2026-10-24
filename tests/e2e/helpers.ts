import { expect, type Page } from '@playwright/test';

export const gauge = (page: Page) => page.getByRole('region', { name: 'Gauge and status', exact: true }).getByRole('img');
export async function score(page: Page) {
  const label = await gauge(page).getAttribute('aria-label');
  const value = label?.match(/pressure (\d+)/)?.[1];
  if (value === undefined) throw new Error(`Gauge has no numeric accessible pressure: ${label}`);
  return Number(value);
}
export async function openDemo(page: Page) {
  await page.goto('/demo');
  await expect(gauge(page)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Post to / })).toBeEnabled();
}
export async function addTask(page: Page, title: string, size = 'M', due = 'tomorrow') {
  const tasks = page.getByRole('region', { name: 'Tasks', exact: true });
  await tasks.getByRole('textbox', { name: 'New task', exact: true }).fill(title);
  await tasks.getByRole('combobox', { name: 'Size', exact: true }).selectOption(size);
  await tasks.getByRole('combobox', { name: 'Due', exact: true }).selectOption(due);
  await tasks.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(tasks.getByRole('button', { name: `Complete: ${title}`, exact: true })).toBeVisible();
}
export async function noOverflow(page: Page) {
  const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
}
