import { afterEach, expect, it, vi } from "vitest";
import { nextReminderAt, reminderPhase } from "./reminders.mjs";
import { synchronizeReminders } from "./notifications.js";
const session = { id: "focus", title: "Study", goal: "Outline", startAt: 1_000_000, endAt: 1_000_000 + 25 * 60000 };
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it("checks in before, during and after a promised study block without reviving finished work", () => {
  expect(reminderPhase(session, session.startAt - 6 * 60000)).toBeNull();
  expect(reminderPhase(session, session.startAt - 60000)).toBe("heads-up");
  expect(reminderPhase(session, session.startAt)).toBe("start");
  expect(reminderPhase(session, session.startAt + 11 * 60000)).toBe("check-in");
  expect(reminderPhase(session, session.endAt)).toBe("finish");
  expect(reminderPhase(session, session.endAt + 6 * 60000)).toBe("follow-up");
  expect(reminderPhase({ ...session, outcome: "cancelled" }, session.endAt)).toBeNull();
  expect(nextReminderAt(session, session.endAt)).toBe(session.endAt + 5 * 60000);
});
it("deduplicates background notifications across reads and reschedules the next alarm", async () => {
  vi.useFakeTimers(); vi.setSystemTime(session.startAt);
  const state: Record<string, unknown> = { remindersEnabled: true };
  const create = vi.fn(async () => "notification");
  const alarms = { clear: vi.fn(async () => true), create: vi.fn(async () => {}) };
  vi.stubGlobal("chrome", { storage: { local: { get: vi.fn(async () => ({ ...state })), set: vi.fn(async (value) => Object.assign(state, value)) } }, notifications: { getPermissionLevel: vi.fn(async () => "granted"), create, getAll: vi.fn(async () => ({})), clear: vi.fn(async () => true) }, alarms, runtime: { getManifest: () => ({ version: "0.2.0" }) } });
  await synchronizeReminders(session); await synchronizeReminders(session);
  expect(create).toHaveBeenCalledOnce();
  expect(alarms.create).toHaveBeenLastCalledWith("pip-reminder", { when: session.startAt + 10 * 60000 });
  await synchronizeReminders({ ...session, outcome: "completed" });
  expect(create).toHaveBeenCalledOnce();
});
