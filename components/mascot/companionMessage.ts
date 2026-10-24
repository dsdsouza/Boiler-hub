import type { Contribution, ForecastDay, Zone } from "@/lib/types";
import { ZONE_MIN } from "@/lib/pressure";
import { ZONE_LABEL } from "@/components/ui/zones";
import { ZONE_LINE, type Reaction } from "./voice";

// What Pip says on My Boiler, from the same data the page already shows.
// Pure, so it is unit tested and never invents numbers the page can't back up.

export interface CompanionInput {
  score: number;
  zone: Zone;
  forecast: ForecastDay[];
  contributions: Contribution[];
  /** Load items on the page (events and tasks). */
  itemCount: number;
  /** "ok" when the calendar fed this score. Anything else: the page's banner speaks, Pip stays quiet. */
  calendar: string;
  /** Points vented by a task completed in the last few seconds, if any. */
  vented?: number | null;
}

export type CompanionTarget = "forecast" | "breakdown";

export interface CompanionMessage {
  /** Changes whenever the message does; used to reset per-message dismissal. */
  key: string;
  reaction: Reaction;
  headline: string;
  body: string;
  action?: { label: string; target: CompanionTarget };
}

function dayName(date: string, index: number) {
  if (index === 1) return "Tomorrow";
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" });
}

export function companionMessage(input: CompanionInput): CompanionMessage | null {
  const { score, zone, forecast, contributions, itemCount, calendar, vented } = input;
  if (calendar !== "ok") return null;

  if (vented && vented > 0) {
    return {
      key: "vent",
      reaction: "celebrate",
      headline: "A little breathing room.",
      body: `Task done. ${vented.toFixed(1)} points vented, you’re at ${score} (${ZONE_LABEL[zone]}).`,
    };
  }

  if (itemCount === 0) {
    return {
      key: "clear",
      reaction: "wave",
      headline: "Your next 7 days look clear.",
      body: "Nothing on your calendar or task list is adding pressure right now.",
    };
  }

  if (zone === "hot" || zone === "redline") {
    const top = contributions.filter((c) => c.points > 0).sort((a, b) => b.points - a.points)[0];
    const line = ZONE_LINE[zone];
    return {
      key: `high-${zone}`,
      reaction: "attentive",
      headline: line.headline,
      body: top ? `The biggest driver is “${top.title}” (+${top.points.toFixed(1)}). Want to see what can move?` : line.body,
      action: { label: "See what’s driving it", target: "breakdown" },
    };
  }

  // A heavy day ahead while today is still manageable.
  let peak = -1;
  forecast.forEach((d, i) => {
    if (i > 0 && d.score >= ZONE_MIN.hot && (peak < 0 || d.score > forecast[peak]!.score)) peak = i;
  });
  if (peak > 0) {
    const day = forecast[peak]!;
    const name = dayName(day.date, peak);
    return {
      key: `peak-${day.date}`,
      reaction: "idle",
      headline: `${name} looks full.`,
      body: `Your forecast peaks at ${day.score} (${ZONE_LABEL[day.zone]}) ${peak === 1 ? "tomorrow" : `on ${name}`}. Review your week?`,
      action: { label: "Review your week", target: "forecast" },
    };
  }

  return { key: `zone-${zone}`, reaction: "idle", headline: ZONE_LINE[zone].headline, body: ZONE_LINE[zone].body };
}
