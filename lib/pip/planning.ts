import type { PipContext } from "./context";
import { parseISODate } from "@/lib/iso-date";

export type BusyInterval = { start: number; end: number };
export type PipSchedule = {
  state: "connected" | "partial" | "disconnected";
  windows: { startsAt: string; endsAt: string }[];
  busy: BusyInterval[];
};
export type StudyProposal = {
  taskId: string;
  title: string;
  goal: string;
  startAt: number;
  endAt: number;
  tentative: boolean;
};
export type PipGenerationPart = string | { proposal: StudyProposal };

/** Suggestions favor daytime; validation can also honor another time the student requests. */
export function studyWindows(busy: BusyInterval[], timeZone: string, now: number) {
  const format = new Intl.DateTimeFormat("en", { timeZone, hour: "numeric", hourCycle: "h23" });
  const step = 15 * 60000;
  const windows: { startsAt: string; endsAt: string }[] = [];
  for (let start = Math.ceil((now + 60000) / step) * step; start < now + 7 * 86400000; start += step) {
    const hour = Number(format.format(new Date(start)));
    if (hour < 9 || hour >= 22 || busy.some((b) => start < b.end && start + step > b.start)) continue;
    const previous = windows.at(-1);
    if (previous && Date.parse(previous.endsAt) === start) previous.endsAt = new Date(start + step).toISOString();
    else if (windows.length < 14) windows.push({ startsAt: new Date(start).toISOString(), endsAt: new Date(start + step).toISOString() });
    else break;
  }
  return windows;
}

export function verifyStudyProposal(input: { taskId: string; goal: string; startsAt: string; minutes: number }, context: PipContext): StudyProposal {
  const task = context.assignments.find((task) => task.id === input.taskId);
  const iso = parseISODate(input.startsAt);
  const startAt = iso ? Date.parse(iso) : NaN;
  const now = Date.parse(context.asOf);
  const endAt = startAt + input.minutes * 60000;
  if (!task || !context.schedule || !input.goal.trim() || input.goal.length > 240 || !Number.isInteger(input.minutes) || input.minutes < 10 || input.minutes > 45 || !Number.isFinite(startAt) || startAt < now || startAt >= now + 7 * 86400000) throw new Error("Choose an open assignment and a future 10–45 minute study block in the next week.");
  if (context.schedule.busy.some((busy) => startAt < busy.end && endAt > busy.start)) throw new Error("That time overlaps a loaded calendar event. Choose another free window.");
  return { taskId: input.taskId, title: task.title, goal: input.goal.trim(), startAt, endAt, tentative: context.schedule.state !== "connected" || context.unavailableSources > 0 };
}

export function parseStudyProposal(value: unknown): StudyProposal | null {
  if (!value || typeof value !== "object") return null;
  const p = value as StudyProposal;
  if (typeof p.taskId !== "string" || !p.taskId || p.taskId.length > 300 || typeof p.title !== "string" || !p.title || p.title.length > 200 || typeof p.goal !== "string" || p.goal.length > 240 || !Number.isFinite(p.startAt) || !Number.isFinite(p.endAt) || p.endAt <= p.startAt || p.endAt - p.startAt > 45 * 60000 || typeof p.tentative !== "boolean") return null;
  return p;
}

/** Calendar titles, links, and individual events are never sent to Gemini. */
export function promptContext(context: PipContext) {
  return { ...context, ...(context.schedule ? { schedule: { state: context.schedule.state, windows: context.schedule.windows } } : {}) };
}
