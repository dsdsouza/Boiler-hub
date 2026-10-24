import type { Visibility } from "@/lib/types";
import { ZONE_INK_VAR } from "@/components/ui/zones";

// Teams styling on top of the ui track's tokens (app/globals.css, components/ui/zones.ts), so the
// Engine Room follows the light/dark theme like every other page. Only teams-specific labels live here.
export { STATUS_META, ZONE_LABEL } from "@/components/ui/zones";

/** CSS variables from app/globals.css. */
export const C = {
  bg: "var(--bg)",
  surface: "var(--surface)",
  surface2: "var(--surface-2)",
  line: "var(--line)",
  rivet: "var(--rivet)",
  control: "var(--control)",
  muted: "var(--muted)",
  text2: "var(--text-2)",
  text: "var(--text)",
  field: "var(--field)",
  /** Brass fill: constant across themes. */
  brass: "#D1A85A",
  /** Brass for text and outlines, tuned per theme. */
  brassLight: "var(--brass-ink)",
  /** Text on brass or zone fills (soot in both themes). */
  onFill: "#15120E",
} as const;

/** Zone color for text, borders and small marks, tuned per theme. */
export const ZONE_COLOR = ZONE_INK_VAR;

export const VISIBILITY_META: Record<Visibility, { label: string; explain: string }> = {
  hidden: { label: "Hidden", explain: "Nobody on this team sees your boiler." },
  lead: { label: "Lead only", explain: "Only this team's leads see your boiler." },
  everyone: { label: "Everyone", explain: "Every member of this team sees your boiler." },
};

// Class teams say Teacher/Students; work teams say Lead/Members.
export function teamLabels(type: "class" | "work") {
  return type === "class"
    ? { lead: "Teacher", member: "Student", members: "students", Members: "Students" }
    : { lead: "Lead", member: "Member", members: "members", Members: "Members" };
}

export function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** The ui track's font utilities (app/globals.css @theme). */
export const MONO = "font-mono";
export const DISPLAY = "font-display font-normal";
