import type { SupabaseClient } from "@supabase/supabase-js";
import type { Size, Zone } from "@/lib/types";

// Stand-in for the engine track's lib/pressure. Signatures match the engine's so the
// merge is an import swap:
// TODO(merge): replace this file's body with
//   export { applyTaskToRaw } from "@/lib/pressure/preview";
//   export { syncUser } from "<engine's syncUser module>";
// and read constants from lib/pressure/config.ts (the engine is retuning K and weights).

export const STUB_CONFIG = {
  sizePoints: { S: 2, M: 4, L: 8 } as Record<Size, number>,
  urgency: { floorDays: 0.25, cap: 3 },
  noDueDays: 7,
  K: 25,
  zones: { working: 40, hot: 70, redline: 90 },
};

const DAY_MS = 86_400_000;

export function zoneFor(score: number): Zone {
  const z = STUB_CONFIG.zones;
  if (score >= z.redline) return "redline";
  if (score >= z.hot) return "hot";
  if (score >= z.working) return "working";
  return "cool";
}

export function scoreFor(raw: number): number {
  return Math.round(100 * (1 - Math.exp(-Math.max(raw, 0) / STUB_CONFIG.K)));
}

// Task points: sizePoints × urgency, where urgency = 1 / max(days until due, floor),
// capped; overdue tasks get the cap. A task with no due date counts as due in 7 days.
export function taskPoints(task: { due?: string | null; size: Size }, now: Date): number {
  const { floorDays, cap } = STUB_CONFIG.urgency;
  const dueMs = task.due ? Date.parse(task.due) : now.getTime() + STUB_CONFIG.noDueDays * DAY_MS;
  const days = (dueMs - now.getTime()) / DAY_MS;
  const urgency = days < 0 ? cap : Math.min(cap, 1 / Math.max(days, floorDays));
  return STUB_CONFIG.sizePoints[task.size] * urgency;
}

export function applyTaskToRaw(
  raw: number,
  task: { due?: string | null; size: Size },
  now: Date,
): { score: number; zone: Zone; raw: number } {
  const next = raw + taskPoints(task, now);
  const score = scoreFor(next);
  return { score, zone: zoneFor(score), raw: next };
}

// Stand-in for the engine's full resync (fetch Google + tasks, compute, upsert snapshot).
// Until it merges, the assignment route bumps snapshots with applyTaskToRaw instead.
export async function syncUser(
  _admin: SupabaseClient,
  _userId: string,
  _now: Date,
): Promise<{ synced: boolean }> {
  return { synced: false };
}
