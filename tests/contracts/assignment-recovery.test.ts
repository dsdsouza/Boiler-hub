import { expect, it, vi } from 'vitest';
import { PRESSURE_MODEL_VERSION } from '../../lib/pressure/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAssignment, type TargetWithCounts } from '../../lib/data/teams';
import { computeTargets } from '../../app/api/teams/_lib/assignment';

it('QA-006: failed atomic posts can be retried with the same draft key', async () => {
  const now = new Date('2026-10-24T12:00:00Z');
  const input = { title: 'QA recover interrupted assignment', size: 'M' as const, due: '2026-10-25T12:00:00Z' };
  const target: TargetWithCounts = { userId: 'recipient', name: 'Synthetic recipient', visible: true,
    raw: 8, score: 61, zone: 'working', updatedAt: now.toISOString(), counts: { meetings: 0, meetingHours: 0, tasksDue: 1, overdue: 0 } };
  const results = computeTargets([target], input, now);
  const rpc = vi.fn().mockResolvedValueOnce({ error: { code: 'XX000', message: 'Injected storage failure' } })
    .mockResolvedValueOnce({ data: { assignmentId: 'assignment', duplicate: false }, error: null });
  const admin = { rpc } as unknown as SupabaseClient;
  await expect(createAssignment(admin, 'team', 'lead', input, [target], results, now, 'same-draft')).rejects.toMatchObject({ code: 'XX000' });
  await expect(createAssignment(admin, 'team', 'lead', input, [target], results, now, 'same-draft')).resolves.toMatchObject({ assignmentId: 'assignment', duplicate: false });
  expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
  expect(rpc.mock.calls[1][1].p_changes[0]).toMatchObject({ before: { raw: 8 }, after: { raw: results[0].rawAfter } });
});

it('re-reads and recomputes a competing snapshot, counting deadlines across the full preparation window', async () => {
  const now = new Date('2026-10-24T12:00:00Z');
  const input = { title: 'Ten-day deadline', size: 'M' as const, due: '2026-11-03T12:00:00Z' };
  const old: TargetWithCounts = { userId: 'recipient', name: 'Recipient', visible: true, raw: 8, score: 61,
    zone: 'working', updatedAt: now.toISOString(), counts: { meetings: 0, meetingHours: 0, tasksDue: 0, overdue: 0 } };
  const rpc = vi.fn().mockResolvedValueOnce({ error: { code: '40001' } })
    .mockResolvedValueOnce({ data: { assignmentId: 'assignment', duplicate: false }, error: null });
  const admin = { rpc, from(table: string) {
    const data = table === 'memberships' ? [{ user_id: 'recipient', visibility: 'everyone' }]
      : table === 'profiles' ? [{ id: 'recipient', name: 'Recipient' }]
      : [{ user_id: 'recipient', raw: 12, score: 76, zone: 'hot', counts: { pressureModel: PRESSURE_MODEL_VERSION }, computed_at: now.toISOString() }];
    const chain = { eq: () => chain, in: async () => ({ data, error: null }), then: (resolve: (v: unknown) => void) => resolve({ data, error: null }) };
    return { select: () => chain };
  } } as unknown as SupabaseClient;
  const result = await createAssignment(admin, 'team', 'lead', input, [old], computeTargets([old], input, now), now, 'draft');
  expect(rpc).toHaveBeenCalledTimes(2);
  const change = rpc.mock.calls[1][1].p_changes[0];
  expect(change.before).toMatchObject({ raw: 12, counts: { pressureModel: PRESSURE_MODEL_VERSION } });
  expect(change.after.raw).toBe(computeTargets([{ ...old, raw: 12 }], input, now)[0].rawAfter);
  expect(change.after.counts.tasksDue).toBe(1);
  expect(result.targets[0].raw).toBe(12);
});
