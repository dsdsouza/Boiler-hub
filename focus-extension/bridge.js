/* global chrome */
// Only our content script can call runtime messaging. Do not forward arbitrary commands.
window.addEventListener("message", async (event) => {
  if (
    event.source !== window ||
    event.origin !== location.origin ||
    !["bp-focus:read", "bp-focus:set"].includes(event.data?.type)
  )
    return;
  try {
    const result = await chrome.runtime.sendMessage(
      event.data.type === "bp-focus:set"
        ? { type: "set", session: event.data.session }
        : { type: "read" },
    );
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
