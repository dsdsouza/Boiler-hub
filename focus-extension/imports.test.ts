import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { appDestination, calendarNavigation, reviewDestination } from "./imports.mjs";
import { buildArchive, FILES } from "../scripts/package-focus-extension.mjs";

it("opens the paired app and keeps private feed data out of requests and sign-in query strings", () => {
  const feed = "https://school.example.edu/d2l/le/calendar/feed/user.ics?token=fictional";
  const url = new URL(reviewDestination("https://boilerplate.zhomander.workers.dev/demo#maya", feed));
  expect(url.origin).toBe("https://boilerplate.zhomander.workers.dev");
  expect(url.pathname).toBe("/calendar-helper");
  expect(url.search).toBe("");
  expect(decodeURIComponent(url.hash.slice(6))).toBe(feed);
  expect(appDestination("https://boilerhub.work/boiler", "/settings/sources")).toBe("https://boilerhub.work/settings/sources");
  expect(appDestination("http://localhost:3100/boiler")).toBe("http://localhost:3100/boiler");
  expect(appDestination("https://boilerhub.work.attacker.example/")).toBe("https://boilerplate.zhomander.workers.dev/boiler");
  expect(() => reviewDestination(null, "https://localhost/private.ics")).toThrow();
  expect(() => reviewDestination(null, "javascript:alert(1)")).toThrow();
});

it("keeps school navigation on the scanned school's HTTPS host", () => {
  expect(calendarNavigation([{ host: "school.example.edu", navigation: [
    { url: "https://school.example.edu/d2l/le/calendar" },
    { url: "https://attacker.example/calendar" },
    { url: "https://name:secret@school.example.edu/calendar" },
    { url: "javascript:alert(1)" },
    { url: "http://school.example.edu/calendar" },
  ] }])).toEqual(["https://school.example.edu/d2l/le/calendar"]);
});

it("ships the canonical finder, exact popup source and only gesture-scoped page scanning permissions", () => {
  const root = resolve(".");
  expect(readFileSync(resolve(root, "public/downloads/boilerplate-focus-extension.zip"))).toEqual(buildArchive(root));
  for (const name of ["scan.js", "protocol.js"])
    expect(readFileSync(resolve(root, "focus-extension/imports", name))).toEqual(readFileSync(resolve(root, "browser-helper", name)));
  const manifest = JSON.parse(readFileSync(resolve(root, "focus-extension/manifest.json"), "utf8"));
  expect(manifest.action.default_popup).toBe("popup.html");
  expect(manifest.permissions).toEqual(["declarativeNetRequest", "storage", "alarms", "tabs", "notifications", "activeTab", "scripting"]);
  expect(manifest.host_permissions).toHaveLength(5);
  expect(FILES.some((file: string) => file.includes(".test."))).toBe(false);
});
