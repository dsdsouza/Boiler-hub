import type { Size, Weight, Zone } from "@/lib/types";

// Every tunable number in the pressure engine. See docs/PRD.md "Pressure engine".
// Imported by the UI (/how) and the teams track: do not hardcode these elsewhere.

/** Load window: only the next N days count. */
export const WINDOW_DAYS = 7;

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

/** urgency = 1 / max(days until due, URGENCY_MIN_DAYS), capped at URGENCY_CAP; overdue = URGENCY_CAP. */
export const URGENCY_MIN_DAYS = 0.25;
export const URGENCY_CAP = 3;

/** A task with no due date is treated as due this many days from now. */
export const NO_DUE_DAYS = 7;

/** Completed task releases COMPLETED_RELEASE × size points, fading linearly to 0 over COMPLETED_RELEASE_HOURS. */
export const COMPLETED_RELEASE = 0.5;
export const COMPLETED_RELEASE_HOURS = 48;

/** Focus time / OOO releases FOCUS_RELEASE × hours × proximity. */
export const FOCUS_RELEASE = 0.5;

/**
 * score = round(100 × (1 − e^(−max(R, 0) / K)))
 * Tuned: 25 → 8.5 (PRD) so the student week lands ~56 and the manager week ~78
 * (see lib/pressure/__fixtures__/weeks.ts).
 */
export const K = 8.5;

/** Lowest score of each zone. */
export const ZONE_MIN: Record<Zone, number> = { cool: 0, working: 40, hot: 70, redline: 90 };
