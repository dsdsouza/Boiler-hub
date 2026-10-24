/* global chrome */
const element = (id) => document.getElementById(id);
async function render() {
  const { session, appUrl } = await chrome.storage.local.get([
    "session",
    "appUrl",
  ]);
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  const active = rules.length > 0;
  const scheduled = session && !session.outcome && session.startAt > Date.now();
  element("heading").textContent = active
    ? "Time to come back."
    : scheduled
      ? "Pip will meet you there."
      : "A little room to breathe.";
  element("description").textContent = active
    ? "The scroll can wait. Let’s take the next small step."
    : scheduled
      ? "Your study commitment will start automatically."
      : "Focus is off. Your distracting sites are available again.";
  const seconds = Math.max(
    0,
    Math.ceil(
      ((scheduled ? session.startAt : session?.endAt) - Date.now()) / 1000,
    ),
  );
  element("timer").textContent =
    active || scheduled
      ? `${Math.floor(seconds / 60)
          .toString()
          .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`
      : "";
  element("task").textContent =
    active || scheduled ? session?.title || "Study commitment" : "";
  element("goal").textContent = active || scheduled ? session?.goal || "" : "";
  element("release").hidden = !active && !scheduled;
  element("status").textContent = active
    ? "Five distracting websites paused in this browser."
    : "You can return to your original site.";
  if (appUrl) {
    element("home").href = appUrl;
    element("assistant").href = appUrl;
  }
}
element("release").addEventListener("click", async () => {
  element("release").disabled = true;
  try {
    const result = await chrome.runtime.sendMessage({ type: "release" });
    if (result.error) throw new Error();
    await render();
  } catch {
    element("status").textContent =
      "Disable this extension in Chrome’s Extensions menu to unblock immediately.";
  } finally {
    element("release").disabled = false;
  }
});
void chrome.runtime
  .sendMessage({ type: "read" })
  .then(render)
  .catch(() => {
    element("status").textContent =
      "Reload the extension, or disable it to unblock.";
  });
setInterval(() => void render(), 1000);
