import { describe, expect, it } from "vitest";
import { computeTargets, freshness, parseAssignmentInput, safeHiddenCount, summarize, toPreview, type AssignmentTarget } from "./assignment";
import { rawFromScore, zoneFor } from "@/lib/pressure";

const now = new Date("2026-10-24T12:00:00Z");
const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000).toISOString();

const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

const target = (userId: string, score: number | null, visible = true, updatedAt: string | null = hoursAgo(1)): AssignmentTarget => ({
  userId,
  name: userId.toUpperCase(),
  visible,
  raw: score === null ? null : rawFromScore(score),
  score,
  zone: score === null ? null : zoneFor(score),
  updatedAt: score === null ? null : updatedAt,
});

describe("parseAssignmentInput", () => {
  it("accepts a valid body and trims the title", () => {
    const r = parseAssignmentInput({ title: "  Lab report ", due: inDays(3), size: "L" }, now);
    expect(r).toEqual({ ok: true, value: { title: "Lab report", due: inDays(3), size: "L" } });
  });

  it("rejects empty titles, bad sizes, bad or past dates", () => {
    expect(parseAssignmentInput({ title: " ", due: inDays(1), size: "M" }, now).ok).toBe(false);
    expect(parseAssignmentInput({ title: "x", due: inDays(1), size: "XL" }, now).ok).toBe(false);
    expect(parseAssignmentInput({ title: "x", due: "soon", size: "M" }, now).ok).toBe(false);
    expect(parseAssignmentInput({ title: "x", due: inDays(-1), size: "M" }, now).ok).toBe(false);
    expect(parseAssignmentInput(null, now).ok).toBe(false);
  });
});

describe("preview", () => {
  const input = { title: "Lab", due: inDays(1), size: "M" as const }; // Calibrated medium homework due in one day.
  const targets = [
    target("a", 65),
    target("b", 89),
    target("c", 20),
    target("d", 30),
    target("h", 89, false),
    target("h2", 10, false),
    target("n", null), // never synced
    target("s", 60, true, hoursAgo(80)), // stale
  ];
  const results = computeTargets(targets, input, now);
  const preview = toPreview(targets, results);

  it("never names hidden members, only counts them", () => {
    expect(preview.members.map((m) => m.userId)).not.toContain("h");
    expect(preview.hidden).toEqual({ count: 2, intoRedline: 1 });
  });

  it("lists never-synced and stale members apart, out of the summary", () => {
    expect(preview.members.map((m) => m.userId).sort()).toEqual(["a", "b", "c", "d"]);
    expect(preview.noRecentData).toEqual([
      { userId: "n", name: "N" },
      { userId: "s", name: "S" },
    ]);
    expect(preview.recipients).toBe(8);
  });

  it("never names hidden stale or never-synced members; they fold into the anonymous hidden count", () => {
    const mixed = [
      target("a", 65),
      target("hs", 88, false, hoursAgo(100)), // hidden, stale
      target("hn", null, false), // hidden, never synced
      target("h", 89, false),
    ];
    const p = toPreview(mixed, computeTargets(mixed, input, now));
    expect(p.noRecentData).toEqual([]);
    expect(p.hidden.count).toBe(3);
    expect(p.hidden.intoRedline).toBe(1); // only the recent one can be counted crossing
    const lone = [target("a", 65), target("hs", 88, false, hoursAgo(100))];
    const q = toPreview(lone, computeTargets(lone, input, now));
    expect(q.noRecentData).toEqual([]);
    expect(q.hidden).toEqual({ count: 0, intoRedline: 0 });
  });

  it("shows no hidden count below two hidden members, and no recipient total that would reveal one", () => {
    const one = [target("a", 65), target("h", 89, false)];
    const p = toPreview(one, computeTargets(one, input, now));
    expect(p.hidden).toEqual({ count: 0, intoRedline: 0 });
    expect(p.recipients).toBeNull();
    const none = [target("a", 65)];
    expect(toPreview(none, computeTargets(none, input, now)).recipients).toBe(1);
    expect([0, 1, 2, 5].map(safeHiddenCount)).toEqual([0, 0, 2, 5]);
  });

  it("is deterministic, so the posted result equals the preview", () => {
    expect(toPreview(targets, computeTargets(targets, input, now))).toEqual(preview);
  });

  it("summarizes zone moves", () => {
    // The shared model moves a into Hot, b into Redline and d into Working.
    expect(summarize(preview).text).toBe("Moves 1 into Hot, 1 into Redline, 1 into Working");
    expect(summarize({ members: [], hidden: { count: 0, intoRedline: 0 } }).text).toBe("No zone changes");
  });
});

describe("freshness", () => {
  it("fresh up to 24h, dim to 72h, then stale; never without a snapshot", () => {
    expect([hoursAgo(2), hoursAgo(30), hoursAgo(73), null, ""].map((t) => freshness(t, now))).toEqual([
      "fresh", "dim", "stale", "never", "never",
    ]);
  });
});
