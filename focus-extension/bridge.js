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
