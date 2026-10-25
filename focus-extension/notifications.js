/* global chrome */
import { nextReminderAt, reminderCopy, reminderPhase } from "./reminders.mjs";
const isTest = (id) => id === "pip-test" || id.startsWith("pip-test-");

export async function reminderStatus() {
  const { remindersEnabled = false, reminderError = "" } = await chrome.storage.local.get(["remindersEnabled", "reminderError"]);
  const permission = await chrome.notifications.getPermissionLevel();
  return { remindersSupported: true, remindersEnabled: remindersEnabled && permission === "granted", notificationPermission: permission, reminderError, version: chrome.runtime.getManifest().version };
}

export async function testNotification() {
  const status = await reminderStatus();
  if (!status.remindersEnabled) throw new Error("Enable Pip's laptop reminders first.");
  const notifications = await chrome.notifications.getAll();
  await Promise.all(Object.keys(notifications).filter(isTest).map((id) => chrome.notifications.clear(id)));
  // A fresh identifier requests a new native alert, rather than replacing one.
  await chrome.notifications.create(`pip-test-${crypto.randomUUID()}`, { type: "basic", iconUrl: "icon128.png", title: "Pip is paired with your laptop", message: "I’ll remind you before study time, bring you back when it starts, and check in afterward.", priority: 1 });
}

export async function synchronizeReminders(session) {
  const status = await reminderStatus();
  await chrome.alarms.clear("pip-reminder");
  if (!status.remindersEnabled || !session || session.outcome) {
    const notifications = await chrome.notifications.getAll();
    await Promise.all(Object.keys(notifications).filter((id) => id.startsWith("pip-") && (!status.remindersEnabled || !isTest(id))).map((id) => chrome.notifications.clear(id)));
    return status;
  }
  const now = Date.now();
  const phase = reminderPhase(session, now);
  const { reminded = {} } = await chrome.storage.local.get("reminded");
  const sent = reminded.sessionId === session.id ? reminded.phases ?? {} : {};
  if (phase && !sent[phase]) {
    try {
      await chrome.notifications.create(`pip-${session.id}-${phase}`, { type: "basic", iconUrl: "icon128.png", ...reminderCopy(phase, session), buttons: [{ title: "Open Pip" }], priority: 1, requireInteraction: phase === "finish" || phase === "follow-up" });
      await chrome.storage.local.set({ reminded: { sessionId: session.id, phases: { ...sent, [phase]: now } }, reminderError: "" });
    } catch {
      await chrome.storage.local.set({ reminderError: "Pip couldn’t display a laptop notification. Allow Chrome notifications in your browser and laptop settings." });
    }
  }
  const next = nextReminderAt(session, now);
  if (next) await chrome.alarms.create("pip-reminder", { when: next });
  return reminderStatus();
}

export async function enableReminders(enabled) {
  await chrome.storage.local.set({ remindersEnabled: Boolean(enabled), reminderError: "" });
  if (enabled) await testNotification();
}
