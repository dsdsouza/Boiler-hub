import { scanCalendarPage } from "./scan.js";
import { makeHandoffUrl, normalizeFeedUrl, PROVIDER_STEPS } from "./protocol.js";

const scan = document.getElementById("scan");
const status = document.getElementById("status");
const results = document.getElementById("results");
const help = document.getElementById("help");
const navigation = document.getElementById("navigation");
let busy = false;

function button(label, action, primary = false) {
  const el = document.createElement("button"); el.type = "button"; el.textContent = label;
  if (primary) el.className = "primary";
  el.addEventListener("click", () => { void action().catch(() => { status.textContent = "That action did not finish. Try again."; }); });
  return el;
}

async function find() {
  if (busy) return;
  busy = true; scan.setAttribute("aria-disabled", "true"); scan.setAttribute("aria-busy", "true");
  results.replaceChildren(); navigation.replaceChildren(); help.hidden = true; status.textContent = "Looking for calendar links…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:\/\//i.test(tab.url || "")) throw new Error("restricted");
    let frames;
    try { frames = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: scanCalendarPage }); }
    catch { frames = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scanCalendarPage }); }
    const pages = frames.map(f => f.result).filter(Boolean);
    if (!pages.length) throw new Error("restricted");
    const found = new Map();
    for (const page of pages) for (const item of page.candidates || []) {
      const url = normalizeFeedUrl(item.url);
      if (url && found.size < 20) found.set(url, { ...item, url });
    }
    status.textContent = found.size ? `Found ${found.size} calendar ${found.size === 1 ? "link" : "links"}. Choose one to review.` : "No subscription link is visible yet. Open the calendar feed dialog, then scan again.";
    let index = 0;
    for (const item of found.values()) {
      index++;
      const section = document.createElement("section"); section.className = "result"; section.setAttribute("aria-labelledby", `result-${index}`);
      const heading = document.createElement("h2"); heading.id = `result-${index}`; heading.textContent = item.label || `${item.provider === "Other" ? "Calendar" : item.provider} subscription ${index}`;
      const host = document.createElement("p"); host.textContent = `${item.provider === "Other" ? "Calendar feed" : item.provider} · ${new URL(item.url).hostname}`;
      const actions = document.createElement("div"); actions.className = "actions";
      actions.append(button("Review in Boiler Hub", async () => { await chrome.tabs.create({ url: makeHandoffUrl(item.url) }); }, true));
      actions.append(button("Copy link", async () => {
        try { await navigator.clipboard.writeText(item.url); status.textContent = "Link copied. Paste it into Sources in Boiler Hub."; }
        catch {
          status.textContent = "Copy this subscription link, then paste it into Sources.";
          let input = section.querySelector("input");
          if (!input) { input = document.createElement("input"); input.readOnly = true; input.setAttribute("aria-label", "Calendar subscription link"); input.value = item.url; section.append(input); }
          input.focus(); input.select();
        }
      }));
      section.append(heading, host, actions); results.append(section);
    }
    const provider = pages.find(p => p.provider !== "Other")?.provider || "Other";
    document.getElementById("steps").textContent = PROVIDER_STEPS[provider] || PROVIDER_STEPS.Other;
    const links = new Set();
    for (const page of pages) for (const item of page.navigation || []) {
      // Navigation stays on the school frame's host; never trust arbitrary page-supplied targets.
      try {
        const target = new URL(item.url);
        if (target.protocol !== "https:" || target.hostname !== page.host || target.username || target.password || links.has(target.href)) continue;
        links.add(target.href);
        navigation.append(button("Open school calendar", async () => { await chrome.tabs.create({ url: target.href }); }));
      } catch { /* Ignore malformed page content. */ }
    }
    help.hidden = found.size > 0;
    if (pages.some(p => p.truncated)) status.textContent += " This is a large page; open the feed dialog and scan again if a link is missing.";
  } catch {
    status.textContent = "This page cannot be scanned. Open your school’s website in a regular tab and click the helper again. For embedded calendars, open the calendar in its own tab.";
  } finally {
    busy = false; scan.removeAttribute("aria-disabled"); scan.removeAttribute("aria-busy");
  }
}
scan.addEventListener("click", () => { void find(); });
void find();
