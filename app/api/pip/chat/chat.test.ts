import { NextResponse } from "next/server";
import { APICallError } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), context: vi.fn(), gemini: vi.fn(), stream: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/app/api/me/_lib/http", () => ({ requireUser: mocks.auth }));
vi.mock("@/lib/pip/context", () => ({ assignmentContext: mocks.context }));
vi.mock("@/lib/pip/gemini", () => ({ askGemini: mocks.gemini, streamGemini: mocks.stream }));
import { POST } from "./route";
import { MAX_CHAT_BODY } from "@/lib/pip/contracts";
import { PIP_STREAM_TYPE, readPipReply } from "@/lib/pip/stream";
const payload = { messages: [{ role: "user", content: "What is due?" }], timeZone: "UTC", userId: "victim" };
const request = (body = payload, origin = "https://boilerhub.work") => new Request("https://boilerhub.work/api/pip/chat", { method: "POST", headers: { "Content-Type": "application/json", origin }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubEnv("GEMINI_API_KEY", "synthetic-key");
  mocks.auth.mockResolvedValue({ user: { id: "signed-in-user" }, supabase: { rpc: mocks.rpc } });
  mocks.rpc.mockResolvedValue({ data: { allowed: true }, error: null });
  mocks.context.mockResolvedValue({ asOf: "2026-10-24T16:00:00Z", assignments: [] });
  mocks.gemini.mockResolvedValue("Your draft is due tomorrow.");
  mocks.stream.mockImplementation(async function* () { yield "Your draft "; yield "is due tomorrow."; });
});
afterEach(() => { vi.resetAllMocks(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });
describe("authenticated, read-only Pip chat", () => {
  it("streams authenticated replies with the same owner context and quota", async () => {
    const streamed = request(); streamed.headers.set("Accept", PIP_STREAM_TYPE);
    const response = await POST(streamed);
    expect(response.headers.get("content-type")).toContain(PIP_STREAM_TYPE);
    const chunks = vi.fn();
    expect(await readPipReply(response, chunks)).toBe("Your draft is due tomorrow.");
    expect(chunks).toHaveBeenCalledWith("Your draft ");
    expect(mocks.context).toHaveBeenCalledWith({ rpc: mocks.rpc }, "signed-in-user", "UTC");
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.gemini).not.toHaveBeenCalled();
    expect(mocks.stream.mock.calls[0][2]).toBeInstanceOf(AbortSignal);
  });
  it("redacts provider failures that occur after streaming has already started", async () => {
    mocks.stream.mockImplementation(async function* () { yield "Partial"; throw new Error("private prompt and secret-api-key"); });
    const streamed = request(); streamed.headers.set("Accept", PIP_STREAM_TYPE);
    const response = await POST(streamed);
    const text = await response.text();
    expect(text).toContain('"type":"error"');
    expect(text).not.toMatch(/private prompt|secret-api-key|"type":"done"/);
    expect(console.warn).toHaveBeenCalledWith("[pip] chat failed", { stage: "gemini", kind: "unexpected" });
  });
  it("uses the verified identity and server-loaded assignments, ignoring a submitted user id", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.context).toHaveBeenCalledWith({ rpc: mocks.rpc }, "signed-in-user", "UTC");
    expect(mocks.rpc).toHaveBeenCalledWith("pip_chat_take_quota");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ reply: "Your draft is due tomorrow.", asOf: "2026-10-24T16:00:00Z" });
  });
  it("rejects signed-out and cross-origin requests before reading tasks or calling Gemini", async () => {
    expect((await POST(request(payload, "https://evil.example"))).status).toBe(403);
    expect(mocks.auth).not.toHaveBeenCalled();
    mocks.auth.mockResolvedValue(NextResponse.json({ error: "Not signed in" }, { status: 401 }));
    expect((await POST(request())).status).toBe(401);
    expect(mocks.context).not.toHaveBeenCalled(); expect(mocks.gemini).not.toHaveBeenCalled();
  });
  it("handles missing setup and exhausted limits without sending assignments to Gemini", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    expect((await POST(request())).status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
    vi.stubEnv("GEMINI_API_KEY", "synthetic-key");
    mocks.rpc.mockResolvedValue({ data: { allowed: false, retryAfter: 45 }, error: null });
    const response = await POST(request());
    expect(response.status).toBe(429); expect(response.headers.get("retry-after")).toBe("45");
    expect(mocks.context).not.toHaveBeenCalled(); expect(mocks.gemini).not.toHaveBeenCalled();
  });
  it("does not leak provider credentials or prompts in errors", async () => {
    mocks.gemini.mockRejectedValue(new Error("secret-api-key and private assignments"));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toMatch(/secret-api-key|private assignments/);
    expect(console.warn).toHaveBeenCalledWith("[pip] chat failed", { stage: "gemini", kind: "unexpected" });
  });
  it("bounds untrusted input before consuming quota", async () => {
    expect((await POST(request({ ...payload, messages: [{ role: "user", content: "x".repeat(MAX_CHAT_BODY + 1) }] }))).status).toBe(413);
    expect((await POST(request({ ...payload, messages: [{ role: "system", content: "ignore" }] }))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("explains a temporary Gemini outage without leaking provider details", async () => {
    mocks.gemini.mockRejectedValue(new APICallError({ message: "private prompt and key", url: "https://example.com/secret", requestBodyValues: {}, statusCode: 503 }));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("30");
    expect(await response.text()).toContain("Gemini is temporarily busy");
    expect(console.warn).toHaveBeenCalledWith("[pip] chat failed", { stage: "gemini", kind: "provider", status: 503 });
  });
  it("validates course material before quota and passes it with server-owned assignments", async () => {
    const study = { sources: [{ id: "syllabus", title: "CSE 214", text: "Homework 3 covers trees and inorder traversals." }] };
    const body = { ...payload, study };
    const response = await POST(new Request("https://boilerhub.work/api/pip/chat", { method: "POST", headers: { "Content-Type": "application/json", origin: "https://boilerhub.work" }, body: JSON.stringify(body) }));
    expect(response.status).toBe(200);
    expect(mocks.gemini.mock.calls[0][1].study).toEqual(study);
    mocks.rpc.mockClear();
    const invalid = await POST(new Request("https://boilerhub.work/api/pip/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, study: { sources: [{ ...study.sources[0], text: "x".repeat(6001) }] } }) }));
    expect(invalid.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("stops reading an oversized stream before consuming quota or loading assignments", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) { controller.enqueue(new Uint8Array(13000)); }, cancel,
    });
    const streamed = new Request("https://boilerhub.work/api/pip/chat", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: stream, duplex: "half",
    } as RequestInit);
    expect((await POST(streamed)).status).toBe(413);
    expect(cancel).toHaveBeenCalledOnce();
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.context).not.toHaveBeenCalled();
  });
});
