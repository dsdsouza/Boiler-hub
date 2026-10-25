import { NO_DUE_DAYS, OVERDUE_STALE_DAYS, URGENCY_CAP, WINDOW_DAYS } from "@/lib/pressure/config";
import { WEIGHT_LABEL, weekday } from "@/components/boiler/format";
import type { Contributor, Coverage, EventContributor, ForecastDayExplanation, TaskContributor } from "./explain";

// Deterministic wording for a forecast day explanation. Every number comes from the explanation;
// nothing here estimates. Points are relative effort and are never written as hours.

/** "2.4 pts". */
export function formatPts(p: number): string {
  return `${p.toFixed(1)} pts`;
}

/** Factor with up to two decimals: 1, 0.5, 1.09. */
export function formatFactor(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

function inDays(days: number): string {
  const r = Math.round(days * 10) / 10;
  if (r < 1) return `in ${Math.max(1, Math.round(days * 24))} h`;
  return `in ${r} ${r === 1 ? "day" : "days"}`;
}

export function dayName(e: Pick<ForecastDayExplanation, "date" | "isToday">): string {
  return e.isToday ? "Today" : weekday(e.date, true);
}

/** Why the task's deadline multiplier has its value. */
export function taskTiming(c: TaskContributor): string {
  switch (c.timing) {
    case "no-due":
      return `no due date, treated as ${NO_DUE_DAYS} days out`;
    case "overdue":
      return `overdue, held at the ${URGENCY_CAP}× cap`;
    case "older-overdue":
      return `overdue more than ${OVERDUE_STALE_DAYS} days, kept as backlog`;
    case "due-this-day":
      return `due this day, ${inDays(c.daysUntilDue ?? 0)} from the day's start`;
    case "due-later":
      return `due ${inDays(c.daysUntilDue ?? 0)}`;
  }
}

/** "M task: 4 size pts × 0.5 deadline". */
export function taskFormula(c: TaskContributor): string {
  return `${c.size} task: ${c.sizePoints} size pts × ${formatFactor(c.urgency)} deadline`;
}

/** "1.5 h × Normal 1 × 4 people 1.09 × organizer 1.2 × distance 0.74". Hours are the event's length only. */
export function eventFormula(c: EventContributor): string {
  const parts = [`${formatFactor(c.hours)} h`, `${WEIGHT_LABEL[c.weight]} ${formatFactor(c.weightFactor)}`];
  if (c.attendeeFactor !== 1) parts.push(`${plural(c.attendees, "person", "people")} ${formatFactor(c.attendeeFactor)}`);
  if (c.organizerFactor !== 1) parts.push(`organizer ${formatFactor(c.organizerFactor)}`);
  if (c.proximity !== 1) parts.push(`distance ${formatFactor(c.proximity)}`);
  return parts.join(" × ");
}

export function eventTiming(c: EventContributor): string {
  return c.daysAway < 1 / 24 ? "under way or starting now" : `starts ${inDays(c.daysAway)}`;
}

export function contributorFormula(c: Contributor): string {
  return c.kind === "task" ? taskFormula(c) : eventFormula(c);
}

function localDateTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

/** One sentence on calendar coverage. Never claims coverage it was not given. */
export function coverageText(c: Coverage, timeZone: string): string {
  switch (c.kind) {
    case "full":
      return `Calendar events are loaded for this day's whole ${WINDOW_DAYS}-day event window.`;
    case "partial":
      return `Calendar events are loaded through ${localDateTime(c.loadedThrough, timeZone)}. The last ${c.missingDays} days of this day's ${WINDOW_DAYS}-day event window have no calendar data yet, so events then are not counted.`;
    case "unknown":
      return "How far ahead calendar events were loaded isn't known here, so this day counts only the events already shown.";
  }
}

/** The forecast's standing assumptions, as they apply to this day. */
export function assumptionLines(e: ForecastDayExplanation, timeZone: string): string[] {
  const lines = [
    e.isToday
      ? "Today is scored as of now."
      : `${dayName(e)} is scored at the start of the day (midnight, ${timeZone}).`,
  ];
  if (!e.isToday) {
    lines.push(
      e.assumedDone.length === 0
        ? "No open tasks fall due between now and then, so none are assumed finished."
        : `${plural(e.assumedDone.length, "open task")} due before then ${e.assumedDone.length === 1 ? "is" : "are"} assumed finished on time and left out.`,
    );
  }
  lines.push("Work that is already overdue stays counted until you mark it done.");
  lines.push(coverageText(e.coverage, timeZone));
  lines.push("Points are relative effort, not hours. Only an event's length is measured in hours.");
  return lines;
}

/** Pip's line: at most three short sentences, all tied to the explanation's numbers. */
export function pipLine(e: ForecastDayExplanation): string {
  const day = dayName(e);
  const sentences = [`${day} ${e.isToday ? "reads" : "starts at"} ${e.score} from ${formatPts(e.raw)}.`];
  const top = e.contributors[0];
  if (top) sentences.push(`Largest share: ${top.title}, ${formatPts(top.points)}.`);
  else sentences.push("Nothing is adding pressure.");
  if (e.coverage.kind === "partial") sentences.push("Some of its calendar isn't loaded yet, so it may read low.");
  else if (e.assumedDone.length > 0) sentences.push(`That assumes ${plural(e.assumedDone.length, "earlier task")} ${e.assumedDone.length === 1 ? "gets" : "get"} done on time.`);
  return sentences.join(" ");
}
