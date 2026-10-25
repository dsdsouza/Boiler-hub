import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { streamGemini } from "./gemini";
import type { PipContext } from "./context";

const context: PipContext = { asOf: "2026-10-24T23:00:00Z", timeZone: "UTC", assignments: [], totalOpen: 0, unavailableSources: 0, truncated: false };
const event = (value: unknown) => new TextEncoder().encode(`data: ${JSON.stringify(value)}\n\n`);
const start = { event_type: "step.start", index: 0, step: { type: "model_output" } };
const delta = (text: string) => ({ event_type: "step.delta", index: 0, delta: { type: "text", text } });
const stop = { event_type: "step.stop", index: 0 };
const complete = { event_type: "interaction.completed", interaction: { status: "completed" } };
function upstream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start(c) { controller = c; } });
  const fetcher = vi.fn(async () => new Response(body, { headers: { "Content-Type": "text/event-stream" } }));
  vi.stubEnv("GEMINI_API_KEY", "synthetic-not-real");
  vi.stubGlobal("fetch", fetcher);
  return { fetcher, send: (value: unknown) => controller.enqueue(event(value)), close: () => controller.close() };
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("streams actual Google Interactions deltas without waiting for completion or storing prompts", async () => {
  const provider = upstream();
  const reply = streamGemini([{ role: "user", content: "Help me start." }], context);
  provider.send(start); provider.send(delta("Start with "));
  expect(await reply.next()).toEqual({ done: false, value: "Start with " });
  const [, init] = provider.fetcher.mock.calls[0] as unknown as [string, RequestInit];
  const body = JSON.parse(init.body as string);
  expect(body.stream).toBe(true); expect(body.store).toBe(false);
  expect(body.previous_interaction_id).toBeUndefined();
  expect(body.generation_config.thinking_level).toBe("low");
  provider.send(delta("two minutes.")); provider.send(stop); provider.send(complete); provider.close();
  expect(await reply.next()).toEqual({ done: false, value: "two minutes." });
  expect((await reply.next()).done).toBe(true);
});

it("rejects an incomplete upstream stream after delivering its first text", async () => {
  const provider = upstream();
  const reply = streamGemini([{ role: "user", content: "Help." }], context);
  provider.send(start); provider.send(delta("Partial"));
  expect((await reply.next()).value).toBe("Partial");
  provider.close();
  await expect(reply.next()).rejects.toBeDefined();
});

it("retries one temporary provider outage before streaming without storing either request", async () => {
  const provider = upstream();
  provider.fetcher.mockResolvedValueOnce(Response.json({ error: { code: 503, message: "Busy", status: "UNAVAILABLE" } }, { status: 503, headers: { "Retry-After": "0" } }));
  provider.send(start); provider.send(delta("Ready.")); provider.send(stop); provider.send(complete); provider.close();
  let text = "";
  for await (const part of streamGemini([{ role: "user", content: "Help." }], context)) text += part;
  expect(text).toBe("Ready.");
  expect(provider.fetcher).toHaveBeenCalledTimes(2);
  for (const [, init] of provider.fetcher.mock.calls as unknown as [string, RequestInit][]) {
    expect(JSON.parse(init.body as string)).toMatchObject({ stream: true, store: false });
  }
});

it("streams course answers after checking preceding citations, then appends verified quotes", async () => {
  const provider = upstream();
  const study = { sources: [{ id: "brief", title: "Course brief", text: "Inorder visits left, root, right." }] };
  const reply = streamGemini([{ role: "user", content: "Explain inorder traversal for my assignment." }], { ...context, study });
  provider.send(start);
  provider.send(delta('{"citations":[{"sourceId":"brief","quote":"Inorder visits left, root, right."}],"answer":"Visit'));
  expect((await reply.next()).value).toBe("Visit");
  const [, init] = provider.fetcher.mock.calls[0] as unknown as [string, RequestInit];
  expect(JSON.parse(init.body as string).system_instruction).toContain("Provide complete solutions and draft content when requested");
  provider.send(delta(' the left subtree, then root, then right subtree."}')); provider.send(stop); provider.send(complete); provider.close();
  let rest = "";
  for await (const text of reply) rest += text;
  expect("Visit" + rest).toBe('Visit the left subtree, then root, then right subtree.\n\nCourse sources\n[1] Course brief\n“Inorder visits left, root, right.”');
});

it("rejects invented course quotes before exposing the associated answer", async () => {
  const provider = upstream();
  const study = { sources: [{ id: "brief", title: "Course brief", text: "Start with trees." }] };
  const reply = streamGemini([{ role: "user", content: "Late policy?" }], { ...context, study });
  provider.send(start);
  provider.send(delta('{"citations":[{"sourceId":"brief","quote":"No late penalty"}],"answer":"No penalty."}'));
  provider.send(stop); provider.send(complete); provider.close();
  await expect(reply.next()).rejects.toThrow("Unverified citation");
});
