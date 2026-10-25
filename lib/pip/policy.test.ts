import { describe, expect, it } from "vitest";
import { PIP_ANSWER_RULES, PIP_REFUSAL, PIP_SCOPE, PIP_VOICE, PIP_VOICE_REVIEW_NOTE } from "./policy";

const STEAM_WORDING = ["pressure", "breathing room", "steady steam", "running smoothly", "cooling down", "easing the load", "engine"];

describe("Pip's voice", () => {
  it("reaches both answer paths through the shared rules, after the unchanged scope", () => {
    expect(PIP_ANSWER_RULES.startsWith(PIP_SCOPE)).toBe(true);
    expect(PIP_ANSWER_RULES).toContain(PIP_VOICE);
  });

  it("stays out of the scope text the request classifier uses", () => {
    expect(PIP_SCOPE).not.toContain("boiler engineer");
    expect(PIP_SCOPE).not.toContain(PIP_VOICE_REVIEW_NOTE);
  });

  it("caps metaphor and rules out roleplay", () => {
    expect(PIP_VOICE).toContain("at most one light steam-and-steel phrase in a short reply");
    expect(PIP_VOICE).toContain("none is required");
    expect(PIP_VOICE).toContain("Ordinary planning language comes first");
    expect(PIP_VOICE).toContain("No roleplay");
  });

  it("keeps critical content literal", () => {
    for (const literal of [
      "deadlines, dates and times",
      "overdue work",
      "partial, unavailable, or truncated sources",
      "calendar coverage and anything needing the person's confirmation",
      "study-card titles and goals",
      "citations and quotes",
      "refusals",
    ]) {
      expect(PIP_VOICE).toContain(literal);
    }
  });

  it("never lets the voice invent a pressure reading, findings, or coverage", () => {
    expect(PIP_ANSWER_RULES).toContain("pressure readings are absent");
    expect(PIP_VOICE).toContain("The supplied facts contain no pressure readings");
    expect(PIP_VOICE).toContain("never state, estimate, or imply a score, zone, or gauge level");
    expect(PIP_VOICE).toContain("Never claim analysis, completed work, or calendar coverage the facts do not show");
  });

  it("leaves the fixed refusal literal", () => {
    const refusal = PIP_REFUSAL.toLowerCase();
    for (const word of STEAM_WORDING) expect(refusal).not.toContain(word);
  });
});
