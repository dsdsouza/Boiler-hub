import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { askGemini } from "./gemini";
const context = { asOf: "2026-10-24T16:00:00Z", timeZone: "UTC", totalOpen: 0, unavailableSources: 0, truncated: false, assignments: [] };
const completed = () => Response.json({ status: "completed", steps: [{ type: "model_output", content: [{ type: "text", text: "No open assignments." }] }] });
const unavailable = () => Response.json({ error: { code: 503, message: "Busy", status: "UNAVAILABLE" } }, { status: 503, headers: { "Retry-After": "0" } });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("uses the real Google provider protocol with a server key and parses its reply", async () => {
  vi.stubEnv("GEMINI_API_KEY", "synthetic-key-not-real");
  vi.stubEnv("GEMINI_MODEL", "gemini-3.8-flash");
  const fetcher = vi.fn(async () => Response.json({
    status: "completed", steps: [{ type: "model_output", content: [{ type: "text", text: "Start with the draft due tomorrow." }] }],
    usage: { total_input_tokens: 40, total_output_tokens: 12, total_tokens: 52 }, model: "gemini-3.8-flash",
  }));
  vi.stubGlobal("fetch", fetcher);
  const reply = await askGemini([{ role: "user", content: "What should I do?" }], {
    asOf: "2026-10-24T16:00:00Z", timeZone: "America/New_York", totalOpen: 1, unavailableSources: 0, truncated: false,
    assignments: [{ title: "Draft", dueAt: "2026-10-25T16:00:00Z", size: "M", source: "manual", course: null }],
  });
  expect(reply).toBe("Start with the draft due tomorrow.");
  expect(fetcher).toHaveBeenCalledOnce();
  const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  expect(String(url)).toBe("https://generativelanguage.googleapis.com/v1beta/interactions");
  expect(new Headers(init.headers).get("x-goog-api-key")).toBe("synthetic-key-not-real");
  const body = JSON.parse(init.body as string);
  expect(body.generation_config.thinking_level).toBe("low");
  expect(body.store).toBe(false);
  expect(body.previous_interaction_id).toBeUndefined();
  expect(JSON.stringify(body.system_instruction)).toContain("Draft");
  expect(JSON.stringify(body.system_instruction)).toContain("untrusted data");
  expect(body.system_instruction).toContain("even ungraded practice");
  expect(body.system_instruction).toContain("For mixed requests");
  expect(JSON.stringify(body.input)).toContain("What should I do?");
});

it("recovers from one service-unavailable response without storing either interaction", async () => {
  vi.stubEnv("GEMINI_API_KEY", "synthetic-key-not-real");
  const fetcher = vi.fn().mockResolvedValueOnce(unavailable()).mockResolvedValueOnce(completed());
  vi.stubGlobal("fetch", fetcher);
  expect(await askGemini([{ role: "user", content: "What is due?" }], context)).toBe("No open assignments.");
  expect(fetcher).toHaveBeenCalledTimes(2);
  for (const [, init] of fetcher.mock.calls) expect(JSON.parse(init.body).store).toBe(false);
});

it("stops after one retry when Gemini remains unavailable", async () => {
  vi.stubEnv("GEMINI_API_KEY", "synthetic-key-not-real");
  const fetcher = vi.fn(async () => unavailable());
  vi.stubGlobal("fetch", fetcher);
  await expect(askGemini([{ role: "user", content: "What is due?" }], context)).rejects.toBeDefined();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
