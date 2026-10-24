import type { Status, Zone } from "@/lib/types";
import { ZONE_MIN } from "@/lib/pressure/config";
import { zoneFor } from "@/lib/pressure/compute";

// Zone and status metadata shared by every screen. Thresholds come from lib/pressure/config.ts.
export const zoneOf: (score: number) => Zone = zoneFor;

export const ZONES: Zone[] = ["cool", "working", "hot", "redline"];

export const ZONE_LABEL: Record<Zone, string> = {
  cool: "Cool",
  working: "Working",
  hot: "Hot",
  redline: "Redline",
};

export const ZONE_RANGE = Object.fromEntries(
  ZONES.map((z, i) => {
    const next = ZONES[i + 1];
    return [z, `${ZONE_MIN[z]}–${next ? ZONE_MIN[next] - 1 : 100}`];
  }),
) as Record<Zone, string>;

export const ZONE_DESCRIPTION: Record<Zone, string> = {
  cool: "Light workload, with room to recharge",
  working: "A manageable load, keep time for breaks",
  hot: "Heavy workload, stress may be building",
  redline: "An intense load may feel overwhelming, ask for support",
};

/** Fill color, constant across themes. Pair with dark text. */
export const ZONE_FILL: Record<Zone, string> = {
  cool: "#7FB3D5",
  working: "#D1A85A",
  hot: "#F0913A",
  redline: "#F25C45",
};

/** Text color class tuned for the current theme's page ground. */
export const ZONE_INK: Record<Zone, string> = {
  cool: "text-cool-ink",
  working: "text-working-ink",
  hot: "text-hot-ink",
  redline: "text-redline-ink",
};

export const ZONE_INK_VAR: Record<Zone, string> = {
  cool: "var(--cool-ink)",
  working: "var(--working-ink)",
  hot: "var(--hot-ink)",
  redline: "var(--redline-ink)",
};

export const STATUSES: Status[] = ["open", "heads_down", "running_hot", "away"];

export const STATUS_META: Record<Status, { label: string; color: string }> = {
  open: { label: "Open for work", color: "#7FB3D5" },
  heads_down: { label: "Heads down", color: "#D1A85A" },
  running_hot: { label: "Running hot", color: "#F25C45" },
  away: { label: "Away", color: "#B3A48C" },
};
