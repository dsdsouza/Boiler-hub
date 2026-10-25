import { test, expect } from '@playwright/test';
import { inspectKeyboardFocus } from './inspect';

test('focus inspection keeps each control identity when loading changes the enabled controls', async ({ page }) => {
  page.setDefaultTimeout(1_500);
  await page.setContent(`
    <style>button:focus { outline: 3px solid #936700; }</style>
    <main data-qa-app>
      <button id="refresh">Refresh</button>
      <button id="middle">Previous month</button>
      <button id="last">Today</button>
    </main>
    <script>
      document.getElementById('middle').addEventListener('focus', () => {
        document.getElementById('refresh').setAttribute('aria-disabled', 'true');
      });
    </script>
  `);
  expect(await inspectKeyboardFocus(page)).toEqual([]);
  await expect(page.getByRole('button', { name: 'Today', exact: true })).toBeFocused();
});

test('focus inspection still reports a control that actually loses focus', async ({ page }) => {
  await page.setContent(`
    <style>button:focus { outline: 3px solid #936700; }</style>
    <main data-qa-app><button id="loses-focus">Unstable control</button></main>
    <script>
      document.getElementById('loses-focus').addEventListener('focus', event => event.target.blur());
    </script>
  `);
  expect(await inspectKeyboardFocus(page)).toEqual([
    expect.objectContaining({ rule: 'keyboard-focus' }),
  ]);
});
