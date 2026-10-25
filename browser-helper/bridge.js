/* global chrome */
// This isolated content script runs only on Boilerplate origins. It reports
// installation; it cannot scan pages, import links or invoke extension commands.
window.addEventListener("message", (event) => {
  const data = event.data;
  if (
    event.source !== window ||
    event.origin !== location.origin ||
    data?.type !== "bp-extension:ping" ||
    data.extension !== "calendar" ||
    typeof data.nonce !== "string" ||
    data.nonce.length > 80
  )
    return;
  try {
    if (!chrome.runtime.id) return;
    window.postMessage(
      {
        type: "bp-extension:pong",
        extension: "calendar",
        nonce: data.nonce,
        version: chrome.runtime.getManifest().version,
      },
      location.origin,
    );
  } catch {
    /* An updated or removed extension must not report as installed. */
  }
});
