import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { MAX_PIP_REPLY, PIP_STREAM_TYPE, readPipReply } from "./stream";
import { pipStreamResponse } from "./stream-response";

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value) + "\n");
const options = () => ({ signal: new AbortController().signal, asOf: "2026-10-24T23:00:00Z", onError: vi.fn(() => "Please try again.") });
const wire = (parts: Uint8Array[]) => new Response(new ReadableStream({ start(c) { for (const part of parts) c.enqueue(part); c.close(); } }), { headers: { "Content-Type": PIP_STREAM_TYPE } });

describe("Pip streaming transport", () => {
  it("delivers text to the UI before generation is allowed to finish", async () => {
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => { finish = resolve; });
    const response = pipStreamResponse(async function* () { yield "Start "; await gate; yield "small."; }, options());
    const seen = vi.fn();
    const done = readPipReply(response, seen);
    await vi.waitFor(() => expect(seen).toHaveBeenCalledWith("Start "));
    expect(seen).not.toHaveBeenCalledWith("Start small.");
    finish();
    expect(await done).toBe("Start small.");
    expect(response.headers.get("cache-control")).toBe("private, no-store, no-transform");
  });

  it("handles UTF-8 characters and JSON boundaries split between network reads", async () => {
    const bytes = new Uint8Array([...encode({ type: "delta", text: "Café ☕" }), ...encode({ type: "done" })]);
    const chunks = Array.from(bytes, (byte) => new Uint8Array([byte]));
    expect(await readPipReply(wire(chunks), () => {})).toBe("Café ☕");
  });

  it("accepts many valid events coalesced into one network read", async () => {
    const text = "x".repeat(2000);
    const bytes = new TextEncoder().encode([...text].map((letter) => JSON.stringify({ type: "delta", text: letter }) + "\n").join("") + '{"type":"done"}\n');
    expect(await readPipReply(wire([bytes]), () => {})).toBe(text);
  });

  it("reports interrupted, empty, malformed and oversized replies instead of saving them", async () => {
    await expect(readPipReply(wire([encode({ type: "delta", text: "Partial" })]), () => {})).rejects.toThrow("interrupted");
    await expect(readPipReply(wire([encode({ type: "done" })]), () => {})).rejects.toThrow("couldn’t answer");
    await expect(readPipReply(wire([encode({ type: "delta", text: "x".repeat(MAX_PIP_REPLY + 1) })]), () => {})).rejects.toThrow();
    await expect(readPipReply(wire([new TextEncoder().encode("not json\n")]), () => {})).rejects.toThrow();
  });

  it("sends only a sanitized error if generation fails after a partial reply", async () => {
    const config = options();
    const failure = new Error("private prompt and secret key");
    const response = pipStreamResponse(async function* () { yield "Partial"; throw failure; }, config);
    const seen = vi.fn();
    await expect(readPipReply(response, seen)).rejects.toThrow("Please try again.");
    expect(seen).toHaveBeenCalledWith("Partial");
    expect(config.onError).toHaveBeenCalledWith(failure);
  });

  it("aborts the provider and releases generation when the browser closes the stream", async () => {
    const config = options();
    let signal!: AbortSignal;
    const cleanup = vi.fn();
    const response = pipStreamResponse(async function* (upstream) {
      signal = upstream;
      try {
        yield "First";
        await new Promise<void>((resolve) => { if (upstream.aborted) resolve(); else upstream.addEventListener("abort", () => resolve(), { once: true }); });
      } finally { cleanup(); }
    }, config);
    const reader = response.body!.getReader();
    await reader.read();
    const pending = reader.read();
    await reader.cancel();
    expect((await pending).done).toBe(true);
    expect(signal.aborted).toBe(true);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(config.onError).not.toHaveBeenCalled();
  });

  it("keeps JSON replies and pre-stream HTTP errors compatible during deployment", async () => {
    expect(await readPipReply(Response.json({ reply: "Ready." }), () => {})).toBe("Ready.");
    await expect(readPipReply(Response.json({ error: "Chat limit reached." }, { status: 429 }), () => {})).rejects.toThrow("Chat limit reached.");
  });
});
