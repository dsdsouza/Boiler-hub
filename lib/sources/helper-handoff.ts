import { normalizeFeedUrl } from "@/browser-helper/protocol.js";

export const HELPER_DRAFT_KEY = "boiler:calendar-helper:v1";
const TTL_MS = 10 * 60_000;
type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Tab-scoped, short-lived draft; never localStorage or a request query parameter. */
export function rememberHelperFeed(storage: DraftStorage, raw: string, now = Date.now()): string | null {
  const url = normalizeFeedUrl(raw);
  if (!url) return null;
  try { storage.setItem(HELPER_DRAFT_KEY, JSON.stringify({ url, expires: now + TTL_MS })); } catch { /* Review still works without storage. */ }
  return url;
}
export function readHelperFeed(storage: DraftStorage, now = Date.now()): string | null {
  try {
    const raw = storage.getItem(HELPER_DRAFT_KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null || !("url" in data) || !("expires" in data)
      || typeof data.expires !== "number" || data.expires <= now || data.expires > now + TTL_MS) {
      storage.removeItem(HELPER_DRAFT_KEY); return null;
    }
    const url = normalizeFeedUrl(data.url);
    if (!url) storage.removeItem(HELPER_DRAFT_KEY);
    return url;
  } catch {
    try { storage.removeItem(HELPER_DRAFT_KEY); } catch { /* Storage can be blocked. */ }
    return null;
  }
}
export function forgetHelperFeed(storage: DraftStorage) {
  try { storage.removeItem(HELPER_DRAFT_KEY); } catch { /* Storage can be unavailable in private sessions. */ }
}
