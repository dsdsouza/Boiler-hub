// Client-safe helpers for the sources UI and routes. No node-only imports.

const COURSEWORK_HOSTS = /(^|\.)(brightspace\.com|d2l\.com|desire2learn\.com|instructure\.com)$|canvas/i;

/** Brightspace and Canvas feeds are coursework feeds: their all-day entries are deadlines. */
export function isCourseworkUrl(raw: string): boolean {
  try {
    const host = new URL(raw.trim().replace(/^webcals?:\/\//i, "https://")).hostname;
    return COURSEWORK_HOSTS.test(host);
  } catch {
    return false;
  }
}

/** A default label for a pasted feed URL. */
export function defaultFeedLabel(raw: string): string {
  try {
    const host = new URL(raw.trim().replace(/^webcals?:\/\//i, "https://")).hostname;
    if (/brightspace|d2l|desire2learn/i.test(host)) return "Brightspace";
    if (/instructure|canvas/i.test(host)) return "Canvas";
    if (/outlook|office365|live\.com/i.test(host)) return "Outlook";
    return "Calendar feed";
  } catch {
    return "Calendar feed";
  }
}

/** Badge text for a task's source. */
export function sourceBadge(source: string, label?: string): string {
  if (source === "manual") return "Manual";
  if (source === "team") return "Team";
  if (source === "github") return "GitHub";
  return label ?? "ICS";
}
