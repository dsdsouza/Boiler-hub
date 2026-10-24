import { createHash } from "node:crypto";
import type { LoadItem, Weight } from "@/lib/types";
import type { GoogleEvent } from "./calendar";

// Google events -> LoadItem. Pure apart from hashing.

/** SHA-256 hex. `event_weights.series_key` is this of `recurringEventId`, or of the event id. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Key for a single-event override. */
export const eventKey = (eventId: string) => sha256(eventId);

/** Key for a whole-series override (falls back to the event itself when not recurring). */
export const seriesKeyOf = (e: Pick<GoogleEvent, "id" | "recurringEventId">) => sha256(e.recurringEventId ?? e.id);

/** Whether an event adds or vents pressure at all. Declined, Free, all-day, cancelled and workingLocation do not. */
export function isLoadEvent(e: GoogleEvent): boolean {
  if (e.status === "cancelled") return false;
  if (e.eventType === "workingLocation") return false;
  if (e.transparency === "transparent") return false;
  if (!e.start?.dateTime || !e.end?.dateTime) return false; // all-day
  if (e.attendees?.find((a) => a.self)?.responseStatus === "declined") return false;
  return true;
}

/**
 * Normalize events. `weights` maps series_key -> tag from the user's event_weights rows.
 * A single-event override wins over a series override; with neither, the engine applies its default.
 */
export function normalizeEvents(events: GoogleEvent[], weights: ReadonlyMap<string, Weight> = new Map()): LoadItem[] {
  const items: LoadItem[] = [];
  for (const e of events) {
    if (!isLoadEvent(e)) continue;
    const seriesKey = seriesKeyOf(e);
    const weight = weights.get(eventKey(e.id)) ?? (e.recurringEventId ? weights.get(seriesKey) : undefined);
    const release = e.eventType === "focusTime" || e.eventType === "outOfOffice";
    items.push({
      id: e.id,
      kind: "event",
      source: "google",
      title: e.summary?.trim() || defaultTitle(e),
      start: e.start!.dateTime,
      end: e.end!.dateTime,
      seriesKey,
      isRecurring: Boolean(e.recurringEventId),
      attendees: e.attendees?.filter((a) => a.responseStatus !== "declined").length ?? 0,
      isOrganizer: Boolean(e.organizer?.self),
      ...(weight ? { weight } : {}),
      ...(release ? { release: true } : {}),
    });
  }
  return items;
}

function defaultTitle(e: GoogleEvent): string {
  if (e.eventType === "focusTime") return "Focus time";
  if (e.eventType === "outOfOffice") return "Out of office";
  return "Busy";
}
