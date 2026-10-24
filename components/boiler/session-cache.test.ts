import { expect, it, vi } from "vitest";
import { OwnerCache } from "./session-cache";

it("reuses recent owner data and refetches stale data without removing the visible value", async () => {
  let now = 1000;
  const cache = new OwnerCache<string>(30_000, () => now);
  const fetch = vi.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("fresh");
  await expect(cache.load("a", fetch)).resolves.toBe("first");
  await expect(cache.load("a", fetch)).resolves.toBe("first");
  expect(fetch).toHaveBeenCalledTimes(1);
  now += 30_001;
  expect(cache.read("a")).toBe("first");
  await expect(cache.load("a", fetch)).resolves.toBe("fresh");
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("deduplicates in-flight navigation loads", async () => {
  const cache = new OwnerCache<string>();
  let finish!: (value: string) => void;
  const fetch = vi.fn(() => new Promise<string>(resolve => { finish = resolve; }));
  const first = cache.load("a", fetch);
  const second = cache.load("a", fetch);
  finish("loaded");
  expect(await Promise.all([first, second])).toEqual(["loaded", "loaded"]);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("drops the previous owner's data and late responses on account changes", async () => {
  const cache = new OwnerCache<string>();
  await cache.load("a", async () => "private-a");
  let finish!: (value: string) => void;
  const old = cache.load("a", () => new Promise<string>(resolve => { finish = resolve; }), true);
  expect(cache.read("b")).toBeNull();
  await cache.load("b", async () => "private-b");
  finish("late-private-a");
  expect(await old).toBeNull();
  expect(cache.read("a")).toBeNull();
  expect(cache.read("b")).toBe("private-b");
});

it("keeps a confirmed task change when an older background load completes", async () => {
  const cache = new OwnerCache<string>();
  let finish!: (value: string) => void;
  const old = cache.load("a", () => new Promise<string>(resolve => { finish = resolve; }));
  cache.remember("a", "new task", true);
  finish("old task list");
  expect(await old).toBeNull();
  expect(cache.read("a")).toBe("new task");
});

it("source invalidation and explicit refresh bypass recent cached data", async () => {
  const cache = new OwnerCache<string>();
  const fetch = vi.fn().mockResolvedValueOnce("before").mockResolvedValueOnce("new source").mockResolvedValueOnce("refreshed");
  await cache.load("a", fetch);
  cache.invalidate();
  expect(cache.read("a")).toBe("before");
  await expect(cache.load("a", fetch)).resolves.toBe("new source");
  await expect(cache.load("a", fetch, true)).resolves.toBe("refreshed");
  expect(fetch).toHaveBeenCalledTimes(3);
});

it("clears private data and pending work when authentication is lost", async () => {
  const cache = new OwnerCache<string>();
  await cache.load("a", async () => "private");
  let finish!: (value: string) => void;
  const pending = cache.load("a", () => new Promise<string>(resolve => { finish = resolve; }), true);
  cache.clear();
  finish("late private response");
  expect(await pending).toBeNull();
  expect(cache.read("a")).toBeNull();
});

it("notifies a returning view when a mutation from the previous visit finishes", async () => {
  const cache = new OwnerCache<string>();
  await cache.load("a", async () => "before");
  const seen: (string | null)[] = [];
  const unsubscribe = cache.subscribe(() => seen.push(cache.read("a")));
  cache.remember("a", "confirmed after navigation", true);
  expect(seen).toEqual(["confirmed after navigation"]);
  unsubscribe();
  cache.clear();
  expect(seen).toHaveLength(1);
});
