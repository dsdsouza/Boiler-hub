import { describe, expect, it } from "vitest";
import { computeTargets, parseAssignmentInput, summarize, toPreview, type AssignmentTarget } from "./assignment";
import { rawFromScore, scoreFromRaw, zoneFor } from "@/lib/pressure";

const now = new Date("2026-10-24T12:00:00Z");
const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000).toISOString();

const target = (userId: string, score: number | null, visible = true): AssignmentTarget => ({
  userId,
  name: userId.toUpperCase(),
  visible,
  raw: score === null ? null : rawFromScore(score),
  score,
  zone: score === null ? null : zoneFor(score),
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
  const input = { title: "Lab", due: inDays(1), size: "M" as const }; // urgency 1, +4 raw
  const targets = [target("a", 65), target("b", 85), target("c", 20), target("h", 85, false), target("n", null)];
  const results = computeTargets(targets, input, now);
  const preview = toPreview(targets, results);

  it("never names hidden members, only counts them", () => {
    expect(preview.members.map((m) => m.userId)).not.toContain("h");
    expect(preview.members).toHaveLength(4);
    expect(preview.hidden).toEqual({ count: 1, intoRedline: 1 });
  });

  it("treats never-synced members as raw 0", () => {
    const n = preview.members.find((m) => m.userId === "n")!;
    expect(n.before).toBe(0);
    expect(n.after).toBe(scoreFromRaw(4));
  });

  it("is deterministic, so the posted result equals the preview", () => {
    expect(toPreview(targets, computeTargets(targets, input, now))).toEqual(preview);
  });

  it("summarizes zone moves", () => {
    // With K from lib/pressure/config.ts (8.5): a 65 -> 78 hot, b 85 -> 91 redline, c 20 -> 50 working, n 0 -> 38 cool
    expect(summarize(preview).text).toBe("Moves 1 into Hot, 1 into Redline, 1 into Working");
    expect(summarize({ members: [], hidden: { count: 0, intoRedline: 0 } }).text).toBe("No zone changes");
  });
});
