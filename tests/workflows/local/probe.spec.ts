import { test, expect } from '@playwright/test';
import { world } from './world';
// Deliberate diagnostic, excluded from normal product checks. Its command must
// fail, with the report identifying the blocked step rather than a green result.
test('Diagnostic: an unavailable service blocks progress', { annotation: { type: 'workflow-steps', description: JSON.stringify(['Open the workload', 'Wait for the stuck task save', 'Complete the task', 'Restore test data']) } }, async ({ page, context }) => {
  const service = world(); await service.connect(context);
  try {
    await test.step('Open the workload', async () => { await page.goto('/qa-workflows'); await expect(page.getByRole('button', { name: 'Add task', exact: true })).toBeVisible(); });
    await context.route('**/api/tasks', route => route.fulfill({ status: 503, json: { error: 'Diagnostic stalled service' } }));
    await test.step('Wait for the stuck task save', async () => {
      await page.getByRole('textbox', { name: 'New task', exact: true }).fill('Diagnostic task');
      await page.getByRole('button', { name: 'Add task', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Complete: Diagnostic task', exact: true })).toBeEnabled({ timeout: 2500 });
    }, { timeout: 4000 });
    await test.step('Complete the task', async () => { throw new Error('Unreachable diagnostic step'); });
  } finally { await test.step('Restore test data', async () => { service.reset(); }); }
});
