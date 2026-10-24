import { expect, test } from '@playwright/test';

test('a provisioned identity can open its boiler, teams and permitted team members', async ({ page, request }, testInfo) => {
  const teams = await request.get('/api/teams');
  expect(teams.status()).toBe(200);
  const body = await teams.json();
  expect(Array.isArray(body.teams)).toBe(true);
  const { teamId, visibleUserIds } = testInfo.project.metadata;
  if (teamId) {
    expect(body.teams.map((team: { id: string }) => team.id)).toEqual([teamId]);
    const engine = await request.get(`/api/teams/${teamId}/engine-room`);
    expect(engine.status()).toBe(200);
    const room = await engine.json();
    expect(room.boilers.map((member: { userId: string }) => member.userId).sort()).toEqual([...visibleUserIds].sort());
  } else if (visibleUserIds) expect(body.teams).toEqual([]);
  await page.goto('/boiler');
  await expect(page.getByRole('region', { name: 'Gauge and status', exact: true }).getByRole('img')).toBeVisible({ timeout: 30_000 });
  await page.goto('/teams');
  await expect(page).toHaveURL(/\/teams$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('QA-003 live aggregate counts respect the caller’s role and anonymity threshold', async ({ request }, testInfo) => {
  const { teamId, hiddenCount } = testInfo.project.metadata;
  const teams = await request.get('/api/teams');
  expect(teams.status()).toBe(200);
  const listed = (await teams.json()).teams;
  if (!teamId) {
    // A single supplied storage state may belong to any role or team.
    for (const team of listed) {
      expect(team.role === 'lead' ? team.hiddenCount === 0 || team.hiddenCount >= 2 : team.hiddenCount === 0).toBe(true);
    }
    return;
  }
  const response = await request.get(`/api/teams/${teamId}/engine-room`);
  expect(response.status()).toBe(200);
  const team = listed.find((entry: { id: string }) => entry.id === teamId);
  expect([(await response.json()).hiddenCount, team.hiddenCount]).toEqual([hiddenCount, hiddenCount]);
});
