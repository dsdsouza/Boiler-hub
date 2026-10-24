import type { Size, Weight, Zone } from "@/lib/types";
import { zoneOf } from "@/components/ui/zones";

// TODO(merge): local stand-ins for lib/pressure (engine track). Same constants
// and signatures as the PRD so the swap is an import change. They only drive
// optimistic UI updates and the demo; the server result always wins.

export const K = 25;
export const SIZE_POINTS: Record<Size, number> = { S: 2, M: 4, L: 8 };
export const WEIGHT_MULT: Record<Weight, number> = { light: 0.5, normal: 1, heavy: 1.6 };
export const WEIGHT_LABEL: Record<Weight, string> = { light: "Light", normal: "Normal", heavy: "Heavy" };

const DAY = 86_400_000;

export function scoreFromRaw(raw: number): number {
  return Math.round(100 * (1 - Math.exp(-Math.max(raw, 0) / K)));
}

/** Inverse of scoreFromRaw, capped so 100 stays finite. */
export function rawFromScore(score: number): number {
  return -K * Math.log(1 - Math.min(Math.max(score, 0), 99.5) / 100);
}

export function daysUntil(iso: string, now: Date): number {
  return (new Date(iso).getTime() - now.getTime()) / DAY;
}

/** 1 / max(days until due, 0.25), capped at 3; overdue = 3. */
export function taskUrgency(due: string, now: Date): number {
  const d = daysUntil(due, now);
  if (d < 0) return 3;
  return Math.min(3, 1 / Math.max(d, 0.25));
}

export function taskPoints(size: Size, due: string, now: Date): number {
  return SIZE_POINTS[size] * taskUrgency(due, now);
}

/** Completed in the last 48 h: release of 0.5 × size points, fading to 0. */
export function completedRelease(size: Size, doneAt: string, now: Date): number {
  const age = (now.getTime() - new Date(doneAt).getTime()) / (48 * 3_600_000);
  return -0.5 * SIZE_POINTS[size] * Math.max(0, 1 - Math.max(0, age));
}

export function applyTaskToRaw(raw: number, task: { due: string; size: Size }, now: Date): { score: number; zone: Zone } {
  const score = scoreFromRaw(raw + taskPoints(task.size, task.due, now));
  return { score, zone: zoneOf(score) };
}

export function dueText(due: string, now: Date): string {
  const d = daysUntil(due, now);
  if (d < 0) return "overdue";
  const dueDay = new Date(due);
  const today = new Date(now);
  const dayDiff = Math.round(
    (new Date(dueDay.getFullYear(), dueDay.getMonth(), dueDay.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      DAY,
  );
  if (dayDiff <= 0) return "due today";
  if (dayDiff === 1) return "due tomorrow";
  return `due in ${dayDiff} days`;
}
