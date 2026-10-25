import { test, expect } from '@playwright/test';
import { teamUiRoom } from '../fixtures/team-ui';

test('team checkboxes combine zones and statuses and restore all members', async ({ page }) => {
  await page.route(`**/api/teams/${teamUiRoom.team.id}/engine-room`, route => route.fulfill({ json: teamUiRoom }));
  await page.goto(`/qa-workflows?view=engine&team=${teamUiRoom.team.id}`);
  const boilers = page.getByRole('region', { name: 'Members boilers', exact: true });
  const zones = page.getByRole('group', { name: 'Filter by zone', exact: true });
  const statuses = page.getByRole('group', { name: 'Filter by status', exact: true });
  const allZones = zones.getByRole('checkbox', { name: /^All/ });
  const allStatuses = statuses.getByRole('checkbox', { name: 'Any status', exact: true });
  await expect(boilers.getByRole('article')).toHaveCount(4);
  await allZones.uncheck();
  await expect(boilers.getByRole('article')).toHaveCount(0);
  await zones.getByRole('checkbox', { name: /^Redline/ }).check();
  await zones.getByRole('checkbox', { name: /^Hot/ }).check();
  await expect(allZones).toBeChecked({ indeterminate: true });
  await expect(boilers.getByRole('heading', { level: 2 })).toHaveText([/Ari/, 'Bea']);
  await allStatuses.uncheck();
  await statuses.getByRole('checkbox', { name: 'Heads down', exact: true }).check();
  await expect(boilers.getByRole('heading', { level: 2 })).toHaveText(['Bea']);
  await statuses.getByRole('checkbox', { name: 'Open for work', exact: true }).check();
  await zones.getByRole('checkbox', { name: /^Cool/ }).check();
  await expect(boilers.getByRole('heading', { level: 2 })).toHaveText(['Bea', 'Cam']);
  await allZones.check();
  await allStatuses.check();
  await expect(boilers.getByRole('article')).toHaveCount(4);
  await expect(boilers.getByRole('heading', { name: 'New member', exact: true })).toBeVisible();
});
