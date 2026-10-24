import { test, expect } from '@playwright/test';

test.use({ reducedMotion: 'no-preference' });

test('the safety valve settles after a quick drop from 100 to 0', async ({ page }) => {
  await page.goto('/');
  const slider = page.getByRole('slider', { name: 'Drag to add pressure' });
  await expect(slider).toBeEnabled();
  await page.clock.install();
  const valve = page.getByRole('main').locator('.bp-flutter').first();
  const lift = valve.locator('.bp-lift');

  for (let attempt = 0; attempt < 3; attempt++) {
    await slider.press('End');
    await expect(slider).toHaveValue('100');
    await expect(valve).toHaveCSS('--flutter', '-4px');
    await slider.press('Home');
    await expect(slider).toHaveValue('0');
    await page.clock.runFor(2000);
    await expect(valve).toHaveCSS('--flutter', '0px');
    await expect(valve).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
    await expect(lift).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  }
});

test('changing the score within Redline preserves the whistle shutoff', async ({ page }) => {
  await page.goto('/');
  const slider = page.getByRole('slider', { name: 'Drag to add pressure' });
  await expect(slider).toBeEnabled();
  await page.clock.install();
  const valve = page.getByRole('main').locator('.bp-flutter').first();

  await slider.press('End');
  await expect(valve).toHaveCSS('--flutter', '-4px');
  await slider.press('ArrowLeft');
  await expect(slider).toHaveValue('99');
  await page.clock.runFor(2000);
  // Redline keeps its regular pressure flutter after the brief whistle ends.
  await expect(valve).toHaveCSS('--flutter', '-5px');
  await expect(valve).toHaveCSS('--dur', '0.12s');
});
