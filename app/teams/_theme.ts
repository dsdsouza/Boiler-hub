import type { Counts, Status, Visibility, Zone } from "@/lib/types";

// Local palette from docs/design/README.md.
// TODO(merge): switch to components/ui tokens once the ui track lands them.
export const C = {
  bg: "#15120E",
  surface: "#1F1A14",
  surface2: "#2A231B",
  line: "#3A3027",
  rivet: "#6B5A44",
  muted: "#B3A48C",
  text2: "#D9CCB5",
  text: "#F1E7D3",
  brass: "#D1A85A",
  brassLight: "#E3BE74",
} as const;

export const ZONE_COLOR: Record<Zone, string> = {
  cool: "#7FB3D5",
  working: "#D1A85A",
  hot: "#F0913A",
  redline: "#F25C45",
};

export const ZONE_LABEL: Record<Zone, string> = { cool: "Cool", working: "Working", hot: "Hot", redline: "Redline" };

export const STATUS_META: Record<Status, { label: string; color: string }> = {
  open: { label: "Open for work", color: "#7FB3D5" },
  heads_down: { label: "Heads down", color: "#D1A85A" },
  running_hot: { label: "Running hot", color: "#F25C45" },
  away: { label: "Away", color: "#B3A48C" },
};

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

export function countsLine(c: Counts): string {
  const parts = [plural(c.meetings, "meeting", "meetings"), plural(c.tasksDue, "due", "due")];
  if (c.overdue) parts.push(`${c.overdue} overdue`);
  return parts.join(" · ");
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export const MONO = "font-[family-name:var(--font-mono)]";
export const DISPLAY = "font-[family-name:var(--font-display)] font-normal";
