import ical, { type VEvent } from "node-ical";
import type { Size } from "@/lib/types";
import { WINDOW_DAYS } from "@/lib/pressure/config";
import { sha256 } from "@/lib/google/normalize";
import { safeFetchText } from "./fetch";
import { SourceError, sourceItemId, type AdapterSource, type SourceAdapter, type SourceItem } from "./types";

// ICS feeds (Brightspace, Canvas, Outlook, any calendar). Parsed live each sync, never stored.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Deadlines overdue by up to this many days still count (as overdue tasks). */
export const OVERDUE_DAYS = 14;

const DEADLINE_RE = /\b(due|assignments?|quiz(?:zes)?|exams?|midterms?|finals?|projects?|labs?)\b/i;
// Size by title, first match wins: L, then M; everything else (homework, assignment, discussion,
// reading, and any other deadline) is S.
const LARGE_RE = /\b(exams?|midterms?|finals?)\b/i;
const MEDIUM_RE = /\b(quiz(?:zes)?|projects?|labs?|papers?|essays?|reports?|presentations?)\b/i;

export function sizeForTitle(title: string): Size {
  if (LARGE_RE.test(title)) return "L";
  if (MEDIUM_RE.test(title)) return "M";
  return "S";
}

export interface ClassifyOptions {
  sourceId: string;
  /** All-day entries count as deadlines (coursework feeds); otherwise only with a deadline keyword. */
  coursework: boolean;
  now: Date;
  /** Zone for all-day deadlines (due 23:59 that day). The feed's X-WR-TIMEZONE wins when present. */
  timeZone: string;
}

/**
 * Parse a feed and classify each entry in the window:
 * deadline-like entries (zero-length, all-day in a coursework feed, or a deadline keyword in the title)
 * become tasks due at their time; other timed entries become events. Pure apart from hashing.
 */
export function classifyIcs(text: string, opts: ClassifyOptions): SourceItem[] {
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new SourceError("That link did not return a calendar feed (.ics)");
  let cal: ReturnType<typeof ical.sync.parseICS>;
  try {
    cal = ical.sync.parseICS(text);
  } catch {
    throw new SourceError("The calendar feed could not be read");
  }

  const t = opts.now.getTime();
  const feedZone = validZone(cal.vcalendar?.["WR-TIMEZONE"]) ?? opts.timeZone;
  const from = new Date(t - (OVERDUE_DAYS + 1) * DAY_MS);
  const to = new Date(t + (WINDOW_DAYS + 1) * DAY_MS);
  const items: SourceItem[] = [];

  for (const component of Object.values(cal)) {
    if (!component || component.type !== "VEVENT") continue;
    const event = component as VEvent;
    if (event.status === "CANCELLED") continue;

    let instances: ReturnType<typeof ical.expandRecurringEvent>;
    try {
      instances = ical.expandRecurringEvent(event, { from, to, expandOngoing: true });
    } catch {
      continue; // one malformed entry must not drop the whole feed
    }

    for (const inst of instances) {
      const entry = inst.event;
      if (entry.status === "CANCELLED") continue;
      const title = textOf(entry.summary) || textOf(event.summary) || "Untitled";
      const start = inst.start.getTime();
      const end = inst.end ? inst.end.getTime() : start;
      const occurrence = inst.isRecurring ? `@${new Date(start).toISOString()}` : "";
      const itemKey = sha256(`${event.uid}${occurrence}`);
      const id = sourceItemId(opts.sourceId, itemKey);

      const keyword = DEADLINE_RE.test(title);
      const deadline = inst.isFullDay ? opts.coursework || keyword : end === start || keyword;

      if (deadline) {
        // All-day: due at 23:59 that calendar day (DATE values are built at local midnight, so read
        // local fields). Timed: due when it closes ("Quiz 4, 10:00 to 11:00" is due at 11:00).
        const due = inst.isFullDay
          ? zonedTime(inst.start.getFullYear(), inst.start.getMonth() + 1, inst.start.getDate(), 23, 59, feedZone)
          : end;
        if (due < t - OVERDUE_DAYS * DAY_MS || due > t + WINDOW_DAYS * DAY_MS) continue;
        items.push({
          id,
          kind: "task",
          source: "ics",
          sourceId: opts.sourceId,
          itemKey,
          title,
          due: new Date(due).toISOString(),
          doneAt: null,
          size: sizeForTitle(title),
        });
        continue;
      }

      // Events: timed, busy, and overlapping the next 7 days. All-day and Free entries add nothing.
      if (inst.isFullDay || entry.transparency === "TRANSPARENT") continue;
      if (end <= t || start >= t + WINDOW_DAYS * DAY_MS) continue;
      items.push({
        id,
        kind: "event",
        source: "ics",
        sourceId: opts.sourceId,
        itemKey,
        title,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        seriesKey: sha256(`ics:${opts.sourceId}:${event.uid}`),
        isRecurring: inst.isRecurring,
        attendees: 0,
        isOrganizer: false,
      });
    }
  }
  return items;
}

export const icsAdapter: SourceAdapter = {
  async fetchItems(source: AdapterSource, ctx) {
    const text = await safeFetchText(source.secret, { fetchImpl: ctx.fetchImpl });
    return classifyIcs(text, {
      sourceId: source.id,
      coursework: source.coursework,
      now: ctx.now,
      timeZone: await ctx.timeZone,
    });
  },
};

function textOf(v: VEvent["summary"] | undefined): string {
  if (!v) return "";
  return (typeof v === "string" ? v : v.val).trim();
}

function validZone(zone: unknown): string | undefined {
  if (typeof zone !== "string" || !zone) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return zone;
  } catch {
    return undefined;
  }
}

/** UTC ms of wall-clock y-m-d h:min in `timeZone`. */
export function zonedTime(y: number, m: number, d: number, h: number, min: number, timeZone: string): number {
  const guess = Date.UTC(y, m - 1, d, h, min);
  let t = guess - offsetAt(guess, timeZone);
  t = guess - offsetAt(t, timeZone); // second pass handles DST shifts
  return t;
}

function offsetAt(t: number, timeZone: string): number {
  const parts: Record<string, number> = {};
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
  for (const { type, value } of fmt.formatToParts(new Date(t))) if (type !== "literal") parts[type] = Number(value);
  return Date.UTC(parts.year!, parts.month! - 1, parts.day!, parts.hour!, parts.minute!) - Math.floor(t / 60_000) * 60_000;
}
