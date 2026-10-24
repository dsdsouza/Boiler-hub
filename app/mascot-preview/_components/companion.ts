import type { Size, Zone } from "@/lib/types";
import { applyTaskToRaw, COMPLETED_RELEASE, rawFromScore, scoreFromRaw, SIZE_POINTS, taskPoints } from "@/lib/pressure";
import { zoneOf } from "@/components/ui/zones";

// Pip's voice and the simulated numbers behind /mascot-preview. Every score and
// zone goes through lib/pressure and components/ui/zones, so the preview moves
// with the real thresholds. Nothing here reads or writes real user data.

export { BANNED_PHRASES, MASCOT_NAME, ZONE_LINE, ZONE_PRESET, type Reaction } from "@/components/mascot/voice";

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const WEEKDAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

/** Demo week shape: Thursday carries the most load. Offsets from today's score. */
const WEEK_SHAPE = [-6, 2, 5, 16, 4, -14, -22];

/** What lands on each demo day, for the insight explanation. */
export const WEEK_DETAIL: { meetings: number; meetingHours: number; deadlines: string[] }[] = [
  { meetings: 3, meetingHours: 2.5, deadlines: [] },
  { meetings: 4, meetingHours: 3, deadlines: ["Review 3 PRs"] },
  { meetings: 4, meetingHours: 3.5, deadlines: [] },
  { meetings: 5, meetingHours: 6.5, deadlines: ["Onboarding v2 spec", "Hiring loop feedback"] },
  { meetings: 2, meetingHours: 1.5, deadlines: ["Q4 roadmap deck"] },
  { meetings: 0, meetingHours: 0, deadlines: [] },
  { meetings: 0, meetingHours: 0, deadlines: [] },
];

export function clampScore(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function demoWeek(score: number) {
  return WEEK_SHAPE.map((d, i) => {
    const s = clampScore(score + d);
    return { day: WEEKDAYS[i]!, long: WEEKDAY_LONG[i]!, score: s, zone: zoneOf(s), ...WEEK_DETAIL[i]! };
  });
}

export function peakDay(week: ReturnType<typeof demoWeek>) {
  return week.reduce((a, b) => (b.score > a.score ? b : a));
}

export function insightFor(week: ReturnType<typeof demoWeek>) {
  const peak = peakDay(week);
  const why = `${peak.meetings} meetings (${peak.meetingHours} h) and ${peak.deadlines.length} deadline${peak.deadlines.length === 1 ? "" : "s"} land the same day.`;
  const headline = peak.score >= 70 ? `${peak.long} looks full.` : `${peak.long} is your busiest day.`;
  return { peak, headline, why, action: "Review your week" };
}

export interface DemoTask {
  id: string;
  title: string;
  size: Size;
  /** Days from now. */
  dueIn: number;
  source: "manual" | "team" | "ics";
}

export const DEMO_TASKS: DemoTask[] = [
  { id: "t-prs", title: "Review 3 PRs", size: "S", dueIn: 0.4, source: "manual" },
  { id: "t-deck", title: "Q4 roadmap deck", size: "M", dueIn: 1.5, source: "team" },
  { id: "t-spec", title: "Finish onboarding v2 spec", size: "L", dueIn: 3, source: "manual" },
  { id: "t-hiring", title: "Write hiring loop feedback", size: "S", dueIn: 3.2, source: "manual" },
];

const DAY_MS = 86_400_000;

export function dueIso(task: Pick<DemoTask, "dueIn">, now: Date) {
  return new Date(now.getTime() + task.dueIn * DAY_MS).toISOString();
}

/**
 * Completing a task removes its open pressure and adds the fresh completion vent,
 * matching what computePressure would report right after completion.
 */
export function completeTask(score: number, task: DemoTask, now: Date) {
  const raw = rawFromScore(score);
  const next = raw - taskPoints({ due: dueIso(task, now), size: task.size }, now) - COMPLETED_RELEASE * SIZE_POINTS[task.size];
  const after = scoreFromRaw(next);
  return { before: score, after, zone: zoneOf(after) };
}

export interface DueChoice {
  key: string;
  label: string;
  dueIn: number;
}

export const DUE_CHOICES: DueChoice[] = [
  { key: "tomorrow", label: "Tomorrow", dueIn: 1 },
  { key: "friday", label: "Friday", dueIn: 3 },
  { key: "next-tue", label: "Next Tue", dueIn: 7 },
];

const RANK: Record<Zone, number> = { cool: 0, working: 1, hot: 2, redline: 3 };

/** Same math as the Engine Room preview (applyTaskToRaw on each stored raw). */
export function previewAssignment(members: { name: string; raw: number }[], size: Size, dueIn: number, now: Date) {
  const due = new Date(now.getTime() + dueIn * DAY_MS).toISOString();
  const rows = members.map((m) => {
    const before = scoreFromRaw(m.raw);
    const after = applyTaskToRaw(m.raw, { due, size }, now);
    return { name: m.name, before, beforeZone: zoneOf(before), after: after.score, afterZone: after.zone, crossed: RANK[after.zone] > RANK[zoneOf(before)] };
  });
  const intoHot = rows.filter((r) => r.crossed && r.afterZone === "hot").length;
  const intoRed = rows.filter((r) => r.crossed && r.afterZone === "redline").length;
  const intoWorking = rows.filter((r) => r.crossed && r.afterZone === "working").length;
  return { rows, intoHot, intoRed, intoWorking, crossings: rows.filter((r) => r.crossed).length };
}

/** The due date with the fewest zone crossings (ties go to the earliest). */
export function gentlestDue(members: { name: string; raw: number }[], size: Size, now: Date) {
  return DUE_CHOICES.map((c) => ({ choice: c, p: previewAssignment(members, size, c.dueIn, now) })).reduce((a, b) =>
    b.p.intoRed < a.p.intoRed || (b.p.intoRed === a.p.intoRed && b.p.crossings < a.p.crossings) ? b : a,
  );
}

/** Mobile notification concepts, one per moment. Short, specific, one action. */
export function notificationsFor(score: number) {
  const week = demoWeek(score);
  const { peak } = insightFor(week);
  const zone = zoneOf(score);
  const lead =
    zone === "redline" || zone === "hot"
      ? { title: "Running warm this week", body: `${peak.long} carries the most. Want to see what could move?`, action: "Review" }
      : { title: `${peak.long} looks busiest`, body: `${peak.meetings} meetings and ${peak.deadlines.length} deadlines. Review your week?`, action: "Review" };
  return [
    { id: "insight", time: "8:02 AM", ...lead },
    { id: "done", time: "11:40 AM", title: "A little breathing room", body: "One task off the list. Your gauge eased off a little.", action: "See gauge" },
    { id: "assign", time: "2:15 PM", title: "New assignment from Product Squad", body: "Due Friday · M size. Your lead previewed it first.", action: "View" },
    { id: "quiet", time: "Sun 6:00 PM", title: "Week ahead", body: zone === "cool" ? "A lighter week. Nothing to do here." : "Your week is mapped. One tap to see the busy days.", action: "Open" },
  ];
}

/** Pushing an open task to a later due date: its urgency drops, everything else stays. */
export function moveTask(score: number, task: DemoTask, toDueIn: number, now: Date) {
  const raw = rawFromScore(score);
  const from = taskPoints({ due: dueIso(task, now), size: task.size }, now);
  const to = taskPoints({ due: dueIso({ dueIn: toDueIn }, now), size: task.size }, now);
  const after = scoreFromRaw(raw - from + to);
  return { before: score, after, zone: zoneOf(after) };
}
