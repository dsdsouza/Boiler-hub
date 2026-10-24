import type { LoadItem, Size, Status, Weight } from "@/lib/types";
import type { BoilerResponse, OwnerEvent, Task } from "@/lib/pressure/api-types";
import type { MyBoilerData, NewTask } from "./boilerState";

// Maps the engine's route shapes (lib/pressure/api-types.ts) onto My Boiler's view model, and the
// view's actions onto the engine's request bodies. Pure, so it is unit tested.

export function toMyBoilerData(res: BoilerResponse): MyBoilerData {
  return {
    result: res.result,
    items: [...res.events.map(eventItem), ...res.tasks.map(taskItem)],
    status: res.status.status,
    statusNote: res.status.note ?? "",
    syncedAt: res.computedAt,
    calendar: res.calendar,
  };
}

function eventItem(e: OwnerEvent): LoadItem {
  return {
    id: e.id,
    kind: "event",
    source: "google",
    title: e.title,
    start: e.start,
    end: e.end,
    weight: e.weight,
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

/** PUT /api/event-weights. `weight: null` clears the override. */
export function eventWeightBody(
  item: Pick<LoadItem, "id" | "seriesKey">,
  weight: Weight | null,
  applyToSeries: boolean,
): { eventId: string; seriesKey?: string; weight: Weight | null; applyToSeries: boolean } {
  const series = applyToSeries && !!item.seriesKey;
  return { eventId: item.id, ...(series ? { seriesKey: item.seriesKey } : {}), weight, applyToSeries: series };
}

/** PATCH /api/me/status. An empty note clears it. */
export function statusBody(status: Status, note?: string): { status: Status; note?: string } {
  return note === undefined ? { status } : { status, note };
}
