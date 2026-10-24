import { lookup as dnsLookup, resolve4, resolve6 } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { SourceError } from "./types";

// Fetching a user-supplied URL from the server. Guards against SSRF: https only, default port,
// and the host (literal or every address it resolves to) must be a public IP. Redirects are
// followed by hand so each hop is checked again.
//
// Residual risk: fetch() resolves the name again after our check (DNS rebinding). Closing that
// needs a custom dispatcher that pins the checked address; acceptable for read-only GETs.

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 3], // multicast and reserved
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

/** True for loopback, private, link-local, CGNAT, documentation, multicast and reserved addresses. */
export function isBlockedIp(address: string): boolean {
  const v = isIP(address);
  if (v === 4) return blocked.check(address, "ipv4");
  if (v === 6) {
    const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return blocked.check(mapped[1]!, "ipv4");
    return blocked.check(address, "ipv6");
  }
  return true;
}

export type Lookup = (host: string) => Promise<string[]>;

const defaultLookup: Lookup = async (host) => {
  try {
    return (await dnsLookup(host, { all: true, verbatim: true })).map((a) => a.address);
  } catch (error) {
    // Workers supports DNS record resolution, but not the OS-backed lookup API.
    if (!(error instanceof Error) || !/not implemented/i.test(error.message)) throw error;
    const records = await Promise.allSettled([resolve4(host), resolve6(host)]);
    // Reject incomplete DNS checks except when that record family has no records.
    for (const record of records) {
      if (record.status === "rejected" && !["ENODATA", "ENOTFOUND"].includes(record.reason?.code)) {
        throw record.reason;
      }
    }
    return records.flatMap((record) => record.status === "fulfilled" ? record.value : []);
  }
};

/** Normalize a pasted feed URL (webcal:// → https://) and check its shape. Throws SourceError. */
export function parseFeedUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim().replace(/^webcals?:\/\//i, "https://"));
  } catch {
    throw new SourceError("That is not a valid URL");
  }
  if (url.protocol !== "https:") throw new SourceError("The feed URL must start with https:// or webcal://");
  if (url.port && url.port !== "443") throw new SourceError("The feed URL must use the standard https port");
  if (url.username || url.password) throw new SourceError("The feed URL must not contain a username or password");
  return url;
}

async function assertPublicHost(url: URL, lookup: Lookup): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (isBlockedIp(host)) throw new SourceError("That address is not reachable from Boilerplate");
    return;
  }
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new SourceError("That address is not reachable from Boilerplate");
  }
  let addresses: string[];
  try {
    addresses = await lookup(host);
  } catch {
    throw new SourceError(`Could not find ${host}`);
  }
  if (addresses.length === 0 || addresses.some(isBlockedIp)) {
    throw new SourceError("That address is not reachable from Boilerplate");
  }
}

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  fetchImpl?: typeof fetch;
  lookup?: Lookup;
}

/** GET a user-supplied URL as text, with the SSRF checks above, a timeout and a size cap. */
export async function safeFetchText(rawUrl: string, opts: SafeFetchOptions = {}): Promise<string> {
  const { timeoutMs = TIMEOUT_MS, maxBytes = MAX_BYTES, fetchImpl = fetch, lookup = defaultLookup } = opts;
  const signal = AbortSignal.timeout(timeoutMs);
  let url = parseFeedUrl(rawUrl);

  try {
    for (let hop = 0; ; hop++) {
      await assertPublicHost(url, lookup);
      const res = await fetchImpl(url, {
        redirect: "manual",
        signal,
        cache: "no-store",
        headers: { accept: "text/calendar, text/plain;q=0.9, */*;q=0.5", "user-agent": "Boilerplate/1.0 (+calendar feed)" },
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location || hop >= MAX_REDIRECTS) throw new SourceError("The feed redirected too many times");
        url = parseFeedUrl(new URL(location, url).toString());
        continue;
      }
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        throw new SourceError(`The feed returned ${res.status}. The link may have expired: copy a fresh one`);
      }
      if (!res.ok) throw new SourceError(`The feed returned ${res.status}`);
      return await readCapped(res, maxBytes);
    }
  } catch (e) {
    if (e instanceof SourceError) throw e;
    if (signal.aborted) throw new SourceError("The feed took longer than 10 seconds to respond");
    throw new SourceError("Could not reach the feed");
  }
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  const declared = Number(res.headers.get("content-length"));
  if (declared > maxBytes) throw new SourceError("The feed is larger than 5 MB");
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new SourceError("The feed is larger than 5 MB");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
