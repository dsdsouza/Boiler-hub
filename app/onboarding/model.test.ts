import { describe, expect, it } from "vitest";
import {
  isStepValid,
  parseDraft,
  recommendation,
  resolvedGoal,
  stepsFor,
  unlockedIndex,
} from "./model";

describe("onboarding paths and retained progress", () => {
  it("requires valid answers and an authenticated account to unlock setup", () => {
    const d = parseDraft({
      role: "student",
      name: "Alex",
      goal: "deadlines",
      starting: "fresh",
      completed: [
        "identity",
        "name",
        "goal",
        "starting",
        "reassurance",
        "account",
      ],
    });
    expect(stepsFor(d)[unlockedIndex(d, false)]).toBe("account");
    expect(stepsFor(d)[unlockedIndex(d, true)]).toBe("extension");
    d.name = "   ";
    expect(unlockedIndex(d, true)).toBe(1);
    expect(isStepValid("team", { ...d, inviteCode: "ABC" }, true)).toBe(false);
  });
  it("recommends a role-specific path when someone is unsure", () => {
    expect(
      resolvedGoal(parseDraft({ role: "student", goal: "recommend" })),
    ).toBe("deadlines");
    expect(
      recommendation(parseDraft({ role: "lead", goal: "recommend" })).href,
    ).toBe("/teams");
    expect(
      resolvedGoal(parseDraft({ role: "professional", goal: "recommend" })),
    ).toBe("balance");
  });
  it("asks only goal-relevant details, while retaining answers when paths change", () => {
    const d = parseDraft({
      role: "student",
      goal: "deadlines",
      milestone: "Lab report",
      deadline: "2026-11-02",
    });
    expect(stepsFor(d)).toContain("deadline");
    expect(stepsFor({ ...d, milestone: "" })).not.toContain("deadline");
    const focus = { ...d, goal: "focus" as const };
    expect(stepsFor(focus)).not.toContain("deadline");
    expect(stepsFor(focus)).toContain("focus-extension");
    expect(parseDraft(JSON.parse(JSON.stringify(focus))).milestone).toBe(
      "Lab report",
    );
    expect(stepsFor({ ...focus, goal: "deadlines" })).toContain("deadline");
    expect(
      isStepValid("goal", { ...d, role: "professional", goal: "team" }, true),
    ).toBe(false);
  });
  it("bounds untrusted drafts and rejects malformed dates or injected steps", () => {
    const d = parseDraft({
      role: "admin",
      name: "x".repeat(100),
      goal: "evil",
      deadline: "2026-02-30",
      current: "bypass",
      completed: ["identity", "identity", "bypass"],
      token: "secret",
    });
    expect(d.name).toHaveLength(60);
    expect(d.role).toBe("");
    expect(d.goal).toBe("");
    expect(d.deadline).toBe("");
    expect(d.current).toBe("identity");
    expect(d.completed).toEqual(["identity"]);
    expect(d).not.toHaveProperty("token");
  });
});
