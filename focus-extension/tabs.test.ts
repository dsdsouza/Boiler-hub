import { expect, it, vi } from "vitest";
import { pauseOpenTabs, pausedUrl, restorePausedTabs, returnUrl } from "./tabs.mjs";

const focusPage = "chrome-extension://pip/focus.html";
const original = "https://www.youtube.com/watch?v=one&list=two%23three#t=42";

it("keeps the exact return address in the tab and rejects unrelated or unsafe destinations", () => {
  expect(returnUrl(focusPage, pausedUrl(focusPage, original))).toBe(original);
  for (const url of [
    focusPage,
    `${focusPage}?other#${original}`,
    `https://elsewhere.example/focus.html#${original}`,
    `${focusPage}#javascript:alert(1)`,
    `${focusPage}#https://youtube.com.evil.example/`,
    `${focusPage}#https://name:secret@youtube.com/`,
    `${focusPage}#https://school.example/`,
  ]) expect(returnUrl(focusPage, url)).toBeNull();
});

it("captures an existing tab including its fragment, and leaves tabs that navigated away alone", async () => {
  const update = vi.fn(async () => {});
  const tabs = {
    query: async () => [{ id: 1, url: original }, { id: 2, url: original }, { id: 3, url: "https://school.example/" }],
    get: async (id: number) => ({ id, url: id === 1 ? original : "https://school.example/" }),
    update,
  };
  await pauseOpenTabs(tabs, focusPage);
  expect(update.mock.calls).toEqual([[1, { url: pausedUrl(focusPage, original) }]]);
});

it("restores paused tabs after a worker restart without stored URL state or touching other tabs", async () => {
  const paused = pausedUrl(focusPage, original);
  const update = vi.fn(async () => {});
  const tabs = {
    query: async () => [
      { id: 1, url: paused }, { id: 2, url: paused }, { id: 3, url: paused },
      { id: 4, url: paused }, { id: 5, url: focusPage }, { id: 6, url: paused },
    ],
    get: async (id: number) => {
      if (id === 2) throw new Error("Tab closed");
      if (id === 3) return { id, url: "https://school.example/" };
      if (id === 4) return { id, url: paused, pendingUrl: "https://school.example/" };
      return { id, url: paused };
    },
    update,
  };
  await restorePausedTabs(tabs, focusPage);
  expect(update.mock.calls).toEqual([[1, { url: original }], [6, { url: original }]]);
});
