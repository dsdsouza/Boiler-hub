import type { Contribution, ForecastDay, LoadItem, PressureResult, Size, Status, Weight } from "@/lib/types";
import { zoneOf } from "@/components/ui/zones";
import type { CalendarState, SourceInfo } from "@/lib/pressure/api-types";
import {
  COMPLETED_RELEASE,
  COMPLETED_RELEASE_HOURS,
  DEFAULT_WEIGHT,
  SIZE_POINTS,
  WEIGHTS,
  rawFromScore,
  scoreFromRaw,
  taskPoints,
} from "@/lib/pressure";
import { WEIGHT_LABEL, dueText } from "./format";

// View model for My Boiler. Built from the engine's BoilerResponse by toMyBoilerData (useMyBoiler.ts)
// or from the demo fixture. The optimistic helpers below use the same lib/pressure formulas as the
// server, and the server result replaces them as soon as it arrives.
export interface MyBoilerData {
  name?: string;
  avatarUrl?: string | null;
  result: PressureResult;
  /** Owner-only load items behind the contributions (events are live, never stored). */
  items: LoadItem[];
  status: Status;
  statusNote: string;
  syncedAt: string;
  /** "reconnect" when Google tokens are missing or expired: the score uses tasks only. */
  calendar: CalendarState;
  /** Connected sources (ICS, GitHub) and their health. Absent in the demo. */
  sources?: SourceInfo[];
  /** Per-task extras for source items, keyed by item id. */
  taskMeta?: Record<string, TaskMeta>;
}

/** What a source item (ICS, GitHub) needs beyond its LoadItem: where it came from and its state key. */
export interface TaskMeta {
  sourceId: string;
  itemKey: string;
  label?: string;
  url?: string;
}

export interface NewTask {
  title: string;
  due: string;
  size: Size;
}

/** Re-derive raw, score and zone from the contributions, and shift the forecast by `delta` up to `until`. */
function settle(data: MyBoilerData, contributions: Contribution[], delta: number, until: string | null): MyBoilerData {
  const raw = Math.round(contributions.reduce((s, c) => s + c.points, 0) * 100) / 100;
  const score = scoreFromRaw(raw);
  const untilMs = until ? new Date(until).getTime() : Infinity;
  const forecast: ForecastDay[] = data.result.forecast.map((day, i) => {
    // Day 0 is "now"; later days only feel items that are still ahead of them.
    if (i > 0 && new Date(`${day.date}T00:00:00`).getTime() >= untilMs) return day;
    const s = i === 0 ? score : scoreFromRaw(rawFromScore(day.score) + delta);
    return { ...day, score: s, zone: zoneOf(s) };
  });
  return { ...data, result: { ...data.result, raw, score, zone: zoneOf(score), contributions, forecast } };
}

function setPoints(list: Contribution[], itemId: string, patch: Partial<Contribution>): Contribution[] {
  return list.map((c) => (c.itemId === itemId ? { ...c, ...patch } : c));
}

export function addTask(data: MyBoilerData, task: NewTask, id: string, now: Date): MyBoilerData {
  const item: LoadItem = { id, kind: "task", source: "manual", title: task.title, due: task.due, size: task.size, doneAt: null };
  const points = round1(taskPoints({ due: task.due, size: task.size }, now));
  const contribution: Contribution = { itemId: id, title: task.title, points, reason: `Task ${task.size}, ${dueText(task.due, now)}` };
  const next = { ...data, items: [...data.items, item] };
  return settle(next, [...data.result.contributions, contribution], points, task.due);
}

/** Complete or reopen a task. Returns how much steam was vented (for the burst label). */
export function setTaskDone(data: MyBoilerData, id: string, done: boolean, now: Date): { data: MyBoilerData; vented: number } {
  const item = data.items.find((i) => i.id === id && i.kind === "task");
  if (!item || !item.size) return { data, vented: 0 };
  const before = data.result.contributions.find((c) => c.itemId === id)?.points ?? 0;
  const doneAt = done ? now.toISOString() : null;
  const points = done
    ? // Just completed: the full release, which then fades over COMPLETED_RELEASE_HOURS.
      round2(-COMPLETED_RELEASE * SIZE_POINTS[item.size])
    : round1(taskPoints({ due: item.due, size: item.size }, now));
  const reason = done ? "Release: completed task, fading" : `Task ${item.size}, ${dueText(item.due ?? now.toISOString(), now)}`;
  const title = item.title;
  const items = data.items.map((i) => (i.id === id ? { ...i, doneAt } : i));
  const exists = data.result.contributions.some((c) => c.itemId === id);
  const contributions = exists
    ? setPoints(data.result.contributions, id, { points, reason, title })
    : [...data.result.contributions, { itemId: id, title, points, reason }];
  const delta = points - before;
  const until = done ? new Date(now.getTime() + COMPLETED_RELEASE_HOURS * 3_600_000).toISOString() : (item.due ?? null);
  return { data: settle({ ...data, items }, contributions, delta, until), vented: round1(Math.max(0, -delta)) };
}

/** Change an open task's size. Done tasks keep their release until the server answers. */
export function setTaskSize(data: MyBoilerData, id: string, size: Size, now: Date): MyBoilerData {
  const item = data.items.find((i) => i.id === id && i.kind === "task");
  if (!item || item.size === size) return data;
  const items = data.items.map((i) => (i.id === id ? { ...i, size } : i));
  if (item.doneAt) return { ...data, items };
  const before = data.result.contributions.find((c) => c.itemId === id)?.points ?? 0;
  const points = round1(taskPoints({ due: item.due, size }, now));
  const reason = `Task ${size}, ${dueText(item.due ?? now.toISOString(), now)}`;
  const contributions = setPoints(data.result.contributions, id, { points, reason });
  return settle({ ...data, items }, contributions, points - before, item.due ?? null);
}

/** Open source tasks already past due ("Mark all overdue done"). */
export function overdueSourceTasks(data: MyBoilerData, now: Date): LoadItem[] {
  return data.items.filter(
    (i) => i.kind === "task" && !i.doneAt && !!data.taskMeta?.[i.id] && !!i.due && Date.parse(i.due) < now.getTime(),
  );
}

/** Clear tasks without a vent: they leave the list and stop adding pressure. */
export function clearTasks(data: MyBoilerData, ids: ReadonlySet<string>): MyBoilerData {
  const items = data.items.filter((i) => !ids.has(i.id));
  const removed = data.result.contributions.filter((c) => ids.has(c.itemId)).reduce((s, c) => s + c.points, 0);
  const contributions = data.result.contributions.filter((c) => !ids.has(c.itemId));
  return settle({ ...data, items }, contributions, -removed, null);
}

/** Retag one event, or every event in its series. Points scale by the weight ratio. */
export function setEventWeight(data: MyBoilerData, id: string, weight: Weight, series: boolean): MyBoilerData {
  const target = data.items.find((i) => i.id === id && i.kind === "event");
  if (!target) return data;
  const affected = data.items.filter((i) =>
    i.kind === "event" && !i.release && (i.id === id || (series && !!target.seriesKey && i.seriesKey === target.seriesKey)),
  );
  let contributions = data.result.contributions;
  let delta = 0;
  let latest: string | null = null;
  for (const item of affected) {
    const from = item.weight ?? DEFAULT_WEIGHT;
    const c = contributions.find((x) => x.itemId === item.id);
    if (!c || from === weight) continue;
    const points = round2((c.points * WEIGHTS[weight]) / WEIGHTS[from]);
    delta += points - c.points;
    contributions = setPoints(contributions, item.id, { points, reason: retagReason(c.reason, weight) });
    if (item.start && (!latest || item.start > latest)) latest = item.start;
  }
  const ids = new Set(affected.map((i) => i.id));
  const items = data.items.map((i) => (ids.has(i.id) ? { ...i, weight } : i));
  return settle({ ...data, items }, contributions, delta, latest);
}

export function setStatus(data: MyBoilerData, status: Status, statusNote: string): MyBoilerData {
  return { ...data, status, statusNote: statusNote.slice(0, 80) };
}

function retagReason(reason: string, weight: Weight) {
  const label = WEIGHT_LABEL[weight];
  return /\b(Light|Normal|Heavy)\b/.test(reason) ? reason.replace(/\b(Light|Normal|Heavy)\b/, label) : `${reason}, ${label}`;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
