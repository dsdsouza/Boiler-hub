import type { PressureResult, Size, Source, Status, Weight } from "@/lib/types";

// Response shapes of the engine routes (/api/me/boiler, /api/sync, /api/tasks, /api/event-weights).
// Types only, safe to import from client components.

export interface Task {
  id: string;
  title: string;
  dueAt: string | null;
  size: Size;
  doneAt: string | null;
  source: Exclude<Source, "google">;
  assignmentId: string | null;
}

/** One of the owner's calendar events, for the Light/Normal/Heavy tagger. Built live, never stored. */
export interface OwnerEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  /** Resolved tag (override or default). */
  weight: Weight;
  /** Where `weight` came from: a single-event override, a series override, or the default. */
  override: "event" | "series" | null;
  seriesKey: string;
  isRecurring: boolean;
  /** Focus time or out of office: vents pressure, not taggable. */
  release: boolean;
}

/** `reconnect`: Google tokens are missing or expired; the score uses tasks only and is not saved. */
export type CalendarState = "ok" | "reconnect";

export interface BoilerResponse {
  result: PressureResult;
  /** Open tasks plus tasks completed in the last 48 hours. */
  tasks: Task[];
  events: OwnerEvent[];
  status: { status: Status; note: string | null };
  calendar: CalendarState;
  computedAt: string;
}
