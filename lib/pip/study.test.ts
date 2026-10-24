import { describe, expect, it } from "vitest";
import {
  focusPhase,
  nextStudyOpening,
  parseStudyContext,
  verifiedCourseReply,
  type FocusSession,
} from "./study";
import { parseChatBody } from "./contracts";

const now = Date.parse("2026-10-24T20:00:00Z");
const source = {
  id: "syllabus",
  title: "CSE 214",
  text: "Homework is due Friday. An inorder traversal visits left, root, then right.",
};
const session: FocusSession = {
  id: "commitment",
  taskId: "task",
  title: "Tree homework",
  goal: "Outline question one",
  scope: "demo",
  startAt: now + 10000,
  endAt: now + 70000,
  demo: true,
};

describe("Pip accountability", () => {
  it("starts a scheduled session proactively and releases on time without awarding completion", () => {
    expect(focusPhase(session, now)).toBe("scheduled");
    expect(focusPhase(session, now + 10000)).toBe("active");
    expect(focusPhase(session, now + 70000)).toBe("review");
    expect(focusPhase({ ...session, outcome: "cancelled" }, now + 20000)).toBe(
      "cancelled",
    );
    expect(focusPhase({ ...session, outcome: "completed" }, now + 20000)).toBe(
      "completed",
    );
  });
  it("finds the next window across overlapping events and ignores invalid events and released time", () => {
    const event = (id: string, start: number, end: number) => ({
      id,
      kind: "event" as const,
      source: "google" as const,
      title: id,
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
    });
    const items = [
      event("class", now, now + 30 * 60000),
      event("meeting", now + 20 * 60000, now + 45 * 60000),
      { ...event("free", now + 45 * 60000, now + 60 * 60000), release: true },
      { ...event("bad", now, now + 1), start: "invalid" },
    ];
    expect(nextStudyOpening(items, now, 25)).toBe(now + 45 * 60000);
    expect(nextStudyOpening([], now, 25)).toBe(now + 60000);
  });
  it("accepts bounded course material alongside the existing authenticated chat contract", () => {
    const study = parseStudyContext({ sources: [source] });
    expect(study).toEqual({ sources: [source] });
    expect(
      parseChatBody({
        messages: [{ role: "user", content: "Explain traversal" }],
        timeZone: "UTC",
        study,
      }),
    ).toMatchObject({ study });
    expect(parseStudyContext({ sources: [source, source] })).toBeNull();
    expect(
      parseStudyContext({ sources: [{ ...source, text: "x".repeat(6001) }] }),
    ).toBeNull();
    expect(parseStudyContext({ sources: [1, 2, 3, 4] })).toBeNull();
    expect(
      parseChatBody({
        messages: [{ role: "user", content: "hi" }],
        timeZone: "UTC",
        study: { sources: [{ ...source, text: "short" }] },
      }),
    ).toBeNull();
  });
  it("rejects fabricated source quotes instead of displaying them as citations", () => {
    expect(
      verifiedCourseReply(
        {
          answer: "Your homework is due Friday.",
          citations: [
            { sourceId: source.id, quote: "Homework is due Friday." },
          ],
        },
        [source],
      ),
    ).toContain("[1] CSE 214\n“Homework is due Friday.”");
    expect(() =>
      verifiedCourseReply(
        {
          answer: "Anything",
          citations: [{ sourceId: source.id, quote: "Due Sunday." }],
        },
        [source],
      ),
    ).toThrow("Unverified citation");
    expect(() =>
      verifiedCourseReply(
        {
          answer: "Anything",
          citations: [
            { sourceId: "another-user", quote: "Homework is due Friday." },
          ],
        },
        [source],
      ),
    ).toThrow("Unverified citation");
    expect(
      verifiedCourseReply(
        { answer: "Try ten minutes to start.", citations: [] },
        [source],
      ),
    ).toBe("Try ten minutes to start.");
  });
});
