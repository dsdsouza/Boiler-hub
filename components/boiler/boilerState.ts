import type { LoadItem, PressureResult, Size, Status, Weight } from "@/lib/types";
import type { CalendarState, SourceInfo } from "@/lib/pressure/api-types";
import { computePressure, taskPoints } from "@/lib/pressure";

// Every optimistic action uses the same engine as the server.
export interface MyBoilerData {
  name?: string;
  avatarUrl?: string | null;
  result: PressureResult;
  /** Owner-only load items behind the contributions (events are live, never stored). */
  items: LoadItem[];
  status: Status;
  statusNote: string;
  syncedAt: string;
  /** Calendar time zone used by the server, so optimistic forecasts match. */
  timeZone?: string;
  /** "reconnect" when Google tokens are missing or expired: the score uses tasks only. */
  calendar: CalendarState;
  /** Connected sources (ICS, GitHub) and their health. Absent in the demo. */
  sources?: SourceInfo[];
  /** Per-task extras for source items, keyed by item id. */
  taskMeta?: Record<string, TaskMeta>;
  /** Where each event's tag comes from, when the owner set one: this event alone, or its series. */
  eventOverrides?: Record<string, "event" | "series">;
  /** Class, repo or team label per task or event id. Items without one are left out. */
  courses?: Record<string, string>;
  /** IANA zone the forecast days are split in. Absent until the response carries it; see calendarZone. */
}

/** What a source item (ICS, GitHub) needs beyond its LoadItem: where it came from and its state key. */
export interface TaskMeta {
  sourceId: string;
  itemKey: string;
  label?: string;
  url?: string;
  courseName?: string;
  completedInSource?: boolean;
}

export interface NewTask {
  title: string;
  due: string;
  size: Size;
}

function recompute(data: MyBoilerData, items: LoadItem[], now: Date): MyBoilerData {
  return { ...data, items, result: computePressure(items, now, { timeZone: data.timeZone ?? "UTC" }) };
}

export function addTask(data: MyBoilerData, task: NewTask, id: string, now: Date, source: "manual" | "team" = "manual"): MyBoilerData {
  const item: LoadItem = { id, kind: "task", source, title: task.title, due: task.due || undefined, size: task.size, doneAt: null };
  return recompute(data, [...data.items, item], now);
}

/** Completion vents only the load removed from this task. */
export function setTaskDone(data: MyBoilerData, id: string, done: boolean, now: Date): { data: MyBoilerData; vented: number } {
  const item = data.items.find((i) => i.id === id && i.kind === "task");
  if (!item) return { data, vented: 0 };
  const doneAt = done ? item.doneAt ?? now.toISOString() : null;
  const next = recompute(data, data.items.map((i) => i.id === id ? { ...i, doneAt } : i), now);
  const removed = done && !item.doneAt ? taskPoints({ due: item.due, size: item.size ?? "M" }, now) : 0;
  return { data: next, vented: Math.round(removed * 10) / 10 };
}

export function setTaskSize(data: MyBoilerData, id: string, size: Size, now: Date): MyBoilerData {
  return recompute(data, data.items.map((i) => i.id === id && i.kind === "task" ? { ...i, size } : i), now);
}

/** Open source tasks already past due. Future tasks are never included in a bulk clear. */
export function overdueSourceTasks(data: MyBoilerData, now: Date): LoadItem[] {
  return data.items.filter((i) => i.kind === "task" && !i.doneAt && !!data.taskMeta?.[i.id] && !!i.due && Date.parse(i.due) < now.getTime());
}

/** Preserve cleared source tasks so the owner can review and restore them. */
export function clearTasks(data: MyBoilerData, ids: ReadonlySet<string>, now = new Date()): MyBoilerData {
  const items = data.items.flatMap((i) => !ids.has(i.id) ? [i] : data.taskMeta?.[i.id] ? [{ ...i, doneAt: now.toISOString() }] : []);
  return recompute(data, items, now);
}

export function setEventWeight(data: MyBoilerData, id: string, weight: Weight, series: boolean, clearIds: readonly string[] = [], now = new Date()): MyBoilerData {
  const target = data.items.find((i) => i.id === id && i.kind === "event");
  if (!target) return data;
  const own = data.eventOverrides ?? {};
  const cleared = new Set(clearIds);
  const affected = new Set(data.items.filter((i) => i.kind === "event" && !i.release && (i.id === id || (series && !!target.seriesKey && i.seriesKey === target.seriesKey && (own[i.id] !== "event" || cleared.has(i.id))))).map((i) => i.id));
  const items = data.items.map((i) => affected.has(i.id) ? { ...i, weight } : i);
  const eventOverrides = { ...own };
  for (const key of affected) eventOverrides[key] = series ? "series" : "event";
  return recompute({ ...data, eventOverrides }, items, now);
}

export function setStatus(data: MyBoilerData, status: Status, statusNote: string): MyBoilerData {
  return { ...data, status, statusNote: statusNote.slice(0, 80) };
}
