// The instant computePressure's forecast scores day `i`: now for day 0, local midnight in `timeZone`
// otherwise. Mirrors the engine's private partsIn/offsetAt/startOfDay (lib/pressure/compute.ts), which
// are not exported. explain.test.ts checks every day's score against the engine's forecast, so drift
// between the two shows up as a failing test.
// TODO(merge): export the engine's day-start helper and drop this copy.

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function formatterFor(timeZone: string): Intl.DateTimeFormat | null {
  if (timeZone === "UTC") return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });
}

function partsIn(date: Date, formatter: Intl.DateTimeFormat | null): Parts {
  if (!formatter) return {
    year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(),
    hour: date.getUTCHours(), minute: date.getUTCMinutes(), second: date.getUTCSeconds(),
  };
  const out: Record<string, number> = {};
  for (const { type, value } of formatter.formatToParts(date)) {
    if (type !== "literal") out[type] = Number(value);
  }
  return out as Parts;
}

function offsetAt(t: number, formatter: Intl.DateTimeFormat | null): number {
  if (!formatter) return 0;
  const p = partsIn(new Date(t), formatter);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000;
}

function startOfDay(y: number, m: number, d: number, formatter: Intl.DateTimeFormat | null): Date {
  const guess = Date.UTC(y, m - 1, d);
  let t = guess - offsetAt(guess, formatter);
  t = guess - offsetAt(t, formatter);
  return new Date(t);
}

/** `at` is the scoring instant; `date` is the forecast day's "YYYY-MM-DD", as in ForecastDay.date. */
export function forecastInstant(now: Date, dayIndex: number, timeZone: string): { at: Date; date: string } {
  const formatter = formatterFor(timeZone);
  const { year: y, month: m, day: d } = partsIn(now, formatter);
  return {
    at: dayIndex === 0 ? now : startOfDay(y, m, d + dayIndex, formatter),
    date: new Date(Date.UTC(y, m - 1, d + dayIndex)).toISOString().slice(0, 10),
  };
}
