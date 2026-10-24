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


test('liquid keeps its wave phase while pressure changes slowly or crosses zones', async ({ page }) => {
  await page.goto('/');
  const slider = page.getByRole('slider', { name: 'Drag to add pressure' });
  await expect(slider).toBeEnabled();
  await slider.focus();
  const initial = await page.evaluate(async () => {
    const layers = ['.bp-wave-r', '.bp-wave-l', '.bp-bob'];
    return Promise.all(layers.map(async (selector) => {
      const animation = document.querySelector(selector)!.getAnimations()[0]!;
      animation.pause();
      await animation.ready;
      const duration = Number(animation.effect!.getTiming().duration);
      animation.currentTime = duration * 20.37;
      return { duration, progress: animation.effect!.getComputedTiming().progress };
    }));
  });
  for (const key of ['ArrowRight', 'ArrowRight', 'End', 'ArrowLeft', 'Home']) {
    await slider.press(key);
    const current = await page.evaluate(() => ['.bp-wave-r', '.bp-wave-l', '.bp-bob'].map((selector) => {
      const animation = document.querySelector(selector)!.getAnimations()[0]!;
      return { duration: Number(animation.effect!.getTiming().duration), progress: animation.effect!.getComputedTiming().progress };
    }));
    for (let i = 0; i < initial.length; i++) {
      expect(current[i]!.duration, 'Changing pressure must preserve the wave period').toBe(initial[i]!.duration);
      expect(current[i]!.progress, 'Changing pressure must preserve the existing phase').toBeCloseTo(initial[i]!.progress!, 2);
    }
  }
});


test('pressure dividers match the zone boundaries and the readout sits below the slider', async ({ page }) => {
  await page.goto('/');
  const slider = page.getByRole('slider', { name: 'Drag to add pressure' });
  await expect(slider).toBeEnabled();
  const control = page.locator('.bp-pressure-control');
  const rail = await control.locator('.bp-pressure-track').boundingBox();
  const dividers = control.locator('.bp-pressure-divider');
  await expect(dividers).toHaveCount(3);
  for (const [index, threshold] of [40, 70, 90].entries()) {
    const divider = await dividers.nth(index).boundingBox();
    expect(Math.abs(divider!.x + divider!.width / 2 - (rail!.x + rail!.width * threshold / 100))).toBeLessThan(0.6);
  }
  const input = await slider.boundingBox();
  const label = await page.locator('label[for="pressure"]').boundingBox();
  const output = await page.locator('output[for="pressure"]').boundingBox();
  expect(label!.y).toBeGreaterThanOrEqual(input!.y + input!.height);
  expect(output!.y).toBeGreaterThanOrEqual(input!.y + input!.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('high pressure adds less than a pixel of rail motion without moving the input and respects reduced motion', async ({ page }) => {
  await page.goto('/');
  const slider = page.getByRole('slider', { name: 'Drag to add pressure' });
  await expect(slider).toBeEnabled();
  await slider.press('End');
  const track = page.locator('.bp-pressure-track');
  await expect(track).toHaveCSS('animation-name', 'bp-pressure-shake');
  const before = await slider.boundingBox();
  const amplitude = await track.evaluate(async (element) => {
    let max = 0;
    for (let frame = 0; frame < 25; frame++) {
      await new Promise(requestAnimationFrame);
      const transform = getComputedStyle(element).transform;
      if (transform !== 'none') max = Math.max(max, Math.abs(new DOMMatrixReadOnly(transform).m41));
    }
    return max;
  });
  expect(amplitude).toBeGreaterThan(0.05);
  expect(amplitude).toBeLessThanOrEqual(0.51);
  const after = await slider.boundingBox();
  expect(after!.x).toBeCloseTo(before!.x, 2);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(track).toHaveCSS('animation-name', 'none');
  await expect(track).toHaveCSS('transform', 'none');
  await expect(page.locator('.bp-wave-r').first()).toHaveCSS('animation-name', 'none');
  await expect(page.locator('output[for="pressure"]')).toContainText('100%');
});
