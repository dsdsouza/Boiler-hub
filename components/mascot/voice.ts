import type { Zone } from "@/lib/types";
import { ZONE_MIN } from "@/lib/pressure";
import { ZONES } from "@/components/ui/zones";

// Pip's voice, shared by the My Boiler companion and /mascot-preview.
// Supportive and specific: every line names a reason, never guilt.

export const MASCOT_NAME = "Pip";

export type Reaction = "idle" | "wave" | "celebrate" | "attentive";

/** A representative score in the middle of each zone, from the engine's thresholds. */
export const ZONE_PRESET = Object.fromEntries(
  ZONES.map((z, i) => {
    const next = ZONES[i + 1];
    const hi = next ? ZONE_MIN[next] - 1 : 100;
    return [z, Math.round((ZONE_MIN[z] + hi) / 2)];
  }),
) as Record<Zone, number>;

/** One line per zone for the dashboard companion strip. Supportive, never guilt. */
export const ZONE_LINE: Record<Zone, { headline: string; body: string }> = {
  cool: { headline: "Plenty of room this week.", body: "A good time to get ahead on something, or to leave the space open." },
  working: { headline: "Steady pressure.", body: "A full week, but it fits. I’ll flag anything that tips it over." },
  hot: { headline: "Running warm.", body: "Worth a look before you take on more. Want to see what can move?" },
  redline: { headline: "This week is at the red line.", body: "Let’s find one thing to move, shrink or hand off. I can help you look." },
};

/** Words Pip never uses: guilt, shame, nagging, or asking the user to look after the mascot. */
export const BANNED_PHRASES = ["you should", "you must", "don't forget", "falling behind", "disappointed", "sad", "help me", "save me", "lazy", "failed", "streak"];
