/** Self-contained: Chrome serializes this function into the active page's isolated world. */
export function scanCalendarPage() {
  const candidates = new Map();
  const navigation = new Map();
  const page = new URL(location.href);
  let provider = /\/d2l\/|brightspace|desire2learn/i.test(page.href) ? "Brightspace"
    : /instructure\.com|(^|\.)canvas\./i.test(page.hostname) ? "Canvas"
    : /moodle/i.test(page.hostname) ? "Moodle"
    : /blackboard|\/ultra\//i.test(page.href) ? "Blackboard" : "Other";
  let inspected = 0;
  let textBytes = 0;
  const accept = (raw, calendarType = false, label = "") => {
    if (!raw || raw.length > 2048) return;
    try {
      const decoded = raw.trim().replace(/&amp;|&#0*38;/g, "&");
      const url = new URL(decoded.replace(/^webcals?:\/\//i, "https://"), document.baseURI);
      if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return;
      const host = url.hostname.toLowerCase();
      if (host.endsWith(".") || !host.includes(".") || /(^|\.)(localhost|local|internal|test|invalid)$/.test(host) || host.includes(":") || /^\d+(\.\d+){3}$/.test(host)) return;
      const path = url.pathname;
      const specific = /\/d2l\/le\/calendar\/feed\//i.test(path) ? "Brightspace"
        : /\/feeds\/calendars\//i.test(path) ? "Canvas"
        : /\/calendar\/export_execute\.php$/i.test(path) ? "Moodle"
        : /\/webapps\/calendar\/calendarFeed\//i.test(path) ? "Blackboard" : null;
      if (specific && provider === "Other") provider = specific;
      const feed = specific || /\.ics$/i.test(path) || /^webcals?:\/\//i.test(decoded)
        || (/^p\d+-caldav\.icloud\.com$/.test(host) && path.startsWith("/published/"));
      // MIME links are included only if subscription-shaped; login-only downloads are not guessed.
      if (feed && candidates.size < 20) {
        const cleanLabel = label.replace(/(?:https?:|webcals?:)\/\/\S+/gi, "").replace(/\s+/g, " ").trim().slice(0, 80);
        const value = /^webcals?:\/\//i.test(decoded) && !specific && !/\.ics$/i.test(path) && !path.startsWith("/published/") ? url.href.replace(/^https:/, "webcal:") : url.href;
        const previous = candidates.get(value);
        candidates.set(value, { url: value, host, provider: specific || provider, label: previous?.label || cleanLabel });
      }
      else if (!calendarType && url.origin === page.origin && /(^|\/)(calendar|calendars)(\/|$)|\/d2l\/le\/calendar|\/ultra\/calendar/i.test(path) && navigation.size < 4) {
        navigation.set(url.href, { url: url.href, host });
      }
    } catch { /* A page can contain incomplete and non-URL values. */ }
  };
  const visible = (element) => !!element.getClientRects().length && getComputedStyle(element).visibility !== "hidden";
  const walk = (root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode()) && inspected++ < 20000) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node;
        if (el.matches("meta[name=generator]") && /moodle/i.test(el.getAttribute("content") || "")) provider = "Moodle";
        if (el.shadowRoot) walk(el.shadowRoot);
        if (!visible(el) || el.closest("[hidden],[aria-hidden=true],script,style,noscript")) continue;
        if (el.matches("a[href]")) accept(el.getAttribute("href"), false, el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent);
        if (el.matches('input:not([type=password]):not([type=hidden]),textarea')) accept(el.value, false, [...(el.labels || [])].map(label => label.textContent).join(" "));
        if (el.hasAttribute("data-clipboard-text")) accept(el.getAttribute("data-clipboard-text"));
      } else if (textBytes < 300000 && node.parentElement && visible(node.parentElement) && !node.parentElement.closest("script,style,noscript,textarea,[hidden],[aria-hidden=true]")) {
        const text = node.textContent.slice(0, 8192); textBytes += text.length;
        for (const match of text.matchAll(/(?:https?:\/\/|webcals?:\/\/)[^\s<>"'`]+/gi)) accept(match[0].replace(/[),.;]+$/, ""));
      }
    }
  };
  walk(document.documentElement);
  // Alternate calendar links can live in the non-rendered head.
  for (const link of document.querySelectorAll('link[type="text/calendar"][href]')) accept(link.getAttribute("href"), true);
  return { provider, host: page.hostname, candidates: [...candidates.values()], navigation: [...navigation.values()], truncated: inspected >= 20000 || textBytes >= 300000 };
}
