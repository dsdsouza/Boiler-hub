import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { makeHandoffUrl, normalizeFeedUrl, readHandoff } from "@/browser-helper/protocol.js";
import { forgetHelperFeed, HELPER_DRAFT_KEY, readHelperFeed, rememberHelperFeed } from "./helper-handoff";
import { buildArchive, FILES } from "@/scripts/package-calendar-helper.mjs";

const feeds = [
  "https://school.example.edu/d2l/le/calendar/feed/user/feed?token=fictional",
  "https://school.example.edu/feeds/calendars/user_fake.ics",
  "https://school.example.edu/calendar/export_execute.php?authtoken=fake&userid=1",
  "https://school.example.edu/webapps/calendar/calendarFeed/fake/learn.ics",
  "webcal://school.example.edu/schedule.ics",
  "webcal://school.example.edu/subscription/opaque",
];
function storage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
}

describe("browser helper handoff", () => {
  it.each(feeds)("round-trips a real LMS URL shape without placing its secret in a request: %s", (feed) => {
    const url = new URL(makeHandoffUrl(feed));
    expect(url.origin).toBe("https://boilerhub.work");
    expect(url.pathname).toBe("/calendar-helper");
    expect(url.search).toBe("");
    expect(url.pathname + url.search).not.toContain("fictional");
    expect(readHandoff(url.hash)).toBe(normalizeFeedUrl(feed));
  });
  it.each(["javascript:alert(1)", "http://school.edu/feed.ics", "https://user:pass@school.edu/feed.ics", "https://localhost/feed.ics", "https://localhost./feed.ics", "https://127.1/feed.ics", "https://[::1]/feed.ics", "https://school.internal/feed.ics", "https://school.edu:8443/feed.ics", "https://school.edu/feed.ics#password", "https://school.edu/login", "https://school.edu/" + "x".repeat(2048)])("rejects unsafe or non-feed URLs", (value) => {
    expect(normalizeFeedUrl(value)).toBeNull();
    expect(() => makeHandoffUrl(value)).toThrow();
  });
  it("rejects malformed handoffs and non-string inputs", () => {
    for (const hash of ["#feed=%", "#feed=javascript%3Aalert(1)", "#access_token=private", "#feed=" + "x".repeat(9000)]) expect(readHandoff(hash)).toBeNull();
    expect(normalizeFeedUrl(null)).toBeNull();
    expect(readHandoff(null)).toBeNull();
  });
  it("retains one tab-scoped draft during sign-in and clears on discard/success", () => {
    const cache = storage();
    expect(rememberHelperFeed(cache, feeds[0], 1000)).toBe(feeds[0]);
    expect(readHelperFeed(cache, 1010)).toBe(feeds[0]);
    forgetHelperFeed(cache);
    expect(readHelperFeed(cache, 1010)).toBeNull();
  });
  it("expires drafts and rejects malformed/tampered state", () => {
    const cache = storage();
    rememberHelperFeed(cache, feeds[0], 1000);
    expect(readHelperFeed(cache, 601000)).toBeNull();
    expect(cache.getItem(HELPER_DRAFT_KEY)).toBeNull();
    for (const value of [JSON.stringify({url:"javascript:alert(1)",expires:600000}),JSON.stringify({url:feeds[0],expires:999999999}),"null","{}","{invalid"]) {
      cache.setItem(HELPER_DRAFT_KEY,value); expect(readHelperFeed(cache,1000)).toBeNull();
    }
  });
  it("does not block a review when tab storage is unavailable", () => {
    const cache = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
    expect(rememberHelperFeed(cache,feeds[0])).toBe(feeds[0]);
    expect(readHelperFeed(cache)).toBeNull();
    expect(() => forgetHelperFeed(cache)).not.toThrow();
  });
});

describe("distributable extension", () => {
  it("requests only user-invoked page access and blocks network requests", () => {
    const manifest = JSON.parse(readFileSync("browser-helper/manifest.json", "utf8"));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(["activeTab","scripting"]);
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.content_scripts).toBeUndefined();
    expect(manifest.background).toBeUndefined();
    expect(manifest.content_security_policy.extension_pages).toContain("connect-src 'none'");
  });
  it("ships an up-to-date, deterministic ZIP containing the exact reviewed source files", () => {
    const archive = buildArchive(process.cwd());
    expect(archive.equals(readFileSync("public/downloads/boiler-calendar-helper.zip"))).toBe(true);
    let offset = 0;
    const names: string[] = [];
    while (archive.readUInt32LE(offset) === 0x04034b50) {
      const packedSize=archive.readUInt32LE(offset+18), nameSize=archive.readUInt16LE(offset+26), extraSize=archive.readUInt16LE(offset+28);
      const name=archive.subarray(offset+30,offset+30+nameSize).toString();
      const dataStart=offset+30+nameSize+extraSize;
      const content=inflateRawSync(archive.subarray(dataStart,dataStart+packedSize));
      expect(content.equals(readFileSync(name.replace("boiler-calendar-helper/","browser-helper/")))).toBe(true);
      names.push(name);offset=dataStart+packedSize;
    }
    expect(names).toEqual(FILES.map((f: string)=>`boiler-calendar-helper/${f}`));
    expect(archive.readUInt32LE(offset)).toBe(0x02014b50);
    expect(archive.readUInt32LE(archive.length-22)).toBe(0x06054b50);
  });
});
