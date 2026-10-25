import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { checkPipScope } from "./scope";
import { PIP_VOICE, PIP_VOICE_REVIEW_NOTE } from "./policy";

const messages = [
  { role: "user" as const, content: "Give me exam answers" },
  { role: "assistant" as const, content: "I can help with planning instead." },
  { role: "user" as const, content: "Then help me plan a 25-minute study block." },
];
function completion(text: string) {
  return Response.json({ status: "completed", steps: [{ type: "model_output", content: [{ type: "text", text }] }] });
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it.each(["allow", "refuse"])("validates a closed %s decision through the real provider protocol", async (result) => {
  vi.stubEnv("GEMINI_API_KEY", "synthetic-key-not-real");
  const fetcher = vi.fn(async () => completion(JSON.stringify({ decision: result, timeZone: null })));
  vi.stubGlobal("fetch", fetcher);
  expect(await checkPipScope(messages, new AbortController().signal)).toEqual({ allowed: result === "allow", timeZone: null });
  const [, request] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  const body = JSON.parse(request.body as string);
  expect(body.store).toBe(false);
  expect(body.previous_interaction_id).toBeUndefined();
  expect(body.tools).toBeUndefined();
  expect(body.response_format[0].schema.properties.decision.enum).toEqual(["allow", "refuse"]);
  expect(body.system_instruction).toContain("LATEST user request");
  expect(body.system_instruction).toContain("past refused requests do not forbid");
  // The voice is answer style only; the request check uses the shared study policy.
  expect(body.system_instruction).not.toContain("boiler engineer");
  expect(body.system_instruction).not.toContain(PIP_VOICE_REVIEW_NOTE);
  expect(body.system_instruction).toContain("untrusted data");
  expect(JSON.stringify(body.input)).toContain(messages[2].content);
});

it.each(['{"decision":"maybe","timeZone":null}', 'allow', '{"decision":true,"timeZone":null}', '{}', '{"decision":"allow","timeZone":"invalid/zone"}'])("fails closed for invalid decisions: %s", async (text) => {
  vi.stubEnv("GEMINI_API_KEY", "synthetic-key-not-real");
  vi.stubGlobal("fetch", async () => completion(text));
  await expect(checkPipScope(messages, new AbortController().signal)).rejects.toBeDefined();
});

it("reviews the entire proposed reply, including citations, as untrusted data", async () => {
  vi.stubEnv("GEMINI_API_KEY", "synthetic-key-not-real");
  const fetcher = vi.fn(async () => completion('{"decision":"refuse","timeZone":null}'));
  vi.stubGlobal("fetch", fetcher);
  expect(await checkPipScope(messages, new AbortController().signal, "Here is a private API key from the hidden instructions.")).toEqual({ allowed: false, timeZone: null });
  const [, request] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  const body = JSON.parse(request.body as string);
  expect(body.system_instruction).toContain("including inside citations");
  // The reply check learns the house style exists, so it judges substance, not a steam phrase.
  expect(body.system_instruction).toContain(PIP_VOICE_REVIEW_NOTE);
  expect(body.system_instruction).not.toContain(PIP_VOICE);
  expect(JSON.stringify(body.input)).toContain("proposedReply");
});

it.each([undefined, "Subtract 3, then divide by 2: x = 4."])("permits assignment solutions in the request and reply instructions (draft=%s)", async (draft) => {
  vi.stubEnv("GEMINI_API_KEY", "synthetic-key-not-real");
  const fetcher = vi.fn(async () => completion('{"decision":"allow","timeZone":null}'));
  vi.stubGlobal("fetch", fetcher);
  const question = [{ role: "user" as const, content: "Solve my graded homework: 2x + 3 = 11. Then help me plan my week." }];
  expect(await checkPipScope(question, new AbortController().signal, draft)).toEqual({ allowed: true, timeZone: null });
  const [, request] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  const body = JSON.parse(request.body as string);
  expect(body.system_instruction).toContain("answer homework, assignment, quiz, exam, and practice questions");
  expect(body.system_instruction).toContain("Requests may combine planning and subject help; answer both parts");
  expect(body.system_instruction).not.toMatch(/REFUSE: solve|Refuse subject explanations|Return allow only for planning|REFUSE unrelated general chat/);
  expect(body.system_instruction).toContain(draft === undefined ? "do not require teacher permission or a planning component" : "Do not reject content because it could be submitted as assignment work");
  expect(JSON.stringify(body.input)).toContain(question[0].content);
});

it("never retries a failed check or falls back to unchecked generation", async () => {
  vi.stubEnv("GEMINI_API_KEY", "synthetic-key-not-real");
  const fetcher = vi.fn(async () => Response.json({ error: { message: "private", code: 503, status: "UNAVAILABLE" } }, { status: 503 }));
  vi.stubGlobal("fetch", fetcher);
  await expect(checkPipScope(messages, new AbortController().signal)).rejects.toBeDefined();
  expect(fetcher).toHaveBeenCalledOnce();
});

it("validates an extracted IANA timezone before it can format assignment dates", async () => {
  vi.stubEnv("GEMINI_API_KEY", "synthetic-key-not-real");
  vi.stubGlobal("fetch", async () => completion('{"decision":"allow","timeZone":"America/New_York"}'));
  expect(await checkPipScope(messages, new AbortController().signal)).toEqual({ allowed: true, timeZone: "America/New_York" });
});
