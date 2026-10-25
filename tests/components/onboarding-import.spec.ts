import { test, expect, type Page } from "@playwright/test";
import { parseDraft, stepsFor } from "../../app/onboarding/model";
import { computePressure } from "../../lib/pressure/compute";
import type { BoilerResponse } from "../../lib/pressure/api-types";
import { world } from "../workflows/local/world";

const next = (page: Page) => page.getByRole("button", { name: "Continue", exact: true });
const title = (page: Page) => page.locator("[data-onboarding] h1");
function student() {
  const draft = parseDraft({ ownerId: "00000000-0000-4000-a000-000000000001", role: "student", name: "Josh", goal: "balance", starting: "calendar", current: "calendar" });
  draft.completed = stepsFor(draft).slice(0, stepsFor(draft).indexOf("calendar"));
  return draft;
}
function imported(): BoilerResponse {
  return {
    calendar: "ok", status: { status: "open", note: null }, computedAt: new Date().toISOString(),
    sources: [{ id: "school", kind: "ics", label: "All classes", coursework: true, status: "ok", error: null, lastSyncedAt: new Date().toISOString() }],
    tasks: ["Physics lab", "Calculus homework", "History essay"].map((name, index) => ({ id: `school:${index}`, sourceId: "school", sourceLabel: "All classes", source: "ics", title: name, course: name.split(" ")[0], dueAt: "2026-11-01T22:00:00Z", size: "M", doneAt: null, assignmentId: null })),
    events: [], result: computePressure([], new Date()),
  };
}
async function addClasses(page: Page) {
  await page.getByText("Add my school calendar or another feed", { exact: true }).click();
  await page.getByRole("textbox", { name: "Brightspace subscription link", exact: true }).fill("https://school.example.edu/calendar/all-classes.ics");
  await page.getByRole("button", { name: "Import schedule", exact: true }).click();
}

test("a completed class import unlocks onboarding without another calendar request", async ({ page, context }) => {
  const service = world(); await service.connect(context);
  service.users[0].onboarding = student();
  let checks = 0;
  await page.route("**/api/me/onboarding/check", route => {
    checks++;
    return checks === 1 ? route.fulfill({ json: { boiler: { ...imported(), sources: [], tasks: [] }, reviewReceipt: null } })
      : route.fulfill({ status: 503, json: { error: "A redundant calendar refresh failed" } });
  });
  await page.route("**/api/sources", route => route.fulfill({ status: 201, json: {
    source: imported().sources[0], itemCount: 3, tasks: 3, events: 0, boiler: imported(), reviewReceipt: "fixture-review",
  } }));
  await page.goto("/qa-workflows?view=onboarding");
  await expect(page.getByRole("button", { name: "Check coursework again", exact: true })).toBeEnabled();
  await addClasses(page);
  await expect(next(page)).toBeEnabled();
  await next(page).click();
  await expect(title(page)).toHaveText("Your first reading");
  await next(page).click();
  await expect(title(page)).toHaveText("Review your imported deadlines.");
  await expect(page.getByRole("list", { name: "Imported coursework deadlines" }).getByRole("listitem")).toHaveCount(3);
  await expect(next(page)).toHaveCount(0);
  await page.getByRole("checkbox", { name: "I reviewed these imported deadlines and checked that the feed covers my courses.", exact: true }).check();
  await next(page).click();
  await expect(title(page)).toHaveText("How are you showing up today?");
  await next(page).click();
  await page.getByRole("button", { name: "Skip for now", exact: true }).click();
  await expect(title(page)).toHaveText("A starting point, just for you.");
  await expect(page.getByRole("button", { name: "Finish setup", exact: true })).toBeEnabled();
  await page.screenshot({ path: test.info().outputPath("all-classes-ready.png"), fullPage: true });
  await page.route("**/boiler", route => route.fulfill({ contentType: "text/html", body: "<h1>My Boiler destination</h1>" }));
  await page.getByRole("button", { name: "Finish setup", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My Boiler destination", exact: true })).toBeVisible();
  expect(service.users[0].onboarding).toMatchObject({ finished: true, courseworkDeferred: false });
  expect(checks).toBe(1);
});

test("a late pre-import check cannot replace the successfully imported classes", async ({ page, context }) => {
  const service = world(); await service.connect(context);
  service.users[0].onboarding = student();
  let release!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  let checks = 0;
  await page.route("**/api/me/onboarding/check", async route => {
    checks++;
    if (checks === 1) {
      await delayed;
      await route.fulfill({ json: { boiler: { ...imported(), sources: [], tasks: [] }, reviewReceipt: null } });
    } else await route.fulfill({ json: { boiler: imported(), reviewReceipt: "fixture-review" } });
  });
  await page.route("**/api/sources", route => route.fulfill({ status: 201, json: {
    source: imported().sources[0], itemCount: 3, tasks: 3, events: 0, boiler: imported(), reviewReceipt: "fixture-review",
  } }));
  await page.goto("/qa-workflows?view=onboarding");
  await expect(page.getByRole("button", { name: "Checking coursework…", exact: true })).toBeDisabled();
  await addClasses(page);
  await expect(next(page)).toBeEnabled();
  const oldCheck = page.waitForResponse("**/api/me/onboarding/check");
  release(); await oldCheck;
  await expect(page.getByText("Coursework verified: All classes. Review its deadlines next.", { exact: true })).toBeVisible();
  await next(page).click();
  await expect(title(page)).toHaveText("Your first reading");
});
