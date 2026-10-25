import { isDistracting } from "./rules.mjs";

// Keep the return address in the paused tab, including across worker restarts.
// Nothing is sent to Boilerplate or retained in extension storage.
export function pausedUrl(focusPage, originalUrl) {
  return `${focusPage}#${originalUrl}`;
}

export function returnUrl(focusPage, url) {
  if (typeof url !== "string" || !url.startsWith(`${focusPage}#`)) return null;
  const original = url.slice(focusPage.length + 1);
  if (!isDistracting(original)) return null;
  const parsed = new URL(original);
  return parsed.username || parsed.password ? null : parsed.href;
}

export async function pauseOpenTabs(tabs, focusPage) {
  for (const tab of await tabs.query({})) {
    if (!tab.id || !isDistracting(tab.pendingUrl || tab.url)) continue;
    try {
      const current = await tabs.get(tab.id);
      const original = current.pendingUrl || current.url;
      if (!isDistracting(original)) continue;
      await tabs.update(tab.id, { url: pausedUrl(focusPage, original) });
    } catch {
      // The tab may have closed while the focus block was starting.
    }
  }
}

export async function restorePausedTabs(tabs, focusPage) {
  for (const tab of await tabs.query({})) {
    if (!tab.id || !returnUrl(focusPage, tab.url)) continue;
    try {
      const current = await tabs.get(tab.id);
      const original = returnUrl(focusPage, current.url);
      // A tab the person has navigated elsewhere is theirs to keep there.
      if (!original || (current.pendingUrl && current.pendingUrl !== current.url))
        continue;
      await tabs.update(tab.id, { url: original });
    } catch {
      // Other paused tabs must still return if this one was closed.
    }
  }
}
