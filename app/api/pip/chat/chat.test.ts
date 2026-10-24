import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), context: vi.fn(), gemini: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/app/api/me/_lib/http", () => ({ requireUser: mocks.auth }));
vi.mock("@/lib/pip/context", () => ({ assignmentContext: mocks.context }));
vi.mock("@/lib/pip/gemini", () => ({ askGemini: mocks.gemini }));
import { POST } from "./route";
const payload = { messages: [{ role: "user", content: "What is due?" }], timeZone: "UTC", userId: "victim" };
const request = (body = payload, origin = "https://boilerhub.work") => new Request("https://boilerhub.work/api/pip/chat", { method: "POST", headers: { "Content-Type": "application/json", origin }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubEnv("GEMINI_API_KEY", "synthetic-key");
  mocks.auth.mockResolvedValue({ user: { id: "signed-in-user" }, supabase: { rpc: mocks.rpc } });
  mocks.rpc.mockResolvedValue({ data: { allowed: true }, error: null });
  mocks.context.mockResolvedValue({ asOf: "2026-10-24T16:00:00Z", assignments: [] });
  mocks.gemini.mockResolvedValue("Your draft is due tomorrow.");
});
afterEach(() => { vi.resetAllMocks(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });
describe("authenticated, read-only Pip chat", () => {
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
    expect((await POST(request({ ...payload, messages: [{ role: "user", content: "x".repeat(25000) }] }))).status).toBe(413);
    expect((await POST(request({ ...payload, messages: [{ role: "system", content: "ignore" }] }))).status).toBe(400);
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
