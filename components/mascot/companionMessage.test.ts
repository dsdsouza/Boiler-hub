import { describe, expect, it } from "vitest";
import type { ForecastDay } from "@/lib/types";
import { zoneOf } from "@/components/ui/zones";
import { companionMessage, type CompanionInput } from "./companionMessage";
import { BANNED_PHRASES, ZONE_LINE } from "./voice";

function week(scores: number[]): ForecastDay[] {
  // 2026-10-26 is a Monday.
  return scores.map((s, i) => ({ date: `2026-10-${String(26 + i).padStart(2, "0")}`, score: s, zone: zoneOf(s) }));
}

const base: CompanionInput = {
  score: 55,
  zone: "working",
  forecast: week([55, 58, 60, 62, 58, 40, 35]),
  contributions: [{ itemId: "a", title: "Design review", points: 3.2, reason: "" }],
  itemCount: 4,
  calendar: "ok",
};

describe("companionMessage", () => {
  it("stays quiet when the calendar did not feed the score", () => {
    expect(companionMessage({ ...base, calendar: "reconnect" })).toBeNull();
    expect(companionMessage({ ...base, calendar: "unavailable" })).toBeNull();
  });

  it("celebrates a fresh vent ahead of everything else", () => {
    const m = companionMessage({ ...base, zone: "redline", score: 92, vented: 2.4 })!;
    expect(m.reaction).toBe("celebrate");
    expect(m.headline).toBe("A little breathing room.");
    expect(m.body).toContain("2.4 points");
  });

  it("names the biggest driver when today is hot", () => {
    const m = companionMessage({
      ...base,
      score: 78,
      zone: "hot",
      contributions: [
        { itemId: "a", title: "Design review", points: 3.2, reason: "" },
        { itemId: "b", title: "Q4 deck", points: 5.1, reason: "" },
        { itemId: "c", title: "Focus time", points: -1, reason: "" },
      ],
    })!;
    expect(m.reaction).toBe("attentive");
    expect(m.body).toContain("“Q4 deck” (+5.1)");
    expect(m.action?.target).toBe("breakdown");
  });

  it("flags the heaviest upcoming day with its real score", () => {
    const m = companionMessage({ ...base, forecast: week([55, 60, 66, 84, 72, 40, 35]) })!;
    expect(m.headline).toBe("Thursday looks full.");
    expect(m.body).toContain("84 (Hot) on Thursday");
    expect(m.action?.target).toBe("forecast");
  });

  it("says tomorrow instead of a weekday for the next day", () => {
    expect(companionMessage({ ...base, forecast: week([55, 80, 60, 50, 50, 40, 35]) })!.headline).toBe("Tomorrow looks full.");
  });

  it("falls back to the zone line, and to a clear week with no items", () => {
    expect(companionMessage(base)!.headline).toBe(ZONE_LINE.working.headline);
    expect(companionMessage({ ...base, itemCount: 0 })!.headline).toBe("Your next 7 days look clear.");
  });

  it("never uses guilt or nagging phrases", () => {
    const inputs: CompanionInput[] = [
      base,
      { ...base, itemCount: 0 },
      { ...base, vented: 1 },
      { ...base, score: 80, zone: "hot" },
      { ...base, score: 95, zone: "redline", contributions: [] },
      { ...base, forecast: week([55, 60, 66, 84, 72, 40, 35]) },
    ];
    const copy = inputs
      .map((i) => companionMessage(i)!)
      .flatMap((m) => [m.headline, m.body, m.action?.label ?? ""])
      .join(" ")
      .toLowerCase();
    for (const phrase of BANNED_PHRASES) expect(copy).not.toContain(phrase);
  });
});
