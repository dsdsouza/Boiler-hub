import { afterEach, expect, it, vi } from "vitest";
import { createRules } from "./rules.mjs";

const now = Date.parse("2026-10-25T00:00:00Z");
const focusPage = "chrome-extension://pip/focus.html";
const original = "https://www.youtube.com/robots.txt?pip=test#section";
const commitment = {
  id: "return-test", taskId: "task", title: "Study", goal: "Read",
  scope: "demo", demo: true, startAt: now, endAt: now + 60_000,
};

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.resetModules(); });

async function setup() {
  vi.useFakeTimers(); vi.setSystemTime(now);
  const state: { session?: typeof commitment & { outcome?: string } } = {};
  let rules: ReturnType<typeof createRules> = [];
  const tab = { id: 1, url: original };
  const hooks: Record<string, (...args: unknown[]) => unknown> = {};
  const on = (name: string) => ({ addListener: (fn: (...args: unknown[]) => unknown) => { hooks[name] = fn; } });
  const chrome = {
    runtime: { getURL: (path: string) => `chrome-extension://pip/${path}`, getManifest: () => ({ version: "0.2.1" }), onMessage: on("message"), onStartup: on("startup"), onInstalled: on("installed") },
    storage: { local: { get: async () => ({ ...state }), set: async (value: object) => { Object.assign(state, value); } } },
    declarativeNetRequest: {
      getDynamicRules: async () => rules,
      updateDynamicRules: async ({ addRules = [] }: { addRules?: ReturnType<typeof createRules> }) => { rules = addRules; },
    },
    tabs: { query: async () => [{ ...tab }], get: async () => ({ ...tab }), update: vi.fn(async (_id: number, value: { url: string }) => { tab.url = value.url; }), onUpdated: on("updated") },
    alarms: { clear: vi.fn(async () => true), create: vi.fn(async () => {}), onAlarm: on("alarm") },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
    notifications: { getPermissionLevel: async () => "granted", getAll: async () => ({}), clear: async () => true, onClicked: on("clicked"), onButtonClicked: on("button") },
  };
  vi.stubGlobal("chrome", chrome);
  await import("./background.js");
  const send = (message: object) => new Promise<unknown>((resolve) => hooks.message(message, { url: "https://boilerplate.zhomander.workers.dev/demo", frameId: 0 }, resolve));
  return { chrome, state, tab, hooks, send, rules: () => rules };
}

it("restores paused pages on the end alarm with no app messages and never completes the task", async () => {
  const env = await setup();
  await env.send({ type: "set", session: commitment });
  expect(env.rules()).toHaveLength(5);
  expect(env.tab.url).toBe(`${focusPage}#${original}`);
  vi.setSystemTime(commitment.endAt);
  env.hooks.alarm({ name: "focus-end" });
  await vi.waitFor(() => expect(env.tab.url).toBe(original));
  expect(env.rules()).toEqual([]);
  expect(env.state.session?.outcome).toBeUndefined();
});

it("restores on explicit release and leaves the person's new navigation alone", async () => {
  const env = await setup();
  await env.send({ type: "set", session: commitment });
  env.tab.url = "https://school.example/reading";
  await env.send({ type: "set", session: { ...commitment, outcome: "cancelled" } });
  expect(env.rules()).toEqual([]);
  expect(env.tab.url).toBe("https://school.example/reading");
  expect(env.state.session?.outcome).toBe("cancelled");
});

it.each(["completed", "cancelled"])("returns a paused tab when its commitment is %s", async (outcome) => {
  const env = await setup();
  await env.send({ type: "set", session: commitment });
  await env.send({ type: "set", session: { ...commitment, outcome } });
  expect(env.rules()).toEqual([]);
  expect(env.tab.url).toBe(original);
});

it("recovers a late redirect after expiry even when blocking rules were already removed", async () => {
  const env = await setup();
  vi.setSystemTime(commitment.endAt);
  env.tab.url = `${focusPage}#${original}`;
  env.hooks.updated(1, { url: env.tab.url });
  await vi.waitFor(() => expect(env.tab.url).toBe(original));
  expect(env.rules()).toEqual([]);
});
