/* global chrome */
import {
  createRules,
  isApp,
  shouldBlock,
  validateSession,
} from "./rules.mjs";
import { pauseOpenTabs, restorePausedTabs, returnUrl } from "./tabs.mjs";
import { enableReminders, reminderStatus, synchronizeReminders, testNotification } from "./notifications.js";

let queue = Promise.resolve();
const enqueue = (operation) => {
  const result = queue.then(operation, operation);
  queue = result.catch(() => {});
  return result;
};

async function synchronize() {
  const { session = null } = await chrome.storage.local.get("session");
  const block = shouldBlock(session);
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  const focusPage = chrome.runtime.getURL("focus.html");
  const expectedRules = createRules(focusPage);
  if (block && (rules.length !== expectedRules.length || rules.some(
    (rule) => rule.action.redirect?.regexSubstitution !== expectedRules[0].action.redirect.regexSubstitution,
  )))
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: rules.map((rule) => rule.id),
      addRules: expectedRules,
    });
  else if (!block && rules.length)
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: rules.map((rule) => rule.id),
    });
  await chrome.alarms.clear("focus-start");
  await chrome.alarms.clear("focus-end");
  if (validateSession(session) && !session.outcome) {
    if (session.startAt > Date.now())
      await chrome.alarms.create("focus-start", { when: session.startAt });
    if (session.endAt > Date.now())
      await chrome.alarms.create("focus-end", { when: session.endAt });
  }
  await chrome.action.setBadgeText({ text: block ? "FOCUS" : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#8c6a35" });
  if (block) await pauseOpenTabs(chrome.tabs, focusPage);
  else await restorePausedTabs(chrome.tabs, focusPage);
  const reminders = await synchronizeReminders(validateSession(session) ? session : null).catch(() => ({ remindersSupported: true, remindersEnabled: false, reminderError: "Allow Chrome notifications to hear from Pip." }));
  return { connected: true, enforced: block, session, ...reminders };
}

async function handle(message, sender) {
  const ownPage = sender.url?.startsWith(chrome.runtime.getURL(""));
  if (!ownPage && (!isApp(sender.url) || sender.frameId !== 0))
    throw new Error("Untrusted sender");
  if (message.type === "set") {
    if (!isApp(sender.url) || !validateSession(message.session))
      throw new Error("Invalid commitment");
    const { session: current } = await chrome.storage.local.get("session");
    // A cancelled commitment cannot be reactivated by a stale page.
    if (
      current?.id === message.session.id &&
      current.outcome &&
      !message.session.outcome
    )
      throw new Error("Commitment already ended");
    await chrome.storage.local.set({
      session: message.session,
      appUrl: new URL(
        message.session.scope === "demo" ? "/demo#maya" : "/boiler",
        sender.url,
      ).href,
    });
  } else if (message.type === "release") {
    if (!ownPage) throw new Error("Use the app's explicit end-focus control");
    const { session } = await chrome.storage.local.get("session");
    if (session)
      await chrome.storage.local.set({
        session: { ...session, outcome: "cancelled" },
      });
  } else if (message.type === "notifications") {
    if (!isApp(sender.url) || typeof message.enabled !== "boolean") throw new Error("Use Boilerplate to choose notification settings");
    await chrome.storage.local.set({ appUrl: new URL("/boiler", sender.url).href });
    await enableReminders(message.enabled);
  } else if (message.type === "test-notification") {
    if (!isApp(sender.url)) throw new Error("Use Boilerplate to test reminders");
    await testNotification();
  } else if (message.type !== "read") throw new Error("Unknown command");
  return synchronize();
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  void enqueue(() => handle(message, sender))
    .then((status) => reply({ status }))
    .catch(async () => {
      // A failed command never reports blocking as confirmed. Emergency release can
      // always be achieved by disabling the extension in Chrome's Extensions menu.
      const rules = await chrome.declarativeNetRequest
        .getDynamicRules()
        .catch(() => []);
      const { session = null } = await chrome.storage.local
        .get("session")
        .catch(() => ({}));
      reply({
        status: { connected: true, enforced: rules.length > 0, session, ...await reminderStatus().catch(() => ({})) },
        error:
          ["notifications", "test-notification"].includes(message.type) ? "Allow Chrome notifications in your extension and laptop settings, then try again." : "Could not update focus. Reload the extension or disable it to unblock.",
      });
    });
  return true;
});
async function openPip() {
  const { appUrl } = await chrome.storage.local.get("appUrl");
  if (!isApp(appUrl)) return;
  const url = new URL(appUrl); url.searchParams.set("pip", "check-in");
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((tab) => tab.url?.startsWith(url.origin + "/boiler"));
  if (existing?.id) { await chrome.tabs.update(existing.id, { active: true, url: url.href }); if (existing.windowId) await chrome.windows.update(existing.windowId, { focused: true }); }
  else await chrome.tabs.create({ url: url.href });
}
chrome.notifications.onClicked.addListener((id) => { if (id.startsWith("pip-")) void openPip(); });
chrome.notifications.onButtonClicked.addListener((id) => { if (id.startsWith("pip-")) void openPip(); });
chrome.alarms.onAlarm.addListener(() => {
  void enqueue(synchronize);
});
// Catch a redirected navigation finishing just after the end alarm, too.
chrome.tabs.onUpdated.addListener((_id, change) => {
  if (returnUrl(chrome.runtime.getURL("focus.html"), change.url))
    void enqueue(synchronize);
});
chrome.runtime.onStartup.addListener(() => {
  void chrome.alarms.create("focus-watchdog", { periodInMinutes: 0.5 });
  void enqueue(synchronize);
});
chrome.runtime.onInstalled.addListener(() => {
  void chrome.alarms.create("focus-watchdog", { periodInMinutes: 0.5 });
  void enqueue(synchronize);
});
