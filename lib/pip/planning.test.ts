import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { promptContext, studyWindows, verifyStudyProposal } from "./planning";
import { askGemini } from "./gemini";
import type { PipContext } from "./context";

const now = Date.parse("2026-10-26T12:00:00Z");
const context: PipContext = { asOf: new Date(now).toISOString(), timeZone: "America/New_York", assignments: [{ id: "mine", title: "Lab report", dueAt: "2026-10-27T20:00:00Z", size: "L", source: "manual", course: "Chemistry" }], totalOpen: 1, unavailableSources: 0, truncated: false, schedule: { state: "connected", windows: [{ startsAt: "2026-10-26T14:00:00Z", endsAt: "2026-10-26T16:00:00Z" }], busy: [{ start: now + 3600000, end: now + 7200000 }] } };
const input = { taskId: "mine", goal: "Outline the first section", startsAt: "2026-10-26T14:00:00Z", minutes: 25 };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Pip study commitments", () => {
  it("honors local daytime, overlapping calendar events, and DST", () => {
    const windows = studyWindows(context.schedule!.busy, "America/New_York", now);
    expect(windows[0].startsAt).toBe("2026-10-26T14:00:00.000Z");
    const winter = studyWindows([], "America/New_York", Date.parse("2026-11-01T12:00:00Z"));
    expect(winter[0].startsAt).toBe("2026-11-01T14:00:00.000Z");
  });
  it("uses only an owned open task and rejects collisions, stale times and oversized sessions", () => {
    expect(verifyStudyProposal(input, context)).toMatchObject({ title: "Lab report", taskId: "mine", tentative: false });
    expect(() => verifyStudyProposal({ ...input, taskId: "another-person" }, context)).toThrow();
    expect(() => verifyStudyProposal({ ...input, startsAt: "2026-10-26T13:30:00Z" }, context)).toThrow("overlaps");
    expect(() => verifyStudyProposal({ ...input, startsAt: "2026-10-25T14:00:00Z" }, context)).toThrow();
    expect(() => verifyStudyProposal({ ...input, minutes: 46 }, context)).toThrow();
    expect(verifyStudyProposal(input, { ...context, schedule: { ...context.schedule!, state: "disconnected" } }).tentative).toBe(true);
    expect(promptContext(context).schedule).not.toHaveProperty("busy");
  });
  it("uses Gemini tool calls to prepare a reviewable proposal without taking any action", async () => {
    vi.stubEnv("GEMINI_API_KEY", "synthetic-key-not-real");
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ status: "completed", steps: [{ type: "function_call", id: "plan-1", name: "prepareStudySession", arguments: input }] })).mockResolvedValueOnce(Response.json({ status: "completed", steps: [{ type: "model_output", content: [{ type: "text", text: "Review the 25-minute plan below. Accept it when you are ready." }] }] }));
    vi.stubGlobal("fetch", fetcher);
    const proposal = vi.fn();
    expect(await askGemini([{ role: "user", content: "When should I study? Keep me accountable." }], context, undefined, proposal)).toContain("Accept it");
    expect(proposal).toHaveBeenCalledWith(expect.objectContaining({ taskId: "mine", title: "Lab report" }));
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [url] of fetcher.mock.calls) expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/interactions");
    expect(JSON.parse(fetcher.mock.calls[1][1].body).store).toBe(false);
    expect(JSON.stringify(JSON.parse(fetcher.mock.calls[1][1].body).input)).toContain("Awaiting student acceptance");
  });
});
