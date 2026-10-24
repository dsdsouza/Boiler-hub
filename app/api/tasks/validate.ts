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
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? false : new Date(ms).toISOString();
}
