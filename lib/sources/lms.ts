/** Client-safe LMS recognition. School-owned domains are identified by their feed paths. */
export type LmsProvider = "brightspace" | "canvas" | "moodle" | "blackboard";

export const LMS_LABELS: Record<LmsProvider, string> = {
  brightspace: "Brightspace", canvas: "Canvas", moodle: "Moodle", blackboard: "Blackboard",
};

export function lmsProvider(raw: string): LmsProvider | undefined {
  try {
    const url = new URL(raw.trim().replace(/^webcals?:\/\//i, "https://"));
    if (!/^https?:$/.test(url.protocol)) return;
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    if (/(^|\.)(brightspace|d2l|desire2learn)\.com$/.test(host) || path.startsWith("/d2l/")) return "brightspace";
    if (/(^|\.)instructure\.com$/.test(host) || /(^|\.)canvas\./.test(host) || /^\/feeds\/calendars\//.test(path) || /^\/courses\/\d+(\/|$)/.test(path)) return "canvas";
    if (/(^|\.)moodle\./.test(host) || /\/calendar\/export_execute\.php$/.test(path) || /^\/(mod\/(assign|quiz|forum|lesson|workshop)|course)\/view\.php$/.test(path)) return "moodle";
    if (/(^|\.)blackboard\.com$/.test(host) || /^\/(webapps\/(calendar|blackboard|assessment)|ultra\/courses)(\/|$)/.test(path)) return "blackboard";
  } catch {
    // An incomplete pasted link has no provider yet.
  }
}
