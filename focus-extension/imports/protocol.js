/** Only subscription-shaped, public HTTPS URLs are eligible for handoff. */
export function normalizeFeedUrl(raw) {
  if (typeof raw !== "string" || raw.length > 2048 || /[\u0000-\u0020\u007f]/.test(raw.trim())) return null;
  try {
    const url = new URL(raw.trim().replace(/^webcals?:\/\//i, "https://"));
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return null;
    // The server performs DNS/redirect checks as well. Block obvious local targets before handoff.
    if (host.endsWith(".") || !host.includes(".") || /(^|\.)(localhost|local|internal|test|invalid)$/.test(host) || host.includes(":") || /^\d+(\.\d+){3}$/.test(host)) return null;
    const path = url.pathname;
    const feed = /\.ics$/i.test(path) || /\/d2l\/le\/calendar\/feed\//i.test(path)
      || /\/feeds\/calendars\//i.test(path) || /\/webapps\/calendar\/calendarFeed\//i.test(path)
      || /\/calendar\/export_execute\.php$/i.test(path)
      || (/^p\d+-caldav\.icloud\.com$/.test(host) && path.startsWith("/published/"))
      || /^webcals?:\/\//i.test(raw.trim());
    if (!feed) return null;
    // Keep the explicit subscription scheme for extensionless webcal endpoints.
    return /^webcals?:\/\//i.test(raw.trim()) && !/\.ics$/i.test(path) && !/\/d2l\/|\/feeds\/calendars\/|\/calendar\/export_execute\.php|\/webapps\/calendar\/calendarFeed\/|\/published\//i.test(path)
      ? url.href.replace(/^https:/, "webcal:") : url.href;
  } catch { return null; }
}

/** Fragment data is not sent with HTTP requests or the sign-in redirect. */
export function makeHandoffUrl(raw) {
  const feed = normalizeFeedUrl(raw);
  if (!feed) throw new Error("Choose a calendar subscription link.");
  return `https://boilerplate.select/calendar-helper#feed=${encodeURIComponent(feed)}`;
}

export function readHandoff(hash) {
  if (typeof hash !== "string" || hash.length > 8192 || !hash.startsWith("#feed=")) return null;
  try { return normalizeFeedUrl(decodeURIComponent(hash.slice(6))); } catch { return null; }
}

export const PROVIDER_STEPS = {
  Brightspace: "Open Calendar → Settings and enable Calendar Feeds. Then choose Subscribe → All Calendars and Tasks. Leave the subscription dialog open and scan again.",
  Canvas: "Open Calendar, then Calendar Feed in the sidebar. Leave the feed dialog open and scan again.",
  Moodle: "Open Calendar → Export calendar. Choose your courses and a time range covering the term, then Get calendar URL. Scan again with that link visible.",
  Blackboard: "Open Calendar and its settings. Choose Share calendar (Ultra) or Get External Calendar Link (Original). Scan again with the link visible.",
  Other: "Open your school calendar and look for Subscribe, Calendar Feed, Export calendar or an iCalendar link. Open that dialog, then scan again. The school may need to enable calendar feeds first.",
};
