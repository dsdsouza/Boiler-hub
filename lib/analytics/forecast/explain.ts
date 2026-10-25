import type { LoadItem, Size, Weight, Zone } from "@/lib/types";
import { ORGANIZER_FACTOR, SIZE_POINTS, WEIGHTS, WINDOW_DAYS, K } from "@/lib/pressure/config";
import { attendeeFactor, computePressure, isStaleOverdue, proximity, resolveWeight, urgency } from "@/lib/pressure/compute";
import { dayKey } from "@/components/boiler/taskView";
import { forecastInstant } from "./dayStart";

// Why one forecast day has its score. Recomputes the day with the engine itself (computePressure at the
// instant the forecast scores that day), then splits each contribution into the engine's own factors.
// No formula or constant lives here; see docs/pressure-model.md for units.

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type TaskTiming = "due-this-day" | "due-later" | "overdue" | "older-overdue" | "no-due";

export interface TaskContributor {
  kind: "task";
  id: string;
  title: string;
  /** Relative effort points, as the engine adds them. Never hours. */
  points: number;
  timing: TaskTiming;
  size: Size;
  /** SIZE_POINTS for the size. */
  sizePoints: number;
  /** Deadline multiplier at the day's start. */
  urgency: number;
  /** Days from the day's start to the due time; negative when overdue; absent without a due date. */
  daysUntilDue?: number;
}

export interface EventContributor {
  kind: "event";
  id: string;
  title: string;
  points: number;
  /** Clock hours of the event still ahead at the day's start. The only input measured in hours. */
  hours: number;
  weight: Weight;
  weightFactor: number;
  attendees: number;
  attendeeFactor: number;
  /** ORGANIZER_FACTOR when the owner organizes, otherwise 1. */
  organizerFactor: number;
  /** Discount for distance from the day's start. */
  proximity: number;
  daysAway: number;
}

export type Contributor = TaskContributor | EventContributor;

export type DueStatus = "counted" | "done" | "not-counted";

export interface DueTask {
  id: string;
  title: string;
  due: string;
  status: DueStatus;
  /** Points at the day's start when counted. */
  points?: number;
}

export interface AssumedDone {
  id: string;
  title: string;
  due: string;
}

/**
 * How much of the day's seven-day event window has calendar data behind it.
 * "unknown" when the caller did not say how far events were loaded; the explanation then makes no claim.
 */
export type Coverage =
  | { kind: "full"; windowEnd: string }
  | { kind: "partial"; loadedThrough: string; windowEnd: string; missingDays: number }
  | { kind: "unknown"; windowEnd: string };

export interface ForecastDayExplanation {
  date: string;
  dayIndex: number;
  isToday: boolean;
  /** The instant the forecast scores this day: now for today, local midnight otherwise. */
  at: string;
  score: number;
  zone: Zone;
  /** Sum of contributor points. */
  raw: number;
  /** The engine's scale constant, so the score can be shown as a function of `raw`. */
  k: number;
  /** Tasks whose due time falls on this calendar day, open and done. */
  dueThisDay: DueTask[];
  /** Every item adding pressure at `at`, largest first. Includes counted tasks due this day. */
  contributors: Contributor[];
  /** Open tasks due between now and `at`, dropped on the assumption they are finished on time. */
  assumedDone: AssumedDone[];
  coverage: Coverage;
}

export interface ExplainOptions {
  /** IANA zone the forecast days are split in. Same value passed to computePressure. */
  timeZone: string;
  /**
   * End of the calendar fetch window (ISO), usually the last sync time plus WINDOW_DAYS.
   * Leave undefined when unknown; the explanation will not claim coverage.
   */
  eventsLoadedThrough?: string | null;
}

/** Explain forecast day `dayIndex` (0 = today) of computePressure(items, now, { timeZone }).forecast. */
export function explainForecastDay(items: LoadItem[], now: Date, dayIndex: number, opts: ExplainOptions): ForecastDayExplanation {
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= WINDOW_DAYS) {
    throw new RangeError(`dayIndex must be 0–${WINDOW_DAYS - 1}`);
  }
  const { timeZone } = opts;
  const { at, date } = forecastInstant(now, dayIndex, timeZone);
  const t = now.getTime();
  const atMs = at.getTime();

  // The forecast's own filter: open tasks due between now and the day's start are assumed done.
  const assumedDone: AssumedDone[] = [];
  const ahead = items.filter((item) => {
    if (item.kind !== "task" || item.doneAt || !item.due) return true;
    const due = Date.parse(item.due);
    const keep = due < t || due >= atMs;
    if (!keep) assumedDone.push({ id: item.id, title: item.title, due: item.due });
    return keep;
  });
  assumedDone.sort((a, b) => Date.parse(a.due) - Date.parse(b.due));

  const result = computePressure(ahead, at, { timeZone });
  const byId = new Map(ahead.map((i) => [i.id, i]));
  const contributors: Contributor[] = [];
  for (const c of result.contributions) {
    const item = byId.get(c.itemId);
    if (!item) continue;
    contributors.push(item.kind === "event" ? eventFactors(item, at, c.points) : taskFactors(item, at, c.points, date, timeZone));
  }

  const points = new Map(contributors.map((c) => [c.id, c.points]));
  const dueThisDay: DueTask[] = items
    .filter((i) => i.kind === "task" && !!i.due && dayKey(i.due, timeZone) === date)
    .sort((a, b) => Date.parse(a.due!) - Date.parse(b.due!))
    .map((i) => {
      const p = points.get(i.id);
      const status: DueStatus = p !== undefined ? "counted" : i.doneAt ? "done" : "not-counted";
      return { id: i.id, title: i.title, due: i.due!, status, ...(p !== undefined ? { points: p } : {}) };
    });

  return {
    date,
    dayIndex,
    isToday: dayIndex === 0,
    at: at.toISOString(),
    score: result.score,
    zone: result.zone,
    raw: result.raw,
    k: K,
    dueThisDay,
    contributors,
    assumedDone,
    coverage: coverageFor(atMs, opts.eventsLoadedThrough),
  };
}

function taskFactors(item: LoadItem, at: Date, points: number, date: string, timeZone: string): TaskContributor {
  const size = item.size ?? "M";
  const base = { kind: "task" as const, id: item.id, title: item.title, points, size, sizePoints: SIZE_POINTS[size], urgency: urgency(item.due, at) };
  if (!item.due) return { ...base, timing: "no-due" };
  const daysUntilDue = (Date.parse(item.due) - at.getTime()) / DAY_MS;
  const timing: TaskTiming =
    daysUntilDue < 0
      ? isStaleOverdue(item.due, at) ? "older-overdue" : "overdue"
      : dayKey(item.due, timeZone) === date ? "due-this-day" : "due-later";
  return { ...base, timing, daysUntilDue };
}

function eventFactors(item: LoadItem, at: Date, points: number): EventContributor {
  const start = Date.parse(item.start!);
  const end = Date.parse(item.end!);
  const t = at.getTime();
  const weight = resolveWeight(item);
  const daysAway = Math.max(0, (start - t) / DAY_MS);
  return {
    kind: "event",
    id: item.id,
    title: item.title,
    points,
    hours: (end - Math.max(start, t)) / HOUR_MS,
    weight,
    weightFactor: WEIGHTS[weight],
    attendees: item.attendees ?? 0,
    attendeeFactor: attendeeFactor(item.attendees),
    organizerFactor: item.isOrganizer ? ORGANIZER_FACTOR : 1,
    proximity: proximity((start - t) / DAY_MS),
    daysAway,
  };
}

function coverageFor(atMs: number, loadedThrough: string | null | undefined): Coverage {
  const windowEndMs = atMs + WINDOW_DAYS * DAY_MS;
  const windowEnd = new Date(windowEndMs).toISOString();
  const through = loadedThrough ? Date.parse(loadedThrough) : NaN;
  if (!Number.isFinite(through)) return { kind: "unknown", windowEnd };
  if (through >= windowEndMs) return { kind: "full", windowEnd };
  const missingDays = Math.round(((windowEndMs - Math.max(through, atMs)) / DAY_MS) * 10) / 10;
  return { kind: "partial", loadedThrough: new Date(through).toISOString(), windowEnd, missingDays };
}
