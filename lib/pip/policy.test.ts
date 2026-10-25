import { describe, expect, it } from "vitest";
import { PIP_ANSWER_RULES, PIP_REFUSAL, PIP_SCOPE, PIP_VOICE, PIP_VOICE_REVIEW_NOTE } from "./policy";

describe("Pip's voice", () => {
  it("reaches both answer paths through the shared rules and study scope", () => {
    expect(PIP_ANSWER_RULES.startsWith(PIP_SCOPE)).toBe(true);
    expect(PIP_ANSWER_RULES).toContain(PIP_VOICE);
  });

  it("stays out of the scope text the request classifier uses", () => {
    expect(PIP_SCOPE).not.toContain("boiler engineer");
    expect(PIP_SCOPE).not.toContain(PIP_VOICE_REVIEW_NOTE);
  });

  it("specifies spoken phrasing and examples instead of just naming an accent", () => {
    for (const phrase of ["we'll", "you've", "let's", "can't", "ain't", "reckon", "ol' friend", "a spell", "Y'all", "Cadence examples"]) {
      expect(PIP_VOICE).toContain(phrase);
    }
    expect(PIP_VOICE).toContain("Don't spell out an accent phonetically");
    expect(PIP_VOICE).toContain("At most one light steam-and-steel phrase in a short reply");
    expect(PIP_VOICE).toContain("none is required");
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

  it("uses the same short playful redirect for generated and fixed refusals", () => {
    expect(PIP_REFUSAL).toMatch(/^You know I can't do that, ol' friend!/);
    expect(PIP_REFUSAL).toContain("What's due next?");
    expect(PIP_REFUSAL.split(/\s+/).length).toBeLessThan(30);
    expect(PIP_REFUSAL).not.toMatch(/homework|exam answers|work to submit|unrelated requests|I can help you plan/i);
    expect(PIP_ANSWER_RULES).toContain(`reply with exactly this line, with no preface, capability list, or explanation: "${PIP_REFUSAL}"`);
    expect(PIP_VOICE).toContain("Never recite capabilities, forbidden categories, or policy disclaimers");
    expect(PIP_VOICE_REVIEW_NOTE).toContain("brief playful refusal followed by a planning question");
    expect(PIP_VOICE_REVIEW_NOTE).toContain("judge the substance against the same scope policy");
  });
});
