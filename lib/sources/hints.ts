// Client-safe helpers for the sources UI and routes. No node-only imports.

import { LMS_LABELS, lmsProvider } from "./lms";

/** Recognized LMS feeds treat all-day entries as deadlines. */
export function isCourseworkUrl(raw: string): boolean {
  return lmsProvider(raw) !== undefined;
}

/** A default label for a pasted feed URL. */
export function defaultFeedLabel(raw: string): string {
  const provider = lmsProvider(raw);
  if (provider) return LMS_LABELS[provider];
  try {
    const host = new URL(raw.trim().replace(/^webcals?:\/\//i, "https://")).hostname;
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
