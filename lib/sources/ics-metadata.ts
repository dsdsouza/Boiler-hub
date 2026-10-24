import type { VEvent } from "node-ical";
import { lmsProvider, type LmsProvider } from "./lms";

type Fields = Pick<VEvent, "summary" | "description" | "url" | "location" | "categories">;

export function calendarText(value: VEvent["summary"] | undefined): string {
  return (typeof value === "string" ? value : value?.val ?? "").trim();
}

/** Only source-provided LMS links and course names; no inferred schedules or catalog enrichment. */
export function courseworkMetadata(entry: Fields, fallbackProvider?: LmsProvider) {
  const description = calendarText(entry.description);
  const candidates = [entry.url ?? "", ...Array.from(description.matchAll(/https?:\/\/[^\s<>"']+/gi), (match) => match[0])];
  let url: string | undefined;
  let provider = fallbackProvider;
  let assignment = false;
  for (const candidate of candidates) {
    let parsed: URL;
    try {
      parsed = new URL(candidate.replace(/&amp;/gi, "&").replace(/[.,;]+$/, ""));
    } catch { continue; }
    if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password) continue;
    const path = parsed.pathname.toLowerCase();
    if (/calendar|\.ics$|\/feeds\//.test(path) || [...parsed.searchParams.keys()].some((key) => /token|secret|password/i.test(key))) continue;
    const detected = lmsProvider(parsed.href);
    if (!detected) continue;
    const isAssignment = /\/courses\/\d+\/(assignments|quizzes|discussion_topics)\//.test(path)
      || /\/d2l\/(lms\/(dropbox|quizzing|discussions)|le\/content\/\d+\/viewcontent)/.test(path)
      || /\/mod\/(assign|quiz|forum|lesson|workshop)\/view\.php$/.test(path)
      || /\/webapps\/assessment\/|\/ultra\/courses\/[^/]+\/outline\/assessment/.test(path);
    // Prefer an assignment over a course-home link found earlier in a description.
    if (!url || isAssignment && !assignment) {
      url = parsed.href;
      provider = detected;
      assignment = isAssignment;
    }
  }

  let courseName: string | undefined;
  if (provider === "canvas") courseName = calendarText(entry.summary).match(/\[([^\[\]]+)\]\s*$/)?.[1]?.trim();
  if (provider === "brightspace" && url) courseName = calendarText(entry.location) || undefined;
  if (provider === "moodle") courseName = entry.categories?.map((c) => c.trim()).find(Boolean);
  return { assignment, ...(url ? { url } : {}), ...(courseName ? { courseName: courseName.slice(0, 200) } : {}) };
}
