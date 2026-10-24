import type { LoadItem } from "@/lib/types";

export const FOCUS_DOMAINS = [
  "youtube.com",
  "instagram.com",
  "tiktok.com",
  "reddit.com",
  "x.com",
] as const;
export type CourseMaterial = { id: string; title: string; text: string };
export type StudyContext = {
  sources: CourseMaterial[];
  commitment?: {
    title: string;
    goal: string;
    startsAt: string;
    endsAt: string;
  };
};
export type FocusSession = {
  id: string;
  taskId: string;
  title: string;
  goal: string;
  scope: "demo" | "account";
  startAt: number;
  endAt: number;
  demo: boolean;
  outcome?: "completed" | "cancelled";
};
export type FocusPhase =
  "scheduled" | "active" | "review" | "completed" | "cancelled";
export const focusPhase = (session: FocusSession, now: number): FocusPhase =>
  session.outcome ??
  (now < session.startAt
    ? "scheduled"
    : now < session.endAt
      ? "active"
      : "review");

/** Find a real opening in the live items; this is a suggestion, never a calendar write. */
export function nextStudyOpening(
  items: LoadItem[],
  now: number,
  minutes: number,
): number {
  let candidate = Math.ceil((now + 60000) / 60000) * 60000;
  const occupied = items
    .filter((item) => item.kind === "event" && !item.release)
    .map((item) => ({
      start: Date.parse(item.start ?? ""),
      end: Date.parse(item.end ?? ""),
    }))
    .filter(
      (event) =>
        Number.isFinite(event.start) &&
        event.end > candidate &&
        event.end > event.start,
    )
    .sort((a, b) => a.start - b.start);
  for (const event of occupied) {
    if (candidate + minutes * 60000 <= event.start) break;
    if (candidate < event.end) candidate = event.end;
  }
  return candidate;
}

export function parseStudyContext(value: unknown): StudyContext | null {
  if (!value || typeof value !== "object") return null;
  const { sources, commitment } = value as Record<string, unknown>;
  if (!Array.isArray(sources) || sources.length > 3) return null;
  let total = 0;
  const ids = new Set<string>();
  const parsed: CourseMaterial[] = [];
  for (const source of sources) {
    if (!source || typeof source !== "object") return null;
    const { id, title, text } = source;
    if (
      typeof id !== "string" ||
      !id ||
      id.length > 80 ||
      ids.has(id) ||
      typeof title !== "string" ||
      !title.trim() ||
      title.length > 120 ||
      typeof text !== "string" ||
      text.trim().length < 20 ||
      text.length > 6000
    )
      return null;
    total += text.length;
    ids.add(id);
    parsed.push({ id, title: title.trim(), text: text.trim() });
  }
  if (total > 12000) return null;
  const result: StudyContext = { sources: parsed };
  if (commitment !== undefined) {
    if (!commitment || typeof commitment !== "object") return null;
    const { title, goal, startsAt, endsAt } = commitment as Record<
      string,
      unknown
    >;
    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.length > 200 ||
      typeof goal !== "string" ||
      goal.length > 240 ||
      typeof startsAt !== "string" ||
      typeof endsAt !== "string" ||
      !Number.isFinite(Date.parse(startsAt)) ||
      !Number.isFinite(Date.parse(endsAt)) ||
      Date.parse(endsAt) <= Date.parse(startsAt)
    )
      return null;
    result.commitment = { title, goal, startsAt, endsAt };
  }
  return result;
}

export function verifiedCourseReply(
  value: unknown,
  sources: CourseMaterial[],
): string {
  if (!value || typeof value !== "object")
    throw new Error("Invalid study reply");
  const { answer, citations } = value as Record<string, unknown>;
  if (
    typeof answer !== "string" ||
    !answer.trim() ||
    answer.length > 4000 ||
    !Array.isArray(citations) ||
    citations.length > 3
  )
    throw new Error("Invalid study reply");
  const references = citations.map((citation, index) => {
    if (!citation || typeof citation !== "object")
      throw new Error("Invalid citation");
    const source = sources.find((item) => item.id === citation.sourceId);
    if (
      !source ||
      typeof citation.quote !== "string" ||
      !citation.quote.trim() ||
      citation.quote.length > 500 ||
      !source.text.includes(citation.quote)
    )
      throw new Error("Unverified citation");
    return `[${index + 1}] ${source.title}\n“${citation.quote}”`;
  });
  return (
    answer.trim() +
    (references.length ? `\n\nCourse sources\n${references.join("\n\n")}` : "")
  );
}
