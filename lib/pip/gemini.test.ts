import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { askGemini } from "./gemini";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("uses the real Google provider protocol with a server key and parses its reply", async () => {
  vi.stubEnv("GEMINI_API_KEY", "synthetic-key-not-real");
  vi.stubEnv("GEMINI_MODEL", "gemini-3.8-flash");
  const fetcher = vi.fn(async () => Response.json({
    candidates: [{ content: { role: "model", parts: [{ text: "Start with the draft due tomorrow." }] }, finishReason: "STOP" }],
    usageMetadata: { promptTokenCount: 40, candidatesTokenCount: 12, totalTokenCount: 52 }, modelVersion: "gemini-3.8-flash",
  }));
  vi.stubGlobal("fetch", fetcher);
  const reply = await askGemini([{ role: "user", content: "What should I do?" }], {
    asOf: "2026-10-24T16:00:00Z", timeZone: "America/New_York", totalOpen: 1, unavailableSources: 0, truncated: false,
    assignments: [{ title: "Draft", dueAt: "2026-10-25T16:00:00Z", size: "M", source: "manual", course: null }],
  });
  expect(reply).toBe("Start with the draft due tomorrow.");
  expect(fetcher).toHaveBeenCalledOnce();
  const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  expect(String(url)).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent");
  expect(new Headers(init.headers).get("x-goog-api-key")).toBe("synthetic-key-not-real");
  const body = JSON.parse(init.body as string);
  expect(body.generationConfig.thinkingConfig.thinkingLevel).toBe("low");
  expect(JSON.stringify(body.systemInstruction)).toContain("Draft");
  expect(JSON.stringify(body.systemInstruction)).toContain("untrusted data");
  expect(JSON.stringify(body.contents)).toContain("What should I do?");
});
