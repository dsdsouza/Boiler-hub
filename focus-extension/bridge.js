/* global chrome */
// Only our content script can call runtime messaging. Do not forward arbitrary commands.
window.addEventListener("message", async (event) => {
  if (
    event.source !== window ||
    event.origin !== location.origin ||
    !["bp-focus:read", "bp-focus:set", "bp-focus:notifications", "bp-focus:test-notification"].includes(event.data?.type)
  )
    return;
  try {
    const commands = { "bp-focus:set": { type: "set", session: event.data.session }, "bp-focus:read": { type: "read" }, "bp-focus:notifications": { type: "notifications", enabled: event.data.enabled }, "bp-focus:test-notification": { type: "test-notification" } };
    const result = await chrome.runtime.sendMessage(commands[event.data.type]);
    window.postMessage(
      { type: "bp-focus:status", status: result.status, error: result.error },
      location.origin,
    );
  } catch {
    window.postMessage(
      {
        type: "bp-focus:status",
        status: { connected: false, enforced: false, session: null },
      },
      location.origin,
    );
  }
});

// Installation check used during onboarding. No focus session is started here.
window.addEventListener("message", (event) => {
  const data = event.data;
  if (event.source !== window || event.origin !== location.origin || data?.type !== "bp-extension:ping" || data.extension !== "focus" || typeof data.nonce !== "string" || data.nonce.length > 80) return;
  try {
    if (!chrome.runtime.id) return;
    window.postMessage({ type: "bp-extension:pong", extension: "focus", nonce: data.nonce, version: chrome.runtime.getManifest().version }, location.origin);
  } catch { /* Removed or updated extensions must not report as installed. */ }
});
