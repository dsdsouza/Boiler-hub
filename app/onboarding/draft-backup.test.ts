import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearDraftBackup, readDraftBackup, rememberDraftBackup } from "./draft-backup";
import { parseDraft } from "./model";

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());

it("recovers pending answers only for their owner and never stores anonymous answers", () => {
  rememberDraftBackup(parseDraft({ name: "Anonymous" }));
  const draft = parseDraft({ ownerId: "a", name: "Private A" });
  rememberDraftBackup(draft);
  expect(readDraftBackup("a")).toEqual(draft);
  expect(readDraftBackup("b")).toBeNull();
});

it("clears confirmed answers while preserving newer edits during an older save", () => {
  const first = parseDraft({ ownerId: "a", name: "First" });
  const latest = { ...first, name: "Latest" };
  rememberDraftBackup(first); rememberDraftBackup(latest);
  clearDraftBackup(first);
  expect(readDraftBackup("a")).toEqual(latest);
  clearDraftBackup(latest);
  expect(readDraftBackup("a")).toBeNull();
});

it("continues without crashing when browser storage is blocked", () => {
  vi.stubGlobal("localStorage", { getItem: () => { throw Error("Blocked"); }, setItem: () => { throw Error("Blocked"); }, removeItem: () => { throw Error("Blocked"); } });
  expect(() => rememberDraftBackup(parseDraft({ ownerId: "a", name: "Alex" }))).not.toThrow();
  expect(readDraftBackup("a")).toBeNull();
});
