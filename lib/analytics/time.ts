// Calendar-zone helpers for the what-if simulator. Intl only, no dependencies.
// They mirror the engine's forecast day boundaries so the simulator and engine agree on "a day".

export interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export function localParts(ms: number, timeZone: string): LocalParts {
  const out: Record<string, number> = {};
  for (const { type, value } of partsFormatter(timeZone).formatToParts(new Date(ms))) {
    if (type !== "literal") out[type] = Number(value);
  }
  return out as unknown as LocalParts;
}

/** Zone offset in ms at an instant: the local wall clock read as UTC, minus the instant. */
function offsetAt(ms: number, timeZone: string): number {
  const whole = Math.floor(ms / 1000) * 1000;
  const p = localParts(whole, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - whole;
}

type LocalInput = Partial<LocalParts> & Pick<LocalParts, "year" | "month" | "day">;

/** Instant of a local wall-clock time. Day and month overflow roll over; a skipped hour resolves forward. */
export function instantFromLocal(p: LocalInput, timeZone: string, ms = 0): number {
  const guess = Date.UTC(p.year, p.month - 1, p.day, p.hour ?? 0, p.minute ?? 0, p.second ?? 0, ms);
  const t = guess - offsetAt(guess, timeZone);
  return guess - offsetAt(t, timeZone);
}

/** Start of the local day `daysAhead` calendar days after the day containing `ms`. */
export function startOfLocalDay(ms: number, timeZone: string, daysAhead = 0): number {
  const p = localParts(ms, timeZone);
  return instantFromLocal({ year: p.year, month: p.month, day: p.day + daysAhead }, timeZone);
}

/** Move an ISO instant by whole calendar days, keeping its local clock time (DST safe). */
export function shiftIsoByLocalDays(iso: string, days: number, timeZone: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) throw new RangeError(`Invalid ISO date: ${iso}`);
  const p = localParts(ms, timeZone);
  const sub = ((ms % 1000) + 1000) % 1000;
  return new Date(instantFromLocal({ ...p, day: p.day + days }, timeZone, sub)).toISOString();
}

export function formatLocal(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Weekday for a forecast `YYYY-MM-DD` label. */
export function weekdayOfDate(ymd: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" }).format(new Date(`${ymd}T00:00:00Z`));
}
