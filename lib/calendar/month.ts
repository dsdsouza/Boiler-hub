export interface MonthDeadline {
  id: string;
  title: string;
  dueAt: string;
  source: string;
  course?: string;
}
export interface MonthCalendar {
  deadlines: MonthDeadline[];
  unavailableSources: number;
  truncated: boolean;
}

export function parseMonth(value: string | null): { year: number; month: number } | null {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  return year >= 2000 && year <= 2100 ? { year, month: Number(value.slice(5)) } : null;
}

/** Civil dates are compared in the calendar's displayed zone, never the server's zone. */
export function calendarDay(value: Date | string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((value) => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function shiftMonth(value: string, delta: number): string {
  const parsed = parseMonth(value);
  if (!parsed) throw new Error("Invalid calendar month");
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Complete Sunday-to-Saturday rows, including the leading/trailing civil dates. */
export function monthDays(value: string): string[] {
  const parsed = parseMonth(value);
  if (!parsed) return [];
  const first = new Date(Date.UTC(parsed.year, parsed.month - 1, 1));
  const length = new Date(Date.UTC(parsed.year, parsed.month, 0)).getUTCDate();
  return Array.from({ length: Math.ceil((first.getUTCDay() + length) / 7) * 7 }, (_, index) =>
    new Date(Date.UTC(parsed.year, parsed.month - 1, index - first.getUTCDay() + 1)).toISOString().slice(0, 10));
}

export function groupDeadlines(deadlines: MonthDeadline[], timeZone: string): Map<string, MonthDeadline[]> {
  const groups = new Map<string, MonthDeadline[]>();
  for (const deadline of [...deadlines].sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.title.localeCompare(b.title))) {
    if (!Number.isFinite(Date.parse(deadline.dueAt))) continue;
    const day = calendarDay(deadline.dueAt, timeZone);
    groups.set(day, [...(groups.get(day) ?? []), deadline]);
  }
  return groups;
}
