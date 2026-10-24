import { WINDOW_DAYS } from "@/lib/pressure/config";
import { GoogleReconnectError } from "./client";

// Google Calendar REST, primary calendar only. Events are fetched live and never stored.

const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const FIELDS =
  "timeZone,nextPageToken,items(id,status,summary,start,end,transparency,eventType,recurringEventId,organizer(self),attendees(self,responseStatus))";
const MAX_PAGES = 10;

/** The subset of a Google Calendar event we read. */
export interface GoogleEvent {
  id: string;
  status?: "confirmed" | "tentative" | "cancelled";
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  transparency?: "opaque" | "transparent";
  eventType?: "default" | "focusTime" | "outOfOffice" | "workingLocation" | "fromGmail" | "birthday";
  recurringEventId?: string;
  organizer?: { self?: boolean };
  attendees?: { self?: boolean; responseStatus?: "needsAction" | "declined" | "tentative" | "accepted" }[];
}

export interface CalendarWeek {
  events: GoogleEvent[];
  /** The calendar's IANA time zone, used for forecast day boundaries. UTC if Google sent none. */
  timeZone: string;
  /** The zone exactly as Google reported it; absent when it sent none. */
  reportedTimeZone?: string;
}

/** Primary-calendar events from `now` to now + 7 days, recurring events expanded. */
export async function fetchPrimaryEvents(accessToken: string, now: Date): Promise<CalendarWeek> {
  const events: GoogleEvent[] = [];
  let reportedTimeZone: string | undefined;
  let pageToken: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
      fields: FIELDS,
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`${EVENTS_URL}?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (res.status === 401) throw new GoogleReconnectError("calendar rejected the access token");
    if (res.status === 403) throw new GoogleReconnectError("calendar access not granted");
    if (!res.ok) throw new Error(`Google Calendar fetch failed (${res.status})`);

    const body = (await res.json()) as { items?: GoogleEvent[]; nextPageToken?: string; timeZone?: string };
    events.push(...(body.items ?? []));
    if (body.timeZone) reportedTimeZone = body.timeZone;
    pageToken = body.nextPageToken;
    if (!pageToken) break;
  }

  return { events, timeZone: reportedTimeZone ?? "UTC", ...(reportedTimeZone ? { reportedTimeZone } : {}) };
}
