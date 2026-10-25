import type { Size, Zone } from "@/lib/types";
import { scoreFromRaw, taskPoints, zoneFor } from "./compute";

/**
 * Assignment preview: add a new task's pressure to a member's stored raw R and re-map.
 * No calendar is re-read. Uses the same task formula as computePressure.
 */
export function applyTaskToRaw(
  raw: number,
  task: { due: string; size: Size; title?: string },
  now: Date,
): { score: number; zone: Zone; raw: number } {
  const next = raw + taskPoints(task, now);
  const score = scoreFromRaw(next);
  return { score, zone: zoneFor(score), raw: next };
}
