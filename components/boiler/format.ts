import type { Counts, ForecastDay, Weight } from "@/lib/types";

export const WEIGHT_LABEL: Record<Weight, string> = { light: "Light", normal: "Normal", heavy: "Heavy" };

const DAY = 86_400_000;

/** "overdue", "due today", "due tomorrow" or "due in N days", by local calendar day. */
export function dueText(due: string, now: Date): string {
  if (new Date(due).getTime() < now.getTime()) return "overdue";
  const dueDay = new Date(due);
  const dayDiff = Math.round(
    (new Date(dueDay.getFullYear(), dueDay.getMonth(), dueDay.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      DAY,
  );
  if (dayDiff <= 0) return "due today";
  if (dayDiff === 1) return "due tomorrow";
  return `due in ${dayDiff} days`;
}

export function formatPoints(p: number) {
  return `${p < 0 ? "−" : "+"}${Math.abs(p).toFixed(1)}`;
}

export function timeAgo(iso: string, now: Date = new Date()) {
  const mins = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "2026-10-24" → local weekday, without the UTC shift `new Date(str)` causes. */
export function weekday(ymd: string, long = false) {
  const [y, m, d] = ymd.split("-").map(Number);
  const day = new Date(y!, m! - 1, d!).getDay();
  return (long ? WEEKDAY_LONG : WEEKDAY)[day]!;
}

/** Team-safe category counts: "14 meetings · 16.5 h · 4 due · 1 overdue". */
export function countsLine(c: Counts, type: "class" | "work" = "work") {
  const noun = type === "class" ? (c.meetings === 1 ? "class" : "classes") : c.meetings === 1 ? "meeting" : "meetings";
  const parts = [`${c.meetings} ${noun}`, `${c.meetingHours} h`, `${c.tasksDue} due`];
  if (c.overdue) parts.push(`${c.overdue} overdue`);
  return parts.join(" · ");
}

export function forecastCaption(days: ForecastDay[]) {
  const ahead = days.slice(1);
  if (!ahead.length) return "";
  const peak = ahead.reduce((a, b) => (b.score > a.score ? b : a));
  if (peak.score >= 70) return `${weekday(peak.date, true)} is already lit`;
  if (ahead.every((d) => d.score < 40)) return "A calm week ahead";
  return "A steady week ahead";
}
