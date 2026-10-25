import type { LoadItem, Size, Status, Weight } from "@/lib/types";
import type { BoilerResponse, OwnerEvent, Task } from "@/lib/pressure/api-types";
import type { MyBoilerData, NewTask, TaskMeta } from "./boilerState";

// Maps the engine's route shapes (lib/pressure/api-types.ts) onto My Boiler's view model, and the
// view's actions onto the engine's request bodies. Pure, so it is unit tested.

export function toMyBoilerData(res: BoilerResponse): MyBoilerData {
  return {
    result: res.result,
    items: [...res.events.map((e) => eventItem(e, res.sources ?? [])), ...res.tasks.map(taskItem)],
    status: res.status.status,
    statusNote: res.status.note ?? "",
    syncedAt: res.computedAt,
    pressureComputedAt: res.computedAt,
    ...(res.timeZone ? { timeZone: res.timeZone } : {}),
    calendar: res.calendar,
    sources: res.sources ?? [],
    taskMeta: taskMeta(res.tasks),
    eventOverrides: Object.fromEntries(res.events.filter((e) => e.override).map((e) => [e.id, e.override!])),
    courses: courses([...res.tasks, ...res.events]),
  };
}

function courses(items: Array<{ id: string; course?: string }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of items) {
    const c = i.course?.trim();
    if (c) out[i.id] = c;
  }
  return out;
}

function taskMeta(tasks: Task[]): Record<string, TaskMeta> {
  const out: Record<string, TaskMeta> = {};
  for (const t of tasks) {
    if (!t.sourceId || !t.itemKey) continue;
    out[t.id] = { sourceId: t.sourceId, itemKey: t.itemKey, ...(t.sourceLabel ? { label: t.sourceLabel } : {}), ...(t.url ? { url: t.url } : {}), ...(t.courseName ? { courseName: t.courseName } : {}), ...(t.completedInSource ? { completedInSource: true } : {}) };
  }
  return out;
}

function eventItem(e: OwnerEvent, sources: BoilerResponse["sources"]): LoadItem {
  return {
    id: e.id,
    kind: "event",
    source: sources.find((s) => s.id === e.id.split(":")[0])?.kind ?? "google",
    title: e.title,
    start: e.start,
    end: e.end,
    weight: e.weight,
    attendees: e.attendees,
    isOrganizer: e.isOrganizer,
    seriesKey: e.seriesKey,
    isRecurring: e.isRecurring,
    release: e.release,
  };
}

function taskItem(t: Task): LoadItem {
  return {
    id: t.id,
    kind: "task",
    source: t.source,
    title: t.title,
    due: t.dueAt ?? undefined,
    doneAt: t.doneAt,
    size: t.size,
  };
}

/** POST /api/tasks */
export function newTaskBody(task: NewTask): { title: string; due_at?: string; size: Size } {
  return { title: task.title, ...(task.due ? { due_at: task.due } : {}), size: task.size };
}

/** PATCH /api/tasks/[id] */
export function taskDoneBody(done: boolean): { done: boolean } {
  return { done };
}

/** PATCH /api/sources/items: done and/or size for one source item. */
export function sourceItemBody(meta: TaskMeta, patch: { done?: boolean; size?: Size }) {
  return { sourceId: meta.sourceId, itemKey: meta.itemKey, ...patch };
}

/** PATCH /api/sources/items: clear several items without a vent. */
export function clearItemsBody(metas: TaskMeta[]) {
  return { items: metas.map((m) => ({ sourceId: m.sourceId, itemKey: m.itemKey })), clear: true as const };
}

/** PUT /api/event-weights. `weight: null` clears the override. */
export function eventWeightBody(
  item: Pick<LoadItem, "id" | "seriesKey">,
  weight: Weight | null,
  applyToSeries: boolean,
  clearEventIds: readonly string[] = [],
): { eventId: string; seriesKey?: string; weight: Weight | null; applyToSeries: boolean; clearEventIds?: string[] } {
  const series = applyToSeries && !!item.seriesKey;
  return {
    eventId: item.id,
    ...(series ? { seriesKey: item.seriesKey } : {}),
    weight,
    applyToSeries: series,
    ...(series && clearEventIds.length > 0 ? { clearEventIds: [...clearEventIds] } : {}),
  };
}

/** PATCH /api/me/status. An empty note clears it. */
export function statusBody(status: Status, note?: string): { status: Status; note?: string } {
  return note === undefined ? { status } : { status, note };
}
