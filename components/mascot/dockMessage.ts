import type { Counts, ForecastDay, Zone } from "@/lib/types";
import { ZONE_MIN } from "@/lib/pressure";
import { WINDOW_DAYS } from "@/lib/pressure/config";
import { weekday } from "@/components/boiler/format";
import { ZONE_LABEL } from "@/components/ui/zones";
import { ZONE_LINE, type Reaction } from "./voice";

// What Pip says in the corner dock. It only has the stored snapshot (no live
// contributions), so it speaks from score, zone, forecast and how old the reading is.

export interface Snapshot {
  score: number;
  zone: Zone;
  counts: Counts;
  forecast: ForecastDay[];
  computedAt: string;
}

export interface DockMessage {
  key: string;
  reaction: Reaction;
  headline: string;
  body: string;
  action: { label: string; href: string };
  /** Worth opening: shows a dot on the closed dock. */
  attention: boolean;
  /** No reading yet: Pip's glass is nearly empty. */
  empty?: boolean;
}

/** Past this, the stored score is too old to comment on. */
export const STALE_MS = 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dockMessage(snapshot: Snapshot | null, now: number): DockMessage {
  if (!snapshot) {
    return {
      key: "empty",
      reaction: "wave",
      headline: "Nothing in the boiler yet.",
      body: `Connect your calendar and I’ll take a first reading of your next ${WINDOW_DAYS} days.`,
      action: { label: "Get started", href: "/onboarding" },
      attention: false,
      empty: true,
    };
  }

  const age = now - new Date(snapshot.computedAt).getTime();
  if (age > STALE_MS) {
    const days = Math.floor(age / DAY_MS);
    return {
      key: "stale",
      reaction: "idle",
      headline: `My last reading was ${days <= 1 ? "yesterday" : `${days} days ago`}.`,
      body: "Open My Boiler and I’ll take a fresh one.",
      action: { label: "Open My Boiler", href: "/boiler" },
      attention: false,
    };
  }

  const { zone } = snapshot;
  if (zone === "hot" || zone === "redline") {
    return {
      key: `high-${zone}`,
      reaction: "attentive",
      headline: ZONE_LINE[zone].headline,
      body: ZONE_LINE[zone].body,
      action: { label: "Open My Boiler", href: "/boiler" },
      attention: true,
    };
  }

  // A heavy day ahead while today is manageable. Dates, not indexes: the snapshot may be from yesterday.
  const today = new Date(now);
  const todayKey = ymd(today);
  const tomorrowKey = ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
  let peak: ForecastDay | null = null;
  for (const d of snapshot.forecast) {
    if (d.date > todayKey && d.score >= ZONE_MIN.hot && (!peak || d.score > peak.score)) peak = d;
  }
  if (peak) {
    const isTomorrow = peak.date === tomorrowKey;
    const name = isTomorrow ? "Tomorrow" : weekday(peak.date, true);
    return {
      key: `peak-${peak.date}`,
      reaction: "idle",
      headline: `${name} looks full.`,
      body: `Your forecast peaks at ${peak.score} (${ZONE_LABEL[peak.zone]}) ${isTomorrow ? "tomorrow" : `on ${name}`}. Want to look ahead?`,
      action: { label: "Review your week", href: "/boiler" },
      attention: true,
    };
  }

  return {
    key: `zone-${zone}`,
    reaction: "idle",
    headline: ZONE_LINE[zone].headline,
    body: ZONE_LINE[zone].body,
    action: { label: "Open My Boiler", href: "/boiler" },
    attention: false,
  };
}
