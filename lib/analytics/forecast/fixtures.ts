import type { LoadItem } from "@/lib/types";

// Labeled synthetic inputs for the forecast explanation tests. Not anyone's data.

export interface ForecastScenario {
  id: string;
  label: string;
  description: string;
  /** Fixed clock so the preview and tests are deterministic. */
  now: string;
  timeZone: string;
  /** End of the synthetic calendar fetch; null when the scenario leaves coverage unknown. */
  eventsLoadedThrough: string | null;
  items: LoadItem[];
}

const task = (id: string, title: string, size: LoadItem["size"], due?: string, doneAt: string | null = null): LoadItem => ({
  id,
  kind: "task",
  source: "manual",
  title,
  size,
  due,
  doneAt,
});

const event = (id: string, title: string, start: string, end: string, extra: Partial<LoadItem> = {}): LoadItem => ({
  id,
  kind: "event",
  source: "google",
  title,
  start,
  end,
  ...extra,
});

// Monday 26 Oct 2026, 9:00 in New York. Clocks fall back on Sunday 1 Nov, inside the window.
const NOW = "2026-10-26T13:00:00.000Z";
/** A sync last Friday fetched events through this instant. */
const STALE_THROUGH = "2026-10-30T13:00:00.000Z";

const MIDTERM_ITEMS: LoadItem[] = [
  task("reading", "Reading response", "S", "2026-10-27T03:00:00.000Z"),
  task("pset4", "Problem set 4", "M", "2026-10-28T03:59:00.000Z"),
  task("discussion", "Discussion post", "S", "2026-10-28T16:00:00.000Z", "2026-10-25T18:00:00.000Z"),
  task("lab", "Lab report", "L", "2026-10-29T21:00:00.000Z"),
  task("essay", "History essay", "L", "2026-11-02T22:00:00.000Z"),
  task("corrections", "Quiz corrections", "S", "2026-10-23T16:00:00.000Z"),
  task("notebook", "Lab notebook backlog", "M", "2026-10-05T16:00:00.000Z"),
  task("flashcards", "Review flashcards", "M"),
  event("lecture", "Chemistry lecture", "2026-10-26T14:00:00.000Z", "2026-10-26T15:15:00.000Z", { isRecurring: true }),
  event("focus", "Focus block", "2026-10-27T13:00:00.000Z", "2026-10-27T16:00:00.000Z", { release: true }),
  event("group", "Study group", "2026-10-28T22:00:00.000Z", "2026-10-28T23:30:00.000Z", { attendees: 5, isOrganizer: true }),
  event("office", "Office hours", "2026-10-29T18:00:00.000Z", "2026-10-29T19:00:00.000Z", { weight: "light" }),
  event("midterm", "Chemistry midterm", "2026-10-30T13:00:00.000Z", "2026-10-30T15:00:00.000Z", { weight: "heavy", attendees: 40 }),
];

export const SCENARIOS: ForecastScenario[] = [
  {
    id: "midterm-week",
    label: "Midterm week, synced just now",
    description: "Eight tasks and five events. Calendar fetched at the same moment, so it reaches seven days from now.",
    now: NOW,
    timeZone: "America/New_York",
    eventsLoadedThrough: "2026-11-02T13:00:00.000Z",
    items: MIDTERM_ITEMS,
  },
  {
    id: "stale-sync",
    label: "Same week, calendar synced 3 days ago",
    description: "Same tasks, but the calendar was last fetched Friday 23 Oct, so events from Friday 30 Oct on were never loaded.",
    now: NOW,
    timeZone: "America/New_York",
    eventsLoadedThrough: STALE_THROUGH,
    // Events past the fetch end were never loaded.
    items: MIDTERM_ITEMS.filter((i) => i.kind !== "event" || Date.parse(i.start!) < Date.parse(STALE_THROUGH)),
  },
  {
    id: "unknown-coverage",
    label: "Quiet week, coverage unknown",
    description: "Two tasks and one event with no calendar fetch time, so the explanation makes no coverage claim.",
    now: NOW,
    timeZone: "America/New_York",
    eventsLoadedThrough: null,
    items: [
      task("memo", "Project memo", "M", "2026-10-29T21:00:00.000Z"),
      task("slides", "Team slides", "S"),
      event("standup", "Team standup", "2026-10-27T14:00:00.000Z", "2026-10-27T14:30:00.000Z", { attendees: 6, isRecurring: true }),
    ],
  },
];

