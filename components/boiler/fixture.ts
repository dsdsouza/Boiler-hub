import demo from "@/fixtures/demo.json";
import type { BoilerCard, EngineRoom, LoadItem, Status, Zone } from "@/lib/types";
import type { MyBoilerData } from "./boilerState";
import { computePressure } from "@/lib/pressure";

// Team snapshots for the demo. Maya's interactive gauge uses the real engine below.

export type DemoBoiler = BoilerCard & { raw: number };
export type DemoTeam = Omit<EngineRoom, "boilers"> & { boilers: DemoBoiler[]; hiddenRaw: number[] };

export const demoTeams = demo.teams as unknown as DemoTeam[];

const H = 3_600_000;
const D = 24 * H;

function at(now: Date, offsetMs: number, hour?: number) {
  const d = new Date(now.getTime() + offsetMs);
  if (hour !== undefined) d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

/**
 * The load items behind Maya's fixture contributions. The fixture stores only
 * contributions, so the events and tasks are reconstructed here, dated
 * relative to `now` so "due today" stays true whenever the demo is opened.
 */
function mayaItems(now: Date): LoadItem[] {
  const ev = (id: string, title: string, dayOffset: number, hour: number, hours: number, extra: Partial<LoadItem>): LoadItem => {
    const start = at(now, dayOffset * D, hour);
    return { id, kind: "event", source: "google", title, start, end: new Date(new Date(start).getTime() + hours * H).toISOString(), ...extra };
  };
  return [
    ev("evt-design-review", "Design review", 1, 10, 2, { attendees: 9, weight: "heavy", seriesKey: "s-design-review" }),
    ev("evt-customer-calls", "Customer calls", 2, 13, 3, { attendees: 4, isOrganizer: true, weight: "normal", seriesKey: "s-customer-calls" }),
    ev("evt-sprint-planning", "Sprint planning", 2, 9, 1.5, { attendees: 8, weight: "normal", isRecurring: true, seriesKey: "s-sprint-planning" }),
    ev("evt-1on1s", "1:1s", 1, 15, 0.5, { attendees: 2, weight: "light", isRecurring: true, seriesKey: "s-1on1s" }),
    ev("evt-all-hands", "All hands", 3, 16, 1, { attendees: 40, weight: "normal", seriesKey: "s-all-hands" }),
    ev("evt-standup", "Daily standup", 1, 9, 0.25, { attendees: 7, weight: "light", isRecurring: true, seriesKey: "s-standup" }),
    ev("evt-focus-block", "Focus time", 5, 9, 3, { release: true }),
    { id: "tsk-onboarding-spec", kind: "task", source: "manual", title: "Finish onboarding v2 spec", due: at(now, 1.25 * D), size: "L", doneAt: null },
    { id: "tsk-q4-roadmap", kind: "task", source: "team", title: "Q4 roadmap deck", due: at(now, -1 * D, 17), size: "M", doneAt: null },
    { id: "tsk-pr-reviews", kind: "task", source: "manual", title: "Review 3 PRs", due: at(now, 0.2 * D), size: "S", doneAt: null },
    { id: "tsk-hiring-loop", kind: "task", source: "manual", title: "Write hiring loop feedback", due: at(now, 2 * D), size: "S", doneAt: null },
    { id: "tsk-done-bugfix", kind: "task", source: "manual", title: "Fix signup bug", due: at(now, -1 * D), size: "S", doneAt: at(now, -0.4 * D) },
  ];
}

export function mayaBoiler(now: Date = new Date()): MyBoilerData {
  const items = mayaItems(now);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const result = computePressure(items, now, { timeZone });
  const maya = demoTeams[0]!.boilers.find((b) => b.userId === demo.maya.userId)!;
  return {
    name: "Maya Chen",
    avatarUrl: null,
    result,
    items,
    timeZone,
    status: maya.status as Status,
    statusNote: maya.statusNote ?? "",
    syncedAt: new Date(now.getTime() - 4 * 60_000).toISOString(),
    calendar: "ok",
  };
}

export function zoneCounts(boilers: { zone: Zone }[]) {
  const out: Record<Zone, number> = { cool: 0, working: 0, hot: 0, redline: 0 };
  boilers.forEach((b) => out[b.zone]++);
  return out;
}
