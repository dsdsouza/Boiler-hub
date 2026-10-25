import type { Size, Weight, Zone } from "@/lib/types";

// Every tunable number in the pressure engine. See docs/PRD.md "Pressure engine".
// Imported by the UI (/how) and the teams track: do not hardcode these elsewhere.

/** Event window and forecast length. */
export const WINDOW_DAYS = 7;
/** Deadlines need preparation time beyond the current calendar week. */
export const TASK_LOOKAHEAD_DAYS = 14;
export const EXAM_LOOKAHEAD_DAYS = 28;
export const TASK_TAPER_DAYS = 2;
export const EXAM_TAPER_DAYS = 7;
export const EVENT_TAPER_DAYS = 1;
/** Fetch enough live data for the full window at every forecast date. */
export const SOURCE_LOOKAHEAD_DAYS = EXAM_LOOKAHEAD_DAYS + WINDOW_DAYS;
export const CALENDAR_LOOKAHEAD_DAYS = WINDOW_DAYS * 2;

/**
 * Event weight tag multipliers.
 * Tuned: light 0.5 → 0.25 (PRD) so recurring rituals (classes, standups) weigh well below one-off
 * meetings; with the PRD value a 25-meeting-hour manager week was only 1.46× a student week.
 */
export const WEIGHTS: Record<Weight, number> = { light: 0.25, normal: 1.0, heavy: 1.6 };

/** Tag used for an event with no user override. */
export const DEFAULT_WEIGHT: Weight = "normal";
export const DEFAULT_RECURRING_WEIGHT: Weight = "light";

/** attendeeFactor = 1 + ATTENDEE_STEP × min(attendees, ATTENDEE_CAP) */
export const ATTENDEE_STEP = 0.03;
export const ATTENDEE_CAP = 10;

/** × when the user organizes the event. */
export const ORGANIZER_FACTOR = 1.2;

/** Task size points. */
export const SIZE_POINTS: Record<Size, number> = { S: 2, M: 4, L: 8 };

/** proximity = 1 / (1 + PROXIMITY_RATE × days from now) */
export const PROXIMITY_RATE = 0.35;

/** Deadline power kernel, with a continuous at-deadline peak and gradual overdue aging. */
export const URGENCY_MIN_DAYS = 0.25;
export const URGENCY_CAP = 3;
export const URGENCY_EXPONENT = 0.475;
export const TASK_K = 26;
export const EXAM_PREPARATION_WEIGHT = 2.75;
export const EXAM_PREPARATION_DAYS = 7;
export const EXAM_DECAY_DAYS = 3;
export const OVERDUE_GRACE_DAYS = 7;
export const OVERDUE_DECAY_DAYS = 7;
/** Stored in the existing counts JSON; never mix raw values from different models. */
export const PRESSURE_MODEL_VERSION = "balanced-v3";

/** A task with no due date is treated as due this many days from now. */
export const NO_DUE_DAYS = 7;

/**
 * Older overdue work counts at a reduced weight until the owner confirms it is complete.
 */
export const OVERDUE_STALE_DAYS = 14;
export const OVERDUE_BACKLOG_URGENCY = 0.5;

/** Completion removes its own load; it never offsets other unfinished work. */
export const COMPLETED_RELEASE = 0;
/** How long completed manual tasks remain available in the normal task response. */
export const COMPLETED_RELEASE_HOURS = 48;

/** Calendar focus/OOO entries are not evidence that assignments have been completed. */
export const FOCUS_RELEASE = 0;

/**
 * score = round(100 × (1 − e^(−max(R, 0) / K)))
 * Calendar scale and common raw unit. Tasks are normalized by K/TASK_K before addition,
 * equivalent to score = 100*(1-exp(-(calendarRaw/K + taskRaw/TASK_K))).
 */
export const K = 8.5;

/** Lowest score of each zone. */
export const ZONE_MIN: Record<Zone, number> = { cool: 0, working: 40, hot: 70, redline: 90 };
