import { isApp } from "./rules.mjs";
import { normalizeFeedUrl } from "./imports/protocol.js";

export function appDestination(savedAppUrl, path = "/boiler") {
  const origin = isApp(savedAppUrl)
    ? new URL(savedAppUrl).origin
    : "https://boilerplate.zhomander.workers.dev";
  return new URL(path, origin).href;
}

export function reviewDestination(savedAppUrl, rawFeed) {
  const feed = normalizeFeedUrl(rawFeed);
  if (!feed) throw new Error("Choose a calendar subscription link.");
  return `${appDestination(savedAppUrl, "/calendar-helper")}#feed=${encodeURIComponent(feed)}`;
}

export function calendarNavigation(pages) {
  const links = new Set();
  for (const page of pages) for (const item of page.navigation || []) {
    try {
      const url = new URL(item.url);
      if (url.protocol === "https:" && url.hostname === page.host && !url.username && !url.password)
        links.add(url.href);
    } catch { /* Ignore page-supplied malformed navigation. */ }
  }
  return [...links].slice(0, 4);
}
