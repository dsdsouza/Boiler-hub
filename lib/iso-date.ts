/** An explicit ISO date-time, with a real calendar date and a timezone. */
export function parseISODate(value: unknown): string | false {
  if (typeof value !== "string") return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!m) return false;
  const [, y, mo, d, h, mi, s = "0", , oh = "0", om = "0"] = m;
  const year = +y, month = +mo, day = +d;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1]! || +h > 23 || +mi > 59 || +s > 59 || +oh > 23 || +om > 59) return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : false;
}
