import type { ForecastDay, LoadItem, PressureResult, Size, Source } from "@/lib/types";
import { SIZE_POINTS, WINDOW_DAYS, computePressure, isStaleOverdue, taskHorizonDays, OVERDUE_GRACE_DAYS, OVERDUE_STALE_DAYS, NO_DUE_DAYS } from "@/lib/pressure";
import { formatLocal, startOfLocalDay } from "./time";

// Personal what-if simulator. Pure: no I/O, no writes, no mutation of its inputs.
// Baseline and simulated results both come from the production engine (computePressure) with the
// same items, evaluation time and timezone. Only the one selected task differs between them.

const DAY_MS = 24 * 60 * 60 * 1000;
const SIZES = Object.keys(SIZE_POINTS) as Size[];
const IMPORTED_SOURCES: readonly Source[] = ["ics", "github"];

export type WhatIfChange =
  | { type: "size"; taskId: string; size: Size }
  | { type: "deadline"; taskId: string; due: string }
  | { type: "complete"; taskId: string };

export interface WhatIfInput {
  items: readonly Readonly<LoadItem>[];
  /** Evaluation time for both runs. */
  now: Date;
  /** IANA calendar zone for both runs' forecast day boundaries. */
  timeZone: string;
  /** One hypothetical change, or null for the baseline (also what Reset produces). */
  change: WhatIfChange | null;
  /** Last instant the supplied calendar events cover. Defaults to the production 7-day fetch window. */
  eventsCoveredThrough?: Date;
}

export type InvalidCode = "unknown-task" | "ambiguous-task" | "not-a-task" | "already-complete" | "invalid-size" | "invalid-deadline";

/**
 * baseline: no change requested. unchanged: the request matches the task's current state.
 * applied: simulated differs from baseline inputs. invalid: request rejected, simulated equals baseline.
 */
export type WhatIfStatus = "baseline" | "unchanged" | "applied" | "invalid";

export type TaskState = "counted" | "outside-window" | "complete";

export interface TaskSnapshot {
  state: TaskState;
  size: Size;
  due: string | null;
  /** Points the task contributes to raw pressure (engine contribution, rounded to 2 decimals). */
  points: number;
}

export interface ForecastComparisonDay {
  date: string;
  baseline: ForecastDay;
  simulated: ForecastDay;
  /** Simulated minus baseline score. */
  delta: number;
  /** partial: events starting after the supplied coverage are missing from this day's 7-day look-ahead. */
  eventCoverage: "full" | "partial";
}

export interface CoverageSummary {
  eventsCoveredThrough: string;
  partialEventDays: number;
  tasks: {
    openNoDueDate: number;
    outsideWindowNow: number;
    enterWindowDuringForecast: number;
    overdue: number;
    staleOverdue: number;
    invalidDue: number;
  };
}

export interface WhatIfResult {
  status: WhatIfStatus;
  change: WhatIfChange | null;
  invalid?: { code: InvalidCode; message: string };
  evaluatedAt: string;
  timeZone: string;
  /** Engine result for the unmodified inputs. */
  baseline: PressureResult;
  /** Engine result with the change. The same object as `baseline` unless status is "applied". */
  simulated: PressureResult;
  task: { id: string; title: string; source: Source; imported: boolean; before: TaskSnapshot; after: TaskSnapshot } | null;
  delta: { score: number; raw: number; zoneChanged: boolean; tasksDue: number; overdue: number };
  forecast: ForecastComparisonDay[];
  assumptions: string[];
  coverage: CoverageSummary;
  coverageNotes: string[];
}

/** Mirrors the engine: a task is open unless its completion time has already passed. */
export function isOpenTask(item: Pick<LoadItem, "kind" | "doneAt">, now: Date): boolean {
  if (item.kind !== "task") return false;
  return !item.doneAt || !(Date.parse(item.doneAt) <= now.getTime());
}

export function currentSize(item: Pick<LoadItem, "size">): Size {
  return item.size ?? "M";
}

export function simulateWhatIf(input: WhatIfInput): WhatIfResult {
  const { items, now, timeZone, change } = input;
  if (!Number.isFinite(now.getTime())) throw new RangeError("Evaluation time is invalid");

  const baseline = computePressure(items as LoadItem[], now, { timeZone });
  const coveredThrough = input.eventsCoveredThrough ?? new Date(now.getTime() + WINDOW_DAYS * DAY_MS);
  const base = { evaluatedAt: now.toISOString(), timeZone, baseline };

  if (!change) return finish({ ...base, status: "baseline", change: null, simulated: baseline, items, now, coveredThrough, target: null });

  const matches = items.filter((i) => i.id === change.taskId);
  const reject = (code: InvalidCode, message: string, target: Readonly<LoadItem> | null = null) =>
    finish({ ...base, status: "invalid", change, invalid: { code, message }, simulated: baseline, items, now, coveredThrough, target });

  if (matches.length === 0) return reject("unknown-task", "That task is not in the data.");
  if (matches.length > 1) return reject("ambiguous-task", "More than one item shares that id.");
  const target = matches[0];
  if (target.kind !== "task") return reject("not-a-task", "Only tasks can be changed.", target);
  if (!isOpenTask(target, now)) return reject("already-complete", "That task is already complete.", target);

  let changed: LoadItem;
  switch (change.type) {
    case "size":
      if (!SIZES.includes(change.size)) return reject("invalid-size", "Choose size S, M or L.", target);
      if (change.size === currentSize(target)) return finish({ ...base, status: "unchanged", change, simulated: baseline, items, now, coveredThrough, target });
      changed = { ...target, size: change.size };
      break;
    case "deadline": {
      const due = Date.parse(change.due);
      if (typeof change.due !== "string" || !Number.isFinite(due)) return reject("invalid-deadline", "That deadline is not a valid date.", target);
      if (target.due && Date.parse(target.due) === due) return finish({ ...base, status: "unchanged", change, simulated: baseline, items, now, coveredThrough, target });
      changed = { ...target, due: new Date(due).toISOString() };
      break;
    }
    case "complete":
      changed = { ...target, doneAt: now.toISOString() };
      break;
    default:
      return reject("unknown-task", "Unsupported change.", target);
  }

  const simulatedItems = items.map((i) => (i === target ? changed : i));
  const simulated = computePressure(simulatedItems, now, { timeZone });
  return finish({ ...base, status: "applied", change, simulated, items: simulatedItems, now, coveredThrough, target, changed });
}

interface FinishArgs {
  status: WhatIfStatus;
  change: WhatIfChange | null;
  invalid?: { code: InvalidCode; message: string };
  evaluatedAt: string;
  timeZone: string;
  baseline: PressureResult;
  simulated: PressureResult;
  items: readonly Readonly<LoadItem>[];
  now: Date;
  coveredThrough: Date;
  target: Readonly<LoadItem> | null;
  changed?: Readonly<LoadItem>;
}

function finish(a: FinishArgs): WhatIfResult {
  const { baseline, simulated, target, now } = a;
  const coverage = coverageFor(a.items, now, a.timeZone, a.coveredThrough);
  const forecast = baseline.forecast.map((b, i): ForecastComparisonDay => ({
    date: b.date,
    baseline: b,
    simulated: simulated.forecast[i],
    delta: simulated.forecast[i].score - b.score,
    eventCoverage: i < WINDOW_DAYS && coverage.partialDays.has(i) ? "partial" : "full",
  }));

  return {
    status: a.status,
    change: a.change,
    invalid: a.invalid,
    evaluatedAt: a.evaluatedAt,
    timeZone: a.timeZone,
    baseline,
    simulated,
    task: target
      ? {
          id: target.id,
          title: target.title,
          source: target.source,
          imported: IMPORTED_SOURCES.includes(target.source),
          before: snapshot(target, baseline, now),
          after: snapshot(a.changed ?? target, simulated, now),
        }
      : null,
    delta: {
      score: simulated.score - baseline.score,
      raw: simulated.raw - baseline.raw,
      zoneChanged: simulated.zone !== baseline.zone,
      tasksDue: simulated.counts.tasksDue - baseline.counts.tasksDue,
      overdue: simulated.counts.overdue - baseline.counts.overdue,
    },
    forecast,
    assumptions: assumptionsFor(a),
    coverage: coverage.summary,
    coverageNotes: coverageNotes(coverage.summary),
  };
}

function snapshot(item: Readonly<LoadItem>, result: PressureResult, now: Date): TaskSnapshot {
  const points = result.contributions.find((c) => c.itemId === item.id)?.points ?? 0;
  const state: TaskState = !isOpenTask(item, now) ? "complete" : points > 0 ? "counted" : "outside-window";
  return { state, size: currentSize(item), due: item.due ?? null, points };
}

function coverageFor(items: readonly Readonly<LoadItem>[], now: Date, timeZone: string, coveredThrough: Date) {
  const nowMs = now.getTime();
  const partialDays = new Set<number>();
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const dayStart = i === 0 ? nowMs : startOfLocalDay(nowMs, timeZone, i);
    if (dayStart + WINDOW_DAYS * DAY_MS > coveredThrough.getTime()) partialDays.add(i);
  }
  const lastDayStart = startOfLocalDay(nowMs, timeZone, WINDOW_DAYS - 1);
  const tasks = { openNoDueDate: 0, outsideWindowNow: 0, enterWindowDuringForecast: 0, overdue: 0, staleOverdue: 0, invalidDue: 0 };
  for (const item of items) {
    if (!isOpenTask(item, now)) continue;
    if (!item.due) {
      tasks.openNoDueDate += 1;
      continue;
    }
    const due = Date.parse(item.due);
    if (!Number.isFinite(due)) tasks.invalidDue += 1;
    else if (due < nowMs) {
      tasks.overdue += 1;
      if (isStaleOverdue(item.due, now)) tasks.staleOverdue += 1;
    } else if (due >= nowMs + taskHorizonDays(item.title) * DAY_MS) {
      tasks.outsideWindowNow += 1;
      if (due < lastDayStart + taskHorizonDays(item.title) * DAY_MS) tasks.enterWindowDuringForecast += 1;
    }
  }
  return {
    partialDays,
    summary: { eventsCoveredThrough: coveredThrough.toISOString(), partialEventDays: partialDays.size, tasks } satisfies CoverageSummary,
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function coverageNotes(c: CoverageSummary): string[] {
  const notes: string[] = [];
  const t = c.tasks;
  if (c.partialEventDays > 0) {
    notes.push(
      `Calendar events are included only through ${c.eventsCoveredThrough.slice(0, 10)}. Each forecast day looks ${WINDOW_DAYS} days ahead, so ${plural(c.partialEventDays, "day is", "days are")} missing events that start later.`,
    );
  }
  if (t.openNoDueDate > 0) notes.push(`${plural(t.openNoDueDate, "open task has", "open tasks have")} no deadline and ${t.openNoDueDate === 1 ? "counts" : "count"} as due in ${NO_DUE_DAYS} days on every day.`);
  if (t.outsideWindowNow > 0) {
    const later = t.enterWindowDuringForecast > 0 ? `; ${t.enterWindowDuringForecast} enter${t.enterWindowDuringForecast === 1 ? "s" : ""} their preparation window during the forecast` : "";
    notes.push(`${plural(t.outsideWindowNow, "open task is", "open tasks are")} outside its preparation window and ${t.outsideWindowNow === 1 ? "adds" : "add"} nothing today${later}.`);
  }
  if (t.staleOverdue > 0) notes.push(`${plural(t.staleOverdue, "task is", "tasks are")} overdue by more than ${OVERDUE_STALE_DAYS} days and counted at reduced weight.`);
  if (t.invalidDue > 0) notes.push(`${plural(t.invalidDue, "open task has", "open tasks have")} an unreadable deadline and ${t.invalidDue === 1 ? "is" : "are"} left out.`);
  notes.push("Only the items provided are modeled. A disconnected or failing source adds nothing, and events that are not on the calendar are unknown.");
  return notes;
}

function assumptionsFor(a: FinishArgs): string[] {
  const out = [
    "Both results come from the production pressure engine with the same tasks, events, evaluation time and timezone. Only the selected task differs.",
    "Forecast: each future day is scored at the start of that local day. Open tasks due before that day are assumed finished on time and drop out; tasks already overdue today stay counted every day.",
    "Calendar events are held fixed as provided. Nothing is added for new meetings or recurring events beyond the supplied data.",
    "Points are relative effort, not hours or grades.",
  ];
  const { change, target, timeZone } = a;
  if (!change || !target || a.status === "invalid") return out;
  if (change.type === "complete") out.push("Marking complete removes this task from today and every forecast day. It never offsets other work.");
  if (change.type === "size") out.push(`Size changes scale this task's points (S ${SIZE_POINTS.S}, M ${SIZE_POINTS.M}, L ${SIZE_POINTS.L}) at its existing deadline.`);
  if (change.type === "deadline") {
    out.push(
      `This task's preparation window ends at ${taskHorizonDays(target.title)} days. Unfinished overdue work keeps its at-deadline weight for ${OVERDUE_GRACE_DAYS} days, then ages gradually. Times show in ${timeZone}${target.due ? `; the current deadline is ${formatLocal(target.due, timeZone)}` : ""}.`,
    );
  }
  if (IMPORTED_SOURCES.includes(target.source)) out.push("This task is imported. The change is hypothetical and does not edit the source or your school's deadline.");
  return out;
}
