import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccessToken, GoogleReconnectError } from "@/lib/google/client";
import { fetchPrimaryEvents } from "@/lib/google/calendar";
import { zonedTime } from "@/lib/sources/ics";
import type { LoadItem } from "@/lib/types";
import { studyWindows, type BusyInterval, type PipSchedule } from "./planning";

/** Only call after requireUser; userId is the verified caller, never request data. No event persistence. */
export async function scheduleContext(userId: string, timeZone: string, imported: LoadItem[], now: Date): Promise<PipSchedule> {
  const busy: BusyInterval[] = imported.filter((i) => i.kind === "event").map((i) => ({ start: Date.parse(i.start ?? ""), end: Date.parse(i.end ?? "") })).filter((i) => Number.isFinite(i.start) && i.end > i.start);
  let state: PipSchedule["state"] = imported.some((i) => i.kind === "event") ? "partial" : "disconnected";
  try {
    const token = await getAccessToken(createAdminClient(), userId, now);
    const calendar = await fetchPrimaryEvents(token, now);
    for (const event of calendar.events) {
      if (event.status === "cancelled" || event.transparency === "transparent" || event.eventType === "workingLocation" || event.attendees?.some((a) => a.self && a.responseStatus === "declined")) continue;
      const date = (value?: { dateTime?: string; date?: string }) => {
        if (value?.dateTime) return Date.parse(value.dateTime);
        if (value?.date) { const [y, m, d] = value.date.split("-").map(Number); return zonedTime(y, m, d, 0, 0, calendar.timeZone); }
        return NaN;
      };
      const start = date(event.start), end = date(event.end);
      if (Number.isFinite(start) && end > start) busy.push({ start, end });
    }
    state = "connected";
  } catch (error) {
    // Missing calendar access must not make assignment chat disappear or imply a verified empty calendar.
    if (!(error instanceof GoogleReconnectError) && state === "disconnected") state = "partial";
  }
  return { state, busy, windows: studyWindows(busy, timeZone, now.getTime()) };
}
