import type { ForecastDay, LoadItem } from "@/lib/types";
import { ZONE_LABEL } from "@/components/ui/zones";
import { weekday } from "./format";

// Pure helpers behind the task tabs, the class filter and the forecast day panel. Unit tested.

export type TaskTab = "open" | "done" | "all";

export const TASK_TABS: TaskTab[] = ["open", "done", "all"];
export const TASK_TAB_LABEL: Record<TaskTab, string> = { open: "Open", done: "Done", all: "All" };

export function isTaskTab(v: unknown): v is TaskTab {
  return v === "open" || v === "done" || v === "all";
}

/** Tasks only, open first, then by due date. */
export function sortTasks(items: LoadItem[]): LoadItem[] {
  return items
    .filter((i) => i.kind === "task")
    .sort((a, b) => Number(!!a.doneAt) - Number(!!b.doneAt) || (a.due ?? "").localeCompare(b.due ?? ""));
}

export function filterByTab(tasks: LoadItem[], tab: TaskTab): LoadItem[] {
  if (tab === "all") return tasks;
  return tasks.filter((t) => (tab === "done") === !!t.doneAt);
}

export function tabCounts(tasks: LoadItem[]): Record<TaskTab, number> {
  const done = tasks.filter((t) => t.doneAt).length;
  return { open: tasks.length - done, done, all: tasks.length };
}

/** Distinct class labels among `items`, sorted. The filter shows only when there are two or more. */
export function coursesIn(items: LoadItem[], courses: Record<string, string> = {}): string[] {
  const set = new Set<string>();
  for (const i of items) {
    const c = courses[i.id];
    if (c) set.add(c);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** `course` null means every class, including items with no label. */
export function filterByCourse(items: LoadItem[], courses: Record<string, string> = {}, course: string | null): LoadItem[] {
  return course === null ? items : items.filter((i) => courses[i.id] === course);
}

/** The browser's zone: the stand-in until the response carries the calendar's. */
export function browserZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const dayFormats = new Map<string, Intl.DateTimeFormat>();

/** The calendar day ("2026-10-24") that instant `iso` falls on in `timeZone`. */
export function dayKey(iso: string, timeZone: string): string {
  let f = dayFormats.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    dayFormats.set(timeZone, f);
  }
  const p = Object.fromEntries(f.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

export interface DayItems {
  /** Tasks due that day, open and done, by due time. */
  tasks: LoadItem[];
  /** Events starting that day, by start time. */
  events: LoadItem[];
}

/** What falls on forecast day `date` (a "YYYY-MM-DD" in `timeZone`). */
export function bucketDay(items: LoadItem[], date: string, timeZone: string): DayItems {
  const tasks = items
    .filter((i) => i.kind === "task" && !!i.due && dayKey(i.due, timeZone) === date)
    .sort((a, b) => Date.parse(a.due!) - Date.parse(b.due!));
  const events = items
    .filter((i) => i.kind === "event" && !!i.start && dayKey(i.start, timeZone) === date)
    .sort((a, b) => Date.parse(a.start!) - Date.parse(b.start!));
  return { tasks, events };
}

/** Open tasks due on `date`: the "N items due" in each forecast day's label. */
export function openDueCount(items: LoadItem[], date: string, timeZone: string): number {
  return bucketDay(items, date, timeZone).tasks.filter((t) => !t.doneAt).length;
}

/** "Thursday, Working, score 52, 3 items due": the day button's accessible name. */
export function dayLabel(day: ForecastDay, isToday: boolean, due: number) {
  const dueText = due === 0 ? "nothing due" : `${due} ${due === 1 ? "item" : "items"} due`;
  return `${isToday ? "Today" : weekday(day.date, true)}, ${ZONE_LABEL[day.zone]}, score ${day.score}, ${dueText}`;
}
