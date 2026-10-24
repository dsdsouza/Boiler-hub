import { describe, expect, it } from "vitest";
import { sortBoilers, toTeamBoiler, type TeamBoilerRow } from "@/lib/data/teams";

const row = (over: Partial<TeamBoilerRow>): TeamBoilerRow => ({
  user_id: "u1",
  name: "Maya",
  avatar_url: null,
  score: 74,
  zone: "hot",
  status: "heads_down",
  status_note: null,
  counts: { meetings: 3, meetingHours: 4, tasksDue: 2, overdue: 0 },
  updated_at: "2026-10-24T09:00:00Z",
  ...over,
});

describe("toTeamBoiler", () => {
  it("maps a synced row", () => {
    const b = toTeamBoiler(row({}), new Set(["u1"]));
    expect(b).toMatchObject({ userId: "u1", score: 74, zone: "hot", synced: true, isLead: true });
    expect(b.statusNote).toBeUndefined();
  });

  it("fills placeholders for a never-synced member", () => {
    const b = toTeamBoiler(row({ score: null, zone: null, counts: null, updated_at: null, name: null }), new Set());
    expect(b).toMatchObject({ score: 0, zone: "cool", synced: false, name: "Unnamed", updatedAt: "" });
    expect(b.counts).toEqual({ meetings: 0, meetingHours: 0, tasksDue: 0, overdue: 0 });
  });
});

describe("sortBoilers", () => {
  it("sorts synced by score desc, never-synced last", () => {
    const s = sortBoilers([
      { name: "a", score: 10, synced: true },
      { name: "b", score: 0, synced: false },
      { name: "c", score: 90, synced: true },
    ]);
    expect(s.map((x) => x.name)).toEqual(["c", "a", "b"]);
  });
});
