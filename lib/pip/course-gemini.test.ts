import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { askGemini } from "./gemini";
import type { PipContext } from "./context";
import { PIP_VOICE } from "./policy";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const context: PipContext = {
  asOf: "2026-10-24T20:00:00Z",
  timeZone: "America/New_York",
  assignments: [],
  totalOpen: 0,
  truncated: false,
  unavailableSources: 0,
  study: {
    sources: [
      {
        id: "source",
        title: "Course brief",
        text: "The late policy permits a 24-hour grace period with a ten percent deduction.",
      },
    ],
  },
};
const completed = (answer: object) =>
  Response.json({
    status: "completed",
    steps: [
      {
        type: "model_output",
        content: [{ type: "text", text: JSON.stringify(answer) }],
      },
    ],
  });
const unavailable = () =>
  Response.json(
    { error: { code: 503, message: "Busy", status: "UNAVAILABLE" } },
    { status: 503, headers: { "Retry-After": "0" } },
  );

it("routes source questions through non-stored Gemini Interactions with verified structured quotes", async () => {
  vi.stubEnv("GEMINI_API_KEY", "synthetic-key-not-real");
  const fetcher = vi.fn(async () =>
    completed({
      answer: "There is a 24-hour grace period.",
      citations: [
        { sourceId: "source", quote: context.study!.sources[0].text },
      ],
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  const reply = await askGemini(
    [{ role: "user", content: "What is the late policy?" }],
    context,
  );
  expect(reply).toContain("[1] Course brief");
  const [url, request] = fetcher.mock.calls[0] as unknown as [
    string,
    RequestInit,
  ];
  expect(url).toBe(
    "https://generativelanguage.googleapis.com/v1beta/interactions",
  );
  expect(new Headers(request.headers).get("x-goog-api-key")).toBe(
    "synthetic-key-not-real",
  );
  const body = JSON.parse(request.body as string);
  expect(body.response_format).toEqual([
    expect.objectContaining({
      type: "text",
      mime_type: "application/json",
      schema: expect.objectContaining({
        type: "object",
        required: ["answer", "citations"],
      }),
    }),
  ]);
  expect(body.store).toBe(false);
  expect(body.generation_config.thinking_level).toBe("low");
  expect(body.system_instruction).toContain("untrusted data");
  expect(body.system_instruction).toContain("even ungraded practice");
  expect(body.system_instruction).toContain("never quote solutions");
  expect(body.system_instruction).toContain(PIP_VOICE);
});

it("rejects invented citations and never silently substitutes a demo answer", async () => {
  vi.stubEnv("GEMINI_API_KEY", "synthetic-key-not-real");
  vi.stubGlobal("fetch", async () =>
    completed({
      answer: "No late penalty",
      citations: [{ sourceId: "source", quote: "No late penalty" }],
    }),
  );
  await expect(
    askGemini([{ role: "user", content: "Late policy?" }], context),
  ).rejects.toThrow("Unverified citation");
  const fetcher = vi.fn(async () => unavailable());
  vi.stubGlobal("fetch", fetcher);
  await expect(
    askGemini([{ role: "user", content: "Late policy?" }], context),
  ).rejects.toBeDefined();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
