/* global chrome */
import { scanCalendarPage } from "./imports/scan.js";
import { normalizeFeedUrl, PROVIDER_STEPS } from "./imports/protocol.js";
import { appDestination, calendarNavigation, reviewDestination } from "./imports.mjs";

const element = (id) => document.getElementById(id);
const scan = element("scan");
const status = element("status");
const results = element("results");
const provider = element("provider");
let savedAppUrl;
let session;
let remindersEnabled = false;
let busy = false;
let connected = false;

function showSteps() {
  element("steps").textContent = PROVIDER_STEPS[provider.value] || PROVIDER_STEPS.Other;
}
function showFocus() {
  if (!connected) return;
  const now = Date.now();
  const active = session && !session.outcome && session.endAt > now;
  const text = active
    ? `${session.title} · ${session.startAt > now ? "starts in" : "ends in"} ${Math.max(1, Math.ceil(((session.startAt > now ? session.startAt : session.endAt) - now) / 60000))} min`
    : "No study block running.";
  const message = `${text} ${remindersEnabled ? "Laptop reminders on." : "Enable laptop reminders in Pip."}`;
  const focusStatus = element("focus-status");
  if (focusStatus.textContent !== message) focusStatus.textContent = message;
}
function action(label, run) {
  const button = document.createElement("button");
  button.type = "button"; button.textContent = label;
  button.addEventListener("click", () => { void run().catch(() => { status.textContent = "Could not open that page. Try again."; }); });
  return button;
}
async function find() {
  if (busy) return;
  busy = true; scan.disabled = true; scan.setAttribute("aria-busy", "true");
  results.replaceChildren(); element("navigation").replaceChildren();
  status.textContent = "Looking for calendar links…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:\/\//i.test(tab.url || "")) throw new Error("restricted");
    let frames;
    try { frames = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: scanCalendarPage }); }
    catch { frames = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scanCalendarPage }); }
    const pages = frames.map((frame) => frame.result).filter(Boolean);
    if (!pages.length) throw new Error("restricted");
    const detected = pages.find((page) => page.provider !== "Other")?.provider;
    if (detected && Object.hasOwn(PROVIDER_STEPS, detected)) provider.value = detected;
    showSteps();
    const found = new Map();
    for (const page of pages) for (const item of page.candidates || []) {
      const url = normalizeFeedUrl(item.url);
      if (url && found.size < 20) found.set(url, { ...item, url });
    }
    status.textContent = found.size
      ? `Found ${found.size} calendar ${found.size === 1 ? "link" : "links"}. Choose one to review.`
      : "No subscription link is visible yet. Follow the school steps above, leave the feed dialog open, then scan again.";
    for (const item of found.values()) {
      const row = document.createElement("div"); row.className = "result";
      const heading = document.createElement("h2"); heading.textContent = item.label || `${item.provider === "Other" ? "Calendar" : item.provider} subscription`;
      const host = document.createElement("p"); host.textContent = new URL(item.url.replace(/^webcal:/, "https:")).hostname;
      const review = action("Review import in Boilerplate", async () => { await chrome.tabs.create({ url: reviewDestination(savedAppUrl, item.url) }); });
      row.append(heading, host, review); results.append(row);
    }
    for (const url of calendarNavigation(pages))
      element("navigation").append(action("Open school calendar", async () => { await chrome.tabs.create({ url }); }));
    if (pages.some((page) => page.truncated)) status.textContent += " This is a large page; open the feed dialog if a link is missing.";
  } catch {
    status.textContent = "This page cannot be scanned. Open your school calendar in a regular tab, open its feed dialog, then try again.";
  } finally {
    busy = false; scan.disabled = false; scan.removeAttribute("aria-busy");
  }
}
provider.addEventListener("change", showSteps);
scan.addEventListener("click", () => { void find(); });
showSteps();
void (async () => {
  try {
    ({ appUrl: savedAppUrl } = await chrome.storage.local.get("appUrl"));
    for (const id of ["home", "open-pip"]) element(id).href = appDestination(savedAppUrl);
    element("sources").href = appDestination(savedAppUrl, "/settings/sources");
    const result = await chrome.runtime.sendMessage({ type: "read" });
    connected = Boolean(result.status?.connected);
    if (!connected) throw new Error("disconnected");
    session = result.status?.session;
    remindersEnabled = Boolean(result.status?.remindersEnabled);
    showFocus();
  } catch {
    element("focus-status").textContent = "Reload the extension to reconnect Pip. You can still find import links below.";
  }
})();
setInterval(showFocus, 1000);
