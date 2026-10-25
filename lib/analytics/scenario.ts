import type { LoadItem, Size } from "@/lib/types";
import type { WhatIfChange } from "./whatIf";
import { shiftIsoByLocalDays } from "./time";

/** What the preview's controls hold. Exactly one change at a time; "none" is the reset state. */
export type WhatIfScenario =
  | { kind: "none" }
  | { kind: "size"; size: Size }
  | { kind: "deadline"; days: number }
  | { kind: "complete" };

export const NO_SCENARIO: WhatIfScenario = { kind: "none" };

/** Furthest the deadline control moves a task, in local calendar days either way. */
export const MAX_DEADLINE_SHIFT_DAYS = 21;

export function clampShift(days: number): number {
  if (!Number.isFinite(days)) return 0;
  return Math.max(-MAX_DEADLINE_SHIFT_DAYS, Math.min(MAX_DEADLINE_SHIFT_DAYS, Math.trunc(days)));
}

/**
 * The deadline a shift produces. A task without a deadline shifts from the evaluation time,
 * keeping that clock time in the calendar zone.
 */
export function shiftedDeadline(task: Pick<LoadItem, "due">, days: number, now: Date, timeZone: string): string {
  return shiftIsoByLocalDays(task.due ?? now.toISOString(), clampShift(days), timeZone);
}

export function changeFromScenario(task: Pick<LoadItem, "id" | "due"> | undefined, scenario: WhatIfScenario, now: Date, timeZone: string): WhatIfChange | null {
  if (!task) return null;
  switch (scenario.kind) {
    case "none":
      return null;
    case "size":
      return { type: "size", taskId: task.id, size: scenario.size };
    case "complete":
      return { type: "complete", taskId: task.id };
    case "deadline":
      return clampShift(scenario.days) === 0 ? null : { type: "deadline", taskId: task.id, due: shiftedDeadline(task, scenario.days, now, timeZone) };
  }
}
