import { describe, expect, it, vi } from "vitest";
import { isBlockedIp, parseFeedUrl, safeFetchText, type Lookup } from "./fetch";
import { SourceError } from "./types";
import type { LookupAddress, LookupAllOptions } from "node:dns";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(),
  resolve4: vi.fn(),
  resolve6: vi.fn(),
}));

import { lookup, resolve4, resolve6 } from "node:dns/promises";

const lookupAll = vi.mocked(lookup as (host: string, options: LookupAllOptions) => Promise<LookupAddress[]>);
const publicLookup: Lookup = async () => ["93.184.216.34"];
const ok = (body: string, init?: ResponseInit) => new Response(body, { status: 200, ...init });

describe("isBlockedIp", () => {
  it("blocks private, loopback, link-local and mapped addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.5.4", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });
  it("allows public addresses", () => {
    for (const ip of ["93.184.216.34", "8.8.8.8", "2606:4700:4700::1111"]) expect(isBlockedIp(ip), ip).toBe(false);
  });
});

describe("parseFeedUrl", () => {
  it("rewrites webcal to https and rejects other schemes and ports", () => {
    expect(parseFeedUrl("webcal://school.brightspace.com/feed.ics").href).toBe("https://school.brightspace.com/feed.ics");
    expect(() => parseFeedUrl("http://example.com/a.ics")).toThrow(SourceError);
    expect(() => parseFeedUrl("https://example.com:8443/a.ics")).toThrow(SourceError);
    expect(() => parseFeedUrl("file:///etc/passwd")).toThrow(SourceError);
    expect(() => parseFeedUrl("not a url")).toThrow(SourceError);
  });
});

describe("safeFetchText", () => {
  it("handles Workers CNAME answers without skipping any IP checks", async () => {
    lookupAll.mockResolvedValue([
      { address: "calendar.school.example.", family: 4 },
      { address: "93.184.216.34", family: 4 },
      { address: "calendar.school.example.", family: 6 },
    ]);
    const fetchImpl = vi.fn(async () => ok("BEGIN:VCALENDAR"));
    await expect(safeFetchText("https://school.example/feed.ics", { fetchImpl })).resolves.toBe("BEGIN:VCALENDAR");
    fetchImpl.mockClear();

    lookupAll.mockResolvedValue([
      { address: "calendar.school.example.", family: 4 },
      { address: "93.184.216.34", family: 4 },
      { address: "fd00::1", family: 6 },
    ]);
    await expect(safeFetchText("https://school.example/feed.ics", { fetchImpl })).rejects.toThrow(/not reachable/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects alias-only and malformed DNS answers", async () => {
    const fetchImpl = vi.fn();
    lookupAll.mockResolvedValue([{ address: "calendar.school.example.", family: 4 }]);
    await expect(safeFetchText("https://school.example/feed.ics", { fetchImpl })).rejects.toThrow(/not reachable/);
    lookupAll.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "not an address", family: 6 },
    ]);
    await expect(safeFetchText("https://school.example/feed.ics", { fetchImpl })).rejects.toThrow(/Could not find/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("uses DNS records on Workers and checks both address families", async () => {
    vi.mocked(lookup).mockRejectedValue(new Error("[unenv] dns.lookup is not implemented yet!"));
    vi.mocked(resolve4).mockResolvedValue(["93.184.216.34"]);
    vi.mocked(resolve6).mockResolvedValue(["fd00::1"]);
    const fetchImpl = vi.fn(async () => ok("BEGIN:VCALENDAR"));
    await expect(safeFetchText("https://school.example/feed.ics", { fetchImpl })).rejects.toThrow(/not reachable/);
    expect(fetchImpl).not.toHaveBeenCalled();

    vi.mocked(resolve6).mockRejectedValue(Object.assign(new Error("No AAAA record"), { code: "ENODATA" }));
    await expect(safeFetchText("https://school.example/feed.ics", { fetchImpl })).resolves.toBe("BEGIN:VCALENDAR");
  });

  it("handles CNAME records in the Workers record-resolution fallback", async () => {
    vi.mocked(lookup).mockRejectedValue(new Error("Not implemented"));
    vi.mocked(resolve4).mockResolvedValue(["calendar.school.example.", "93.184.216.34"]);
    vi.mocked(resolve6).mockResolvedValue(["calendar.school.example."]);
    const fetchImpl = vi.fn(async () => ok("BEGIN:VCALENDAR"));
    await expect(safeFetchText("https://school.example/feed.ics", { fetchImpl })).resolves.toBe("BEGIN:VCALENDAR");
  });

  it("fails closed when one DNS address family cannot be checked", async () => {
    vi.mocked(lookup).mockRejectedValue(new Error("Not implemented"));
    vi.mocked(resolve4).mockResolvedValue(["93.184.216.34"]);
    vi.mocked(resolve6).mockRejectedValue(Object.assign(new Error("DNS timeout"), { code: "ETIMEOUT" }));
    const fetchImpl = vi.fn();
    await expect(safeFetchText("https://school.example/feed.ics", { fetchImpl })).rejects.toThrow(/Could not find/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects literal private hosts without fetching", async () => {
    const fetchImpl = vi.fn();
    for (const url of ["https://127.0.0.1/x.ics", "https://[::1]/x.ics", "https://169.254.169.254/latest", "https://localhost/x.ics"]) {
      await expect(safeFetchText(url, { fetchImpl, lookup: publicLookup })).rejects.toThrow(SourceError);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a hostname that resolves to a private address", async () => {
    const fetchImpl = vi.fn();
    const lookup: Lookup = async () => ["93.184.216.34", "10.0.0.5"];
    await expect(safeFetchText("https://evil.example.com/x.ics", { fetchImpl, lookup })).rejects.toThrow(/not reachable/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("re-checks every redirect hop", async () => {
    const lookup: Lookup = async (host) => (host === "internal.example.com" ? ["192.168.0.10"] : ["93.184.216.34"]);
    const fetchImpl = vi.fn(async () => new Response(null, { status: 302, headers: { location: "https://internal.example.com/x" } }));
    await expect(safeFetchText("https://ok.example.com/x.ics", { fetchImpl, lookup })).rejects.toThrow(/not reachable/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns the body for a public host and caps the size", async () => {
    const fetchImpl = vi.fn(async () => ok("BEGIN:VCALENDAR"));
    await expect(safeFetchText("https://ok.example.com/x.ics", { fetchImpl, lookup: publicLookup })).resolves.toBe("BEGIN:VCALENDAR");
    const big = vi.fn(async () => ok("x".repeat(2000)));
    await expect(safeFetchText("https://ok.example.com/x.ics", { fetchImpl: big, lookup: publicLookup, maxBytes: 1000 })).rejects.toThrow(/5 MB/);
  });

  it("explains expired links and timeouts", async () => {
    const gone = vi.fn(async () => new Response("", { status: 403 }));
    await expect(safeFetchText("https://ok.example.com/x.ics", { fetchImpl: gone, lookup: publicLookup })).rejects.toThrow(/expired/);
    const slow = vi.fn((_url: unknown, init?: RequestInit) => new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")))));
    await expect(safeFetchText("https://ok.example.com/x.ics", { fetchImpl: slow as unknown as typeof fetch, lookup: publicLookup, timeoutMs: 20 })).rejects.toThrow(/10 seconds/);
  });
});
