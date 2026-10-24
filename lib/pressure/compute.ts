import type { Contribution, Counts, ForecastDay, LoadItem, PressureResult, Size, Weight, Zone } from "@/lib/types";
import {
  ATTENDEE_CAP,
  ATTENDEE_STEP,
  COMPLETED_RELEASE,
  COMPLETED_RELEASE_HOURS,
  DEFAULT_RECURRING_WEIGHT,
  DEFAULT_WEIGHT,
  FOCUS_RELEASE,
  K,
  NO_DUE_DAYS,
  ORGANIZER_FACTOR,
  PROXIMITY_RATE,
  SIZE_POINTS,
  URGENCY_CAP,
  URGENCY_MIN_DAYS,
  WEIGHTS,
  WINDOW_DAYS,
  ZONE_MIN,
} from "./config";

// Pure pressure engine. No I/O. See docs/PRD.md "Pressure engine".

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface ComputeOptions {
  /** IANA zone used for forecast day boundaries. Defaults to UTC. */
  timeZone?: string;
}

export function scoreFromRaw(raw: number): number {
  return Math.round(100 * (1 - Math.exp(-Math.max(raw, 0) / K)));
}

/** Inverse of scoreFromRaw: raw = −K × ln(1 − score/100). Capped below 100 so the result stays finite. */
export function rawFromScore(score: number): number {
  return -K * Math.log(1 - Math.min(Math.max(score, 0), 99.5) / 100);
}

export function zoneFor(score: number): Zone {
  if (score >= ZONE_MIN.redline) return "redline";
  if (score >= ZONE_MIN.hot) return "hot";
  if (score >= ZONE_MIN.working) return "working";
  return "cool";
}

export function proximity(daysFromNow: number): number {
  return 1 / (1 + PROXIMITY_RATE * Math.max(daysFromNow, 0));
}

/** 1 / max(days until due, 0.25), capped at 3; overdue = 3. A missing due date counts as NO_DUE_DAYS out. */
export function urgency(due: string | undefined, now: Date): number {
  if (!due) return 1 / NO_DUE_DAYS;
  const days = (Date.parse(due) - now.getTime()) / DAY_MS;
  if (days < 0) return URGENCY_CAP;
  return Math.min(1 / Math.max(days, URGENCY_MIN_DAYS), URGENCY_CAP);
}

/** Pressure an open task adds right now. Shared with preview.ts so previews match real results. */
export function taskPoints(task: { due?: string; size: Size }, now: Date): number {
  return SIZE_POINTS[task.size] * urgency(task.due, now);
}

export function attendeeFactor(attendees: number | undefined): number {
  return 1 + ATTENDEE_STEP * Math.min(attendees ?? 0, ATTENDEE_CAP);
}

export function resolveWeight(item: Pick<LoadItem, "weight" | "isRecurring">): Weight {
  return item.weight ?? (item.isRecurring ? DEFAULT_RECURRING_WEIGHT : DEFAULT_WEIGHT);
}

interface Scored {
  points: number;
  reason: string;
  /** Pressure event inside the window, for counts. */
  meetingHours?: number;
  dueSoon?: boolean;
  overdue?: boolean;
}

function scoreItem(item: LoadItem, now: Date): Scored | null {
  return item.kind === "event" ? scoreEvent(item, now) : scoreTask(item, now);
}

function scoreEvent(item: LoadItem, now: Date): Scored | null {
  if (!item.start || !item.end) return null;
  const start = Date.parse(item.start);
  const end = Date.parse(item.end);
  const t = now.getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  if (end <= t || start >= t + WINDOW_DAYS * DAY_MS) return null;

  // In-progress events count only their remaining time.
  const hours = (end - Math.max(start, t)) / HOUR_MS;
  if (hours <= 0) return null;
  const prox = proximity((start - t) / DAY_MS);

  if (item.release) {
    return {
      points: -FOCUS_RELEASE * hours * prox,
      reason: `${fmtHours(hours)} ${item.title}, vents pressure`,
    };
  }

  const weight = resolveWeight(item);
  const points =
    hours * WEIGHTS[weight] * attendeeFactor(item.attendees) * (item.isOrganizer ? ORGANIZER_FACTOR : 1) * prox;
  const parts = [`${fmtHours(hours)} ${item.title}`];
  if ((item.attendees ?? 0) > 1) parts.push(`${item.attendees} people`);
  if (item.isOrganizer) parts.push("you organize");
  parts.push(cap(weight));
  return { points, reason: parts.join(", "), meetingHours: hours };
}

function scoreTask(item: LoadItem, now: Date): Scored | null {
  const size = item.size ?? "M";
  const t = now.getTime();

  if (item.doneAt) {
    const doneAt = Date.parse(item.doneAt);
    // A task completed after `now` was still open at `now`.
    if (doneAt <= t) {
      const ageHours = (t - doneAt) / HOUR_MS;
      if (ageHours >= COMPLETED_RELEASE_HOURS) return null;
      const points = -COMPLETED_RELEASE * SIZE_POINTS[size] * (1 - ageHours / COMPLETED_RELEASE_HOURS);
      return { points, reason: `Completed ${size} task, venting` };
    }
  }

  const points = taskPoints({ due: item.due, size }, now);
  if (!item.due) return { points, reason: `${size} task, no due date` };
  const days = (Date.parse(item.due) - t) / DAY_MS;
  if (days < 0) return { points, reason: `${size} task, overdue`, overdue: true };
  return {
    points,
    reason: `${size} task, due ${fmtDays(days)}`,
    dueSoon: days <= WINDOW_DAYS,
  };
}

/** Score and raw R only, no breakdown. Used for forecast days. */
function rawAt(items: LoadItem[], now: Date): number {
  let raw = 0;
  for (const item of items) raw += scoreItem(item, now)?.points ?? 0;
  return raw;
}

export function computePressure(items: LoadItem[], now: Date, opts: ComputeOptions = {}): PressureResult {
  const contributions: Contribution[] = [];
  const counts: Counts = { meetings: 0, meetingHours: 0, tasksDue: 0, overdue: 0 };
  let raw = 0;

  for (const item of items) {
    const s = scoreItem(item, now);
    if (!s) continue;
    raw += s.points;
    if (s.meetingHours !== undefined) {
      counts.meetings += 1;
      counts.meetingHours += s.meetingHours;
    }
    if (s.dueSoon) counts.tasksDue += 1;
    if (s.overdue) counts.overdue += 1;
    if (s.points !== 0) {
      contributions.push({ itemId: item.id, title: item.title, points: round2(s.points), reason: s.reason });
    }
  }

  contributions.sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
  counts.meetingHours = Math.round(counts.meetingHours * 10) / 10;

  const score = scoreFromRaw(raw);
  return {
    score,
    raw,
    zone: zoneFor(score),
    contributions,
    counts,
    forecast: forecast(items, now, opts.timeZone ?? "UTC"),
  };
}

/**
 * Score as of the start of each of the next 7 days (day 0 is `now`).
 * Open tasks due between `now` and that day are assumed done on time, so they drop out
 * instead of turning overdue; tasks already overdue today stay overdue.
 */
function forecast(items: LoadItem[], now: Date, timeZone: string): ForecastDay[] {
  const { y, m, d } = ymdIn(now, timeZone);
  const t = now.getTime();
  const days: ForecastDay[] = [];
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const at = i === 0 ? now : startOfDay(y, m, d + i, timeZone);
    const date = new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10);
    const ahead = items.filter((item) => {
      if (item.kind !== "task" || item.doneAt || !item.due) return true;
      const due = Date.parse(item.due);
      return due < t || due >= at.getTime();
    });
    const score = scoreFromRaw(rawAt(ahead, at));
    days.push({ date, score, zone: zoneFor(score) });
  }
  return days;
}

// --- time zone helpers (Intl only, no deps) ---

function ymdIn(date: Date, timeZone: string) {
  const p = partsIn(date, timeZone);
  return { y: p.year, m: p.month, d: p.day };
}

function partsIn(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });
  const out: Record<string, number> = {};
  for (const { type, value } of fmt.formatToParts(date)) {
    if (type !== "literal") out[type] = Number(value);
  }
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Offset of `timeZone` from UTC at instant `t`, in ms. */
function offsetAt(t: number, timeZone: string): number {
  const p = partsIn(new Date(t), timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000;
}

/** UTC instant of local midnight for y-m-d (d may overflow) in `timeZone`. */
function startOfDay(y: number, m: number, d: number, timeZone: string): Date {
  const guess = Date.UTC(y, m - 1, d);
  let t = guess - offsetAt(guess, timeZone);
  t = guess - offsetAt(t, timeZone); // second pass handles DST shifts
  return new Date(t);
}

// --- formatting ---

function fmtHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  const r = Math.round(h * 10) / 10;
  return `${r}h`;
}

function fmtDays(days: number): string {
  if (days < 1) return `in ${Math.max(1, Math.round(days * 24))}h`;
  const r = Math.round(days * 10) / 10;
  return `in ${r} day${r === 1 ? "" : "s"}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
