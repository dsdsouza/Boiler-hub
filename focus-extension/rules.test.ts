import { expect, it } from "vitest";
import {
  createRules,
  isApp,
  isDistracting,
  shouldBlock,
  validateSession,
} from "./rules.mjs";
const now = Date.parse("2026-10-24T20:00:00Z");
const session = {
  id: "demo",
  taskId: "task",
  title: "Study",
  goal: "Question one",
  scope: "demo",
  demo: true,
  startAt: now + 10000,
  endAt: now + 70000,
};
it("only blocks opted-in active time and always releases at the deadline", () => {
  expect(validateSession(session, now)).toBe(true);
  expect(shouldBlock(session, now)).toBe(false);
  expect(shouldBlock(session, now + 10000)).toBe(true);
  expect(shouldBlock(session, now + 70000)).toBe(false);
  expect(shouldBlock({ ...session, outcome: "cancelled" }, now + 20000)).toBe(
    false,
  );
  expect(validateSession({ ...session, endAt: now + 10 * 3600000 }, now)).toBe(
    false,
  );
});
it("matches intended domains without blocking school sites, the app, or lookalikes", () => {
  const rules = createRules("chrome-extension://pip/focus.html");
  expect(rules).toHaveLength(5);
  expect(rules[0].action.redirect.regexSubstitution).toBe(
    "chrome-extension://pip/focus.html#\\0",
  );
  expect(rules[0].condition.requestDomains).toEqual(["youtube.com"]);
  expect(isDistracting("https://www.youtube.com/watch?v=demo")).toBe(true);
  expect(isDistracting("https://youtube.com.attacker.example")).toBe(false);
  expect(isDistracting("https://boilerhub.work/boiler")).toBe(false);
  expect(isDistracting("https://stonybrook.instructure.com")).toBe(false);
  expect(isApp("https://boilerhub.work/demo")).toBe(true);
  expect(isApp("https://boilerplate.zhomander.workers.dev/boiler")).toBe(true);
  expect(isApp("http://localhost:3100/demo")).toBe(true);
  expect(isApp("https://boilerhub.work.evil.example")).toBe(false);
});
