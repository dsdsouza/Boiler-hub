import type { LoadItem } from "@/lib/types";
import type { SourceInfo } from "@/lib/pressure/api-types";

export interface ScheduleEntry {
  item: LoadItem;
  sourceLabel: string;
}

export interface ScheduleDay {
  key: string;
  date: Date;
  entries: ScheduleEntry[];
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Owner-only coursework events, grouped by the viewer's local calendar days (including DST). */
export function scheduleDays(items: readonly LoadItem[], sources: readonly SourceInfo[], now: Date): ScheduleDay[] {
  const days = Array.from({ length: 7 }, (_, i): ScheduleDay => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + i);
    return { key: dateKey(date), date, entries: [] };
  });
  const coursework = new Map(sources.filter((s) => s.kind === "ics" && s.coursework && s.status === "ok").map((s) => [s.id, s.label]));

  for (const item of items) {
    if (item.kind !== "event" || item.release || !item.start || !item.end) continue;
    const sourceLabel = coursework.get(item.id.split(":")[0]!);
    if (!sourceLabel) continue;
    const start = new Date(item.start);
    const end = new Date(item.end);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || end <= now) continue;
    for (const day of days) {
      const tomorrow = new Date(day.date);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (start < tomorrow && end > day.date) day.entries.push({ item, sourceLabel });
    }
  }
  for (const day of days) day.entries.sort((a, b) => Date.parse(a.item.start!) - Date.parse(b.item.start!));
  return days;
}
