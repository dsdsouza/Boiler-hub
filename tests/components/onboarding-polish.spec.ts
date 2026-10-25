import { test, expect, type Page } from "@playwright/test";
import { parseDraft, stepsFor, type StepId } from "../../app/onboarding/model";
import { world } from "../workflows/local/world";

const next = (page: Page) => page.getByRole("button", { name: "Continue", exact: true });
const title = (page: Page) => page.locator("[data-onboarding] h1");
function draftAt(current: StepId) {
  const draft = parseDraft({ ownerId: "00000000-0000-4000-a000-000000000001", role: "other", name: "Josh", goal: "balance", starting: "fresh", current });
  draft.completed = stepsFor(draft).slice(0, stepsFor(draft).indexOf(current));
  return draft;
}

test("onboarding keeps the requested copy and puts the small bold count below the bar", async ({ page, context }) => {
  const service = world(); await service.connect(context);
  await page.goto("/qa-workflows?view=onboarding&guest=1");
  await expect(title(page)).toHaveText("Who are we setting up for?");
  await expect(page.getByText("A few small questions. A clearer picture of your week.")).toHaveCount(0);
  await expect(page.getByText("Your progress stays with you")).toHaveCount(0);
  await expect(page.getByText("About you", { exact: true })).toHaveCount(0);
  const count = page.getByText("1 of 12", { exact: true });
  await expect(count).toBeVisible();
  const countStyle = await count.evaluate(el => ({ weight: getComputedStyle(el).fontWeight, size: parseFloat(getComputedStyle(el).fontSize), top: el.getBoundingClientRect().top }));
  expect(Number(countStyle.weight)).toBeGreaterThanOrEqual(700);
  expect(countStyle.size).toBeLessThan(12);
  expect(countStyle.top).toBeGreaterThan((await page.getByRole("progressbar").boundingBox())!.y);
  await expect(next(page)).toBeDisabled();
  await page.getByRole("button", { name: "Other Organizing my life!", exact: true }).click();
  await next(page).click();
  const name = page.getByRole("textbox", { name: "Your name", exact: true });
  await expect(name).toHaveAttribute("placeholder", "e.g. Josh");
  await name.fill("Josh");
  await expect(name).toBeFocused();
  expect(await name.evaluate(el => getComputedStyle(el).outlineStyle)).toBe("none");
  expect(await name.evaluate(el => getComputedStyle(el).boxShadow)).toBe("none");
  await next(page).click();
  await expect(title(page)).toHaveText("Heyo Josh! What would you like a hand with?");
  await expect(page.getByRole("button", { name: "Understand my workload", exact: true })).toBeVisible();
  await expect(page.getByText("Spot a heavy week while there is time to adjust.")).toHaveCount(0);
  await page.getByRole("button", { name: "Understand my workload", exact: true }).click();
  await next(page).click();
  await expect(title(page)).toHaveText("Where are you starting from?");
  await expect(page.getByRole("button", { name: "I’m starting fresh", exact: true })).toBeVisible();
  await expect(page.getByText("Let’s build this up one step at a time.")).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("starting.png"), fullPage: true });
});

test("scrolling and swiping never change steps, while buttons retain answers", async ({ page, context }) => {
  const service = world(); await service.connect(context);
  service.users[0].onboarding = draftAt("starting");
  await page.goto("/qa-workflows?view=onboarding");
  await expect(title(page)).toHaveText("Where are you starting from?");
  await page.waitForTimeout(300);
  await title(page).hover();
  await page.mouse.wheel(0, -180);
  await page.waitForTimeout(300);
  await expect(title(page)).toHaveText("Where are you starting from?");
  if (await page.evaluate(() => "Touch" in window)) {
    await title(page).dispatchEvent("touchstart", { touches: [{ identifier: 1, clientX: 120, clientY: 160 }] });
    await title(page).dispatchEvent("touchend", { changedTouches: [{ identifier: 1, clientX: 120, clientY: 300 }] });
    await expect(title(page)).toHaveText("Where are you starting from?");
  }
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(title(page)).toHaveText("Heyo Josh! What would you like a hand with?");
  await page.waitForTimeout(300);
  await title(page).hover();
  await page.mouse.wheel(0, 180);
  await page.waitForTimeout(300);
  if (await page.evaluate(() => "Touch" in window)) {
    await title(page).dispatchEvent("touchstart", { touches: [{ identifier: 1, clientX: 120, clientY: 300 }] });
    await title(page).dispatchEvent("touchend", { changedTouches: [{ identifier: 1, clientX: 120, clientY: 160 }] });
  }
  await expect(title(page)).toHaveText("Heyo Josh! What would you like a hand with?");
  await expect(page.locator("[data-onboarding] h1")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "I already use a calendar", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Understand my workload", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await next(page).click();
  await expect(title(page)).toHaveText("Where are you starting from?");
  expect(await title(page).evaluate(el => el.closest("section")!.parentElement!.scrollTop)).toBe(0);
  await expect(page.getByRole("button", { name: "I’m starting fresh", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(title(page)).toHaveText("Heyo Josh! What would you like a hand with?");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Your name", exact: true })).toHaveValue("Josh");
});

test("a failed Pip check can be deferred explicitly and setup still completes after reload", async ({ page, context }) => {
  const service = world(); await service.connect(context, "lead", false);
  service.users[0].onboarding = draftAt("extension");
  await page.goto("/qa-workflows?view=onboarding");
  await expect(title(page)).toHaveText("Meet Pip in your browser.");
  await expect(page.getByText("Extension not detected in this browser", { exact: true })).toBeVisible();
  await expect(page.getByText("Unzip the download.", { exact: true })).toBeHidden();
  await page.getByText("Installation steps", { exact: true }).click();
  await expect(page.getByText("Unzip the download.", { exact: true })).toBeVisible();
  await page.getByText("Installation steps", { exact: true }).click();
  await expect(next(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Complete Pip setup later?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(service.users[0].onboarding?.extensionDeferred).toBe(false);
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await dialog.getByRole("button", { name: "Complete later", exact: true }).click();
  await expect(title(page)).toHaveText("Bring your week into view");
  await expect.poll(() => service.users[0].onboarding?.extensionDeferred).toBe(true);
  await page.reload();
  await expect(title(page)).toHaveText("Bring your week into view");
  await page.getByRole("button", { name: "Skip for now", exact: true }).click();
  await expect(title(page)).toHaveText("How are you showing up today?");
  await next(page).click();
  await page.getByRole("button", { name: "Skip for now", exact: true }).click();
  await expect(title(page)).toHaveText("A starting point, just for you.");
  await expect(page.getByRole("button", { name: "Finish setup", exact: true })).toBeDisabled();
  await page.getByRole("textbox", { name: "Your first task", exact: true }).fill("Plan my week");
  await page.route("**/boiler", route => route.fulfill({ contentType: "text/html", body: "<h1>My Boiler destination</h1>" }));
  await page.getByRole("button", { name: "Finish setup", exact: true }).click();
  await expect(page).toHaveURL(/\/boiler$/);
  await expect(page.getByRole("heading", { name: "My Boiler destination", exact: true })).toBeVisible();
  expect(service.users[0].onboarding).toMatchObject({ finished: true, extensionDeferred: true, name: "Josh" });
  expect(service.users[0].onboarding?.completed).not.toContain("reading");
  expect(service.users[0].tasks).toHaveLength(1);
  expect(service.users[0].tasks[0]).toMatchObject({ title: "Plan my week", source: "manual" });
});

test("the last page saves a manual task, retries safely, and opens My Boiler directly", async ({ page, context }) => {
  const service = world(); await service.connect(context, "lead", false);
  const draft = { ...draftAt("recommendation"), extensionDeferred: true, goal: "focus" as const };
  draft.completed = stepsFor(draft).slice(0, -1);
  service.users[0].onboarding = draft;
  await page.goto("/qa-workflows?view=onboarding");
  await expect(title(page)).toHaveText("A starting point, just for you.");
  for (const text of ["Here’s where we’ll begin, Josh.", "Pip setup saved for later", "A little space for focused work", "You can change your setup later. Your team visibility starts hidden.", "Your boiler is ready."])
    await expect(page.getByText(text, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Set up Pip", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Step \d+: Your boiler is ready/ })).toHaveCount(0);
  await expect(page.locator('section svg[width="96"] .mp-wave')).toBeVisible();
  const finish = page.getByRole("button", { name: "Finish setup", exact: true });
  await expect(finish).toBeDisabled();
  await page.getByRole("textbox", { name: "Your first task", exact: true }).fill("Write my project outline");
  await page.getByLabel("Due date (optional)", { exact: true }).fill("2026-11-02");
  await expect.poll(() => service.users[0].onboarding?.deadline).toBe("2026-11-02");
  await expect(page.getByRole("status").filter({ hasText: "Saving answers…" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Your first task", exact: true })).toHaveValue("Write my project outline");
  await expect(page.getByLabel("Due date (optional)", { exact: true })).toHaveValue("2026-11-02");
  await page.screenshot({ path: test.info().outputPath("final-manual-task.png"), fullPage: true });
  await page.route("**/boiler", route => route.fulfill({ contentType: "text/html", body: "<h1>My Boiler destination</h1>" }));
  service.failOnce("PATCH /api/me/onboarding");
  await finish.click();
  await expect(page.getByRole("alert").filter({ hasText: "Workflow service temporarily unavailable" })).toBeVisible();
  expect(service.users[0].onboarding?.finished).toBe(false);
  await expect(page.getByRole("textbox", { name: "Your first task", exact: true })).toHaveValue("Write my project outline");
  await finish.click();
  await expect(page).toHaveURL(/\/boiler$/);
  expect(service.users[0].tasks).toHaveLength(1);
  expect(service.users[0].tasks[0]).toMatchObject({ title: "Write my project outline", source: "manual", size: "M" });
  expect(service.users[0].tasks[0].dueAt).toBeTruthy();
  expect(await page.evaluate(owner => localStorage.getItem(`boiler:onboarding:v1:pending:${owner}`), service.users[0].id)).toBeNull();
  await page.goto("/qa-workflows?view=onboarding");
  await expect(title(page)).toHaveText("A starting point, just for you.");
  const writes = service.writes.length;
  await page.getByRole("button", { name: "Open my boiler", exact: true }).click();
  await expect(page).toHaveURL(/\/boiler$/);
  expect(service.writes).toHaveLength(writes);
  expect(service.users[0].tasks).toHaveLength(1);
});

test("the first reading follows calendar connection and resumes on its own page", async ({ page, context }) => {
  const service = world(); await service.connect(context);
  service.users[0].onboarding = draftAt("calendar");
  await page.goto("/qa-workflows?view=onboarding");
  await expect(title(page)).toHaveText("Bring your week into view");
  await expect(page.getByText("Google Calendar connected", { exact: true })).toBeVisible();
  await expect(page.getByText("Your first reading", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Workload summary" })).toHaveCount(0);
  // Long connection forms still scroll within the same step.
  await page.getByText("Add a calendar feed", { exact: true }).click();
  await expect(page.getByRole("button", { name: /Step \d+: Anything else on your plate/ })).toHaveCount(0);
  const viewport = title(page).locator("xpath=ancestor::section/..");
  await viewport.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await viewport.hover();
  await page.mouse.wheel(0, 350);
  await expect(title(page)).toHaveText("Bring your week into view");
  await expect.poll(() => viewport.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await next(page).click();
  await expect(title(page)).toHaveText("Your first reading");
  await expect(page.getByRole("list", { name: "Workload summary" })).toBeVisible();
  await expect.poll(() => service.users[0].onboarding?.current).toBe("reading");
  await page.screenshot({ path: test.info().outputPath("first-reading.png"), fullPage: true });
  await page.reload();
  await expect(title(page)).toHaveText("Your first reading");
  await expect(page.getByRole("list", { name: "Workload summary" })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(title(page)).toHaveText("Bring your week into view");
  await next(page).click();
  await expect(title(page)).toHaveText("Your first reading");
  await next(page).click();
  await expect(title(page)).toHaveText("How are you showing up today?");
});

test("Apple Calendar is schedule-only in the merged onboarding connection step and Connect", async ({ page, context }) => {
  const service = world(); await service.connect(context);
  service.users[0].onboarding = draftAt("calendar");
  for (const view of ["onboarding", "sources"]) {
    await page.goto(`/qa-workflows?view=${view}`);
    if (view === "onboarding") await page.getByText("Add a calendar feed", { exact: true }).click();
    else await page.getByRole("tab", { name: "Calendar feed", exact: true }).click();
    await page.getByRole("combobox", { name: "Calendar provider", exact: true }).selectOption("apple");
    await expect(page.getByText(/Events stay off your task list/)).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Coursework feed: all-day entries are deadlines", exact: true })).toHaveCount(0);
    await expect(page.getByText("New feeds start with deadlines due today or later.", { exact: true })).toBeHidden();
    await expect(page.getByRole("textbox", { name: "iCloud public calendar link", exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`apple-${view}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  }
});

test("sign-in confirmation uses the onboarding name and detected Pip keeps Continue", async ({ page, context }) => {
  const service = world(); await service.connect(context);
  service.users[0].onboarding = draftAt("reassurance");
  await page.goto("/qa-workflows?view=onboarding");
  await expect(page.getByText(/It measures load, not how you feel/)).toHaveCount(0);
  await expect(page.getByText(/we’ll bring your week into one place/)).toHaveCount(0);
  await next(page).click();
  await expect(page.getByText("Sign in complete, Josh!", { exact: true })).toBeVisible();
  await expect(page.getByText(/Your answers come with you|Your answers save automatically|Calendar titles and dates are fetched live/)).toHaveCount(0);
  await next(page).click();
  await expect(page.getByText("Pip is installed · v0.3.2", { exact: true })).toBeVisible();
  await expect(next(page)).toBeEnabled();
  await expect(page.getByRole("button", { name: "Skip", exact: true })).toHaveCount(0);
  await next(page).click();
  expect(service.users[0].onboarding?.extensionDeferred).toBe(false);
});
