import { expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAssignment, type TargetWithCounts } from '../../lib/data/teams';
import { computeTargets } from '../../app/api/teams/_lib/assignment';

it.fails('QA-006: retrying a post after a snapshot write failure repairs the recipients’ scores', async () => {
  // Inject one transient storage failure after the assignment and recipient tasks have been saved.
  // This is a data-layer fault simulation, not a claim that the live deployment had an outage.
  const now = new Date('2026-10-24T12:00:00Z');
  const input = { title: 'QA recover interrupted assignment', size: 'M' as const, due: '2026-10-25T12:00:00Z' };
  const target: TargetWithCounts = { userId: 'recipient', name: 'Synthetic recipient', visible: true,
    raw: 8, score: 61, zone: 'working', updatedAt: now.toISOString(), counts: null };
  const results = computeTargets([target], input, now);
  let assignmentSaved = false;
  let failNextSnapshot = true;
  let storedRaw = target.raw;
  let taskInserts = 0;
  const admin = {
    from(table: string) {
      if (table === 'team_assignments') return {
        insert: () => ({ select: () => ({ single: async () => {
          if (assignmentSaved) return { data: null, error: { code: '23505' } };
          assignmentSaved = true;
          return { data: { id: 'assignment' }, error: null };
        } }) }),
        select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: { id: 'assignment' }, error: null }) }) }) }),
      };
      if (table === 'tasks') return { insert: async () => { taskInserts++; return { error: null }; } };
      if (table === 'pressure_snapshots') return { upsert: async (rows: { raw: number }[]) => {
        if (failNextSnapshot) { failNextSnapshot = false; return { error: new Error('Injected transient snapshot failure') }; }
        storedRaw = rows[0].raw;
        return { error: null };
      } };
      throw new Error(`Unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;
  try { await createAssignment(admin, 'team', 'lead', input, [target], results, now, 'same-draft'); }
  catch (error) { if (!(error instanceof Error) || error.message !== 'Injected transient snapshot failure') throw error; }
  await createAssignment(admin, 'team', 'lead', input, [target], results, now, 'same-draft');
  expect(taskInserts).toBe(1); // Retrying must not duplicate tasks.
  expect(storedRaw).toBe(results[0].rawAfter); // Currently stays at the old value forever on this retry path.
});
