const TITLE_MAX = 200;

/** Trimmed title, or null if invalid. */
export function parseTitle(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length >= 1 && t.length <= TITLE_MAX ? t : null;
}

/** ISO string, null (no due date), undefined (not given), or false if invalid. */
export function parseDue(v: unknown): string | null | undefined | false {
  if (v === undefined || v === null) return v;
  if (typeof v !== "string") return false;
  // Require an unambiguous date-time with a timezone. Date.parse alone accepts
  // locale dates, numeric strings and impossible dates such as February 30.
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(v);
  if (!parts) return false;
  const [, yearText, monthText, dayText] = parts;
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1]) return false;
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? false : new Date(ms).toISOString();
}
