import { expect, test } from '@playwright/test';

test('a provisioned identity can open its boiler, teams and permitted team members', async ({ page, request }, testInfo) => {
  const teams = await request.get('/api/teams');
  expect(teams.status()).toBe(200);
  const body = await teams.json();
  expect(Array.isArray(body.teams)).toBe(true);
  const { teamId, visibleUserIds, role } = testInfo.project.metadata;
  if (teamId) {
    expect(body.teams.map((team: { id: string }) => team.id)).toEqual([teamId]);
    if (role === 'member') expect(body.teams[0].hiddenCount).toBe(0);
    const engine = await request.get(`/api/teams/${teamId}/engine-room`);
    expect(engine.status()).toBe(200);
    const room = await engine.json();
    if (role === 'member') expect(room.hiddenCount).toBe(0);
    expect(room.memberCount).toBe(room.boilers.length + room.hiddenCount);
    expect(room.boilers.map((member: { userId: string }) => member.userId).sort()).toEqual([...visibleUserIds].sort());
  } else if (visibleUserIds) expect(body.teams).toEqual([]);
  await page.goto('/boiler');
  await expect(page.getByRole('region', { name: 'Gauge and status', exact: true }).getByRole('img')).toBeVisible({ timeout: 30_000 });
  await page.goto('/teams');
  await expect(page).toHaveURL(/\/teams$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
