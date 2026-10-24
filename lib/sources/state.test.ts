import { describe, expect, it } from "vitest";
import { computePressure } from "@/lib/pressure/compute";
import { applyItemState, overdueOpen, silentDoneAt } from "./state";
import type { SourceItem } from "./types";

const NOW = new Date("2026-10-26T12:00:00Z");
const SRC = "src";
const task = (key: string, due: string, extra: Partial<SourceItem> = {}): SourceItem => ({
  id: `${SRC}:${key}`,
  kind: "task",
  source: "ics",
  sourceId: SRC,
  itemKey: key,
  title: key,
  due,
  doneAt: null,
  size: "M",
  ...extra,
});

describe("applyItemState", () => {
  it("applies size overrides and done marks", () => {
    const items = [task("a", "2026-10-28T00:00:00Z"), task("b", "2026-10-29T00:00:00Z")];
    const out = applyItemState(
      items,
      [
        { source_id: SRC, item_key: "a", done_at: null, size_override: "L" },
        { source_id: SRC, item_key: "b", done_at: "2026-10-26T10:00:00Z", size_override: null },
      ],
      NOW,
    );
    expect(out.map((i) => [i.itemKey, i.size, i.doneAt])).toEqual([
      ["a", "L", null],
      ["b", "M", "2026-10-26T10:00:00Z"],
    ]);
  });

  it("drops done items past the release window and keeps a source's own completion", () => {
    const old = task("old", "2026-10-20T00:00:00Z");
    const closed = task("gh", "2026-10-20T00:00:00Z", { doneAt: "2026-10-26T09:00:00Z" });
    const out = applyItemState([old, closed], [
      { source_id: SRC, item_key: "old", done_at: "2026-10-23T00:00:00Z", size_override: null },
      { source_id: SRC, item_key: "gh", done_at: "2026-10-20T00:00:00Z", size_override: null },
    ], NOW);
    expect(out.map((i) => [i.itemKey, i.doneAt])).toEqual([["gh", "2026-10-26T09:00:00Z"]]);
  });

  it("silent done marks vent nothing and leave the list", () => {
    const late = task("late", "2026-10-20T00:00:00Z");
    expect(overdueOpen([late, task("soon", "2026-10-27T00:00:00Z")], NOW).map((i) => i.itemKey)).toEqual(["late"]);
    const done_at = silentDoneAt(NOW);
    expect(computePressure([{ ...late, doneAt: done_at }], NOW).raw).toBe(0);
    expect(applyItemState([late], [{ source_id: SRC, item_key: "late", done_at, size_override: null }], NOW)).toEqual([]);
  });
});
