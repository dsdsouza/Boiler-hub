import type { LoadItem } from "@/lib/types";

// Clearly synthetic sample week for /what-if-preview. Not a real user, school or calendar.
// A fixed evaluation time keeps the preview deterministic. Monday 10:00 Eastern; the forecast
// week crosses the 1 Nov 2026 daylight-saving change on purpose.

export const SYNTHETIC_NOW = new Date("2026-10-26T14:00:00Z");
export const SYNTHETIC_TIME_ZONE = "America/New_York";
export const SYNTHETIC_SOURCE_LABEL = "Sample LMS";

const cls = (id: string, title: string, start: string, end: string, attendees: number): LoadItem => ({
  id,
  kind: "event",
  source: "google",
  title,
  start,
  end,
  attendees,
  isRecurring: true,
});

function build(): LoadItem[] {
  return [
    cls("syn-e-calc-mon", "Sample Calculus lecture", "2026-10-26T15:00:00-04:00", "2026-10-26T16:00:00-04:00", 30),
    cls("syn-e-bio-tue", "Sample Biology lecture", "2026-10-27T10:00:00-04:00", "2026-10-27T11:30:00-04:00", 40),
    cls("syn-e-calc-wed", "Sample Calculus lecture", "2026-10-28T10:00:00-04:00", "2026-10-28T11:00:00-04:00", 30),
    cls("syn-e-chem-lab-thu", "Sample Chemistry lab", "2026-10-29T13:00:00-04:00", "2026-10-29T16:00:00-04:00", 20),
    {
      id: "syn-e-team-sync",
      kind: "event",
      source: "google",
      title: "Sample project team sync",
      start: "2026-10-28T16:00:00-04:00",
      end: "2026-10-28T17:30:00-04:00",
      attendees: 6,
      isOrganizer: true,
      weight: "normal",
    },
    {
      id: "syn-t-calc",
      kind: "task",
      source: "manual",
      title: "Sample calculus problem set",
      size: "S",
      due: "2026-10-27T23:30:00-04:00",
    },
    {
      id: "syn-t-lab",
      kind: "task",
      source: "ics",
      title: "Sample chemistry lab report",
      size: "M",
      due: "2026-10-29T17:00:00-04:00",
    },
    {
      id: "syn-t-essay",
      kind: "task",
      source: "manual",
      title: "Sample writing essay draft",
      size: "L",
      due: "2026-11-01T23:00:00-05:00",
    },
    {
      id: "syn-t-issue",
      kind: "task",
      source: "github",
      title: "Sample flaky-test issue",
      size: "M",
      due: "2026-11-03T17:00:00-05:00",
    },
    {
      id: "syn-t-quiz",
      kind: "task",
      source: "ics",
      title: "Sample lab safety quiz (overdue)",
      size: "S",
      due: "2026-10-24T23:59:00-04:00",
    },
    {
      id: "syn-t-reading",
      kind: "task",
      source: "manual",
      title: "Sample seminar reading (no deadline)",
      size: "S",
    },
    {
      id: "syn-t-capstone",
      kind: "task",
      source: "manual",
      title: "Sample capstone proposal (due in 17 days)",
      size: "L",
      due: "2026-11-12T17:00:00-05:00",
    },
    {
      id: "syn-t-done",
      kind: "task",
      source: "manual",
      title: "Sample reading quiz (already done)",
      size: "M",
      due: "2026-10-26T12:00:00-04:00",
      doneAt: "2026-10-25T20:00:00Z",
    },
  ];
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

/** Frozen on purpose: the simulator must never write to its inputs. */
export function syntheticItems(): readonly Readonly<LoadItem>[] {
  return deepFreeze(build());
}
