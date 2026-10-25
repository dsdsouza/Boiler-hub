import { test, expect, type Page } from "@playwright/test";
import { parseDraft, stepsFor, type OnboardingDraft } from "../../app/onboarding/model";
import { world } from "../workflows/local/world";

const owner = "00000000-0000-4000-a000-000000000001";
const nameField = (page: Page) => page.getByRole("textbox", { name: "Your name", exact: true });
function nameDraft(ownerId = owner, name = "Original name") {
  return parseDraft({ ownerId, role: "professional", name, current: "name", completed: ["identity"] });
}
async function seedTab(page: Page, draft: OnboardingDraft) {
  await page.addInitScript(draft => sessionStorage.setItem("boiler:onboarding:v1", JSON.stringify(draft)), draft);
}

test("sign-in immediately saves the earlier anonymous answers without Continue", async ({ page, context }) => {
  const service = world(); await service.connect(context);
  service.users[0].onboarding = nameDraft();
  const draft = parseDraft({ role: "student", name: "Before signup", goal: "focus", starting: "overwhelmed", current: "account" });
  draft.completed = stepsFor(draft).slice(0, stepsFor(draft).indexOf("account"));
  await seedTab(page, draft);
  await page.goto("/qa-workflows?view=onboarding");
  await expect.poll(() => service.users[0].onboarding?.name).toBe("Before signup");
  expect(service.users[0].onboarding).toMatchObject({ ownerId: owner, role: "student", goal: "focus", starting: "overwhelmed", current: "account", finished: false });
  await expect(page.getByRole("status").filter({ hasText: "All changes saved" })).toBeVisible();
  const fresh = await context.newPage();
  await fresh.goto("/qa-workflows?view=onboarding");
  await expect(fresh.getByRole("heading", { name: "Keep your progress. Connect your calendar.", exact: true })).toBeVisible();
  await fresh.close();
});

test("an older tab cannot overwrite newer answers already saved to the account", async ({ page, context }) => {
  const service = world(); await service.connect(context);
  service.users[0].onboarding = nameDraft(owner, "Newer account answer");
  await seedTab(page, nameDraft(owner, "Stale old tab answer"));
  await page.goto("/qa-workflows?view=onboarding");
  await expect(nameField(page)).toHaveValue("Newer account answer");
  expect(service.users[0].onboarding.name).toBe("Newer account answer");
});

test("signed-in edits autosave without advancing and restore in a new tab", async ({ page, context }) => {
  const service = world(); await service.connect(context); service.users[0].onboarding = nameDraft();
  await page.goto("/qa-workflows?view=onboarding");
  await nameField(page).fill("Saved without Continue");
  await expect.poll(() => service.users[0].onboarding?.name).toBe("Saved without Continue");
  await expect(page.getByRole("heading", { name: "What should Pip call you?", exact: true })).toBeVisible();
  const fresh = await context.newPage();
  await fresh.goto("/qa-workflows?view=onboarding");
  await expect(nameField(fresh)).toHaveValue("Saved without Continue");
  await fresh.close();
});

test("older autosaves cannot overwrite newer typing or Continue", async ({ page, context }) => {
  const service = world(); await service.connect(context); service.users[0].onboarding = nameDraft();
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let started = false;
  await page.route("**/api/me/onboarding", async route => {
    const body = route.request().postDataJSON();
    if (route.request().method() === "PATCH" && body.autosave && !started) {
      started = true; await held;
    }
    await route.fallback();
  });
  await page.goto("/qa-workflows?view=onboarding");
  await nameField(page).fill("First answer");
  await expect.poll(() => started).toBe(true);
  await nameField(page).fill("Latest answer");
  await expect(page.getByRole("status").filter({ hasText: "All changes saved" })).toHaveCount(0);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  release();
  await expect(page.getByRole("heading", { name: "What would you like a hand with?", exact: true })).toBeVisible();
  expect(service.users[0].onboarding).toMatchObject({ name: "Latest answer", current: "goal" });
  await expect(page.getByRole("status").filter({ hasText: "All changes saved" })).toBeVisible();
});

test("failed autosaves show a retry and recover the newest answer", async ({ page, context }) => {
  const service = world(); await service.connect(context); service.users[0].onboarding = nameDraft();
  service.failOnce("PATCH /api/me/onboarding");
  await page.goto("/qa-workflows?view=onboarding");
  await nameField(page).fill("Retry this answer");
  await expect(page.getByRole("alert").filter({ hasText: "haven’t saved to your account yet" })).toBeVisible();
  expect(service.users[0].onboarding.name).toBe("Original name");
  await page.getByRole("button", { name: "Retry saving", exact: true }).click();
  await expect.poll(() => service.users[0].onboarding?.name).toBe("Retry this answer");
  await expect(page.getByRole("status").filter({ hasText: "All changes saved" })).toBeVisible();
});

test("an unsaved answer survives closing a tab and retries for the same account", async ({ page, context }) => {
  const service = world(); await service.connect(context); service.users[0].onboarding = nameDraft();
  let offline = true;
  await context.route("**/api/me/onboarding", route => route.request().method() === "PATCH" && offline
    ? route.fulfill({ status: 503, json: { error: "Offline" } }) : route.fallback());
  await page.goto("/qa-workflows?view=onboarding");
  await nameField(page).fill("Recover after closing");
  await expect(page.getByRole("button", { name: "Retry saving", exact: true })).toBeVisible();
  await page.close(); offline = false;
  const fresh = await context.newPage();
  await fresh.goto("/qa-workflows?view=onboarding");
  await expect(nameField(fresh)).toHaveValue("Recover after closing");
  await expect.poll(() => service.users[0].onboarding?.name).toBe("Recover after closing");
  await fresh.close();
});

test("another account cannot inherit the previous account’s pending answers", async ({ page, context }) => {
  const service = world(); await service.connect(context, "member");
  service.users[1].onboarding = nameDraft(service.users[1].id, "Member answer");
  const privateDraft = nameDraft(owner, "Private lead answer");
  await page.addInitScript(draft => {
    sessionStorage.setItem("boiler:onboarding:v1", JSON.stringify(draft));
    localStorage.setItem(`boiler:onboarding:v1:pending:${draft.ownerId}`, JSON.stringify(draft));
  }, privateDraft);
  await page.goto("/qa-workflows?view=onboarding");
  await expect(nameField(page)).toHaveValue("Member answer");
  await nameField(page).fill("New member answer");
  await expect.poll(() => service.users[1].onboarding?.name).toBe("New member answer");
  expect(service.users[0].onboarding).toBeNull();
});

test("signed-out answers stay local and never start account autosaves", async ({ page, context }) => {
  const service = world(); await service.connect(context);
  await seedTab(page, { ...nameDraft(), ownerId: null });
  await page.goto("/qa-workflows?view=onboarding&guest=1");
  await nameField(page).fill("Anonymous answer");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "What would you like a hand with?", exact: true })).toBeVisible();
  expect(service.writes.filter(write => write.includes("/api/me/onboarding"))).toEqual([]);
  expect(service.users[0].onboarding).toBeNull();
});

test("leaving before the typing delay preserves the latest answer on return", async ({ page, context }) => {
  const service = world(); await service.connect(context); service.users[0].onboarding = nameDraft();
  await page.goto("/qa-workflows?view=onboarding");
  await nameField(page).fill("Left before Continue");
  await page.goto("/qa-workflows?view=teams");
  // Browsers can discard an unloading document's intercepted network request.
  // A fresh tab must still recover the edit, even when that last flush was lost.
  const fresh = await context.newPage();
  await fresh.goto("/qa-workflows?view=onboarding");
  await expect(nameField(fresh)).toHaveValue("Left before Continue");
  await expect.poll(() => service.users[0].onboarding?.name).toBe("Left before Continue");
  await fresh.close();
});

test("a failed initial account read cannot autosave an empty draft over saved answers", async ({ page, context }) => {
  const service = world(); await service.connect(context); service.users[0].onboarding = nameDraft();
  service.failOnce("GET /api/me/onboarding");
  await page.goto("/qa-workflows?view=onboarding");
  await expect(page.getByRole("button", { name: "Try loading again", exact: true })).toBeVisible();
  expect(service.writes.filter(write => write.includes("/api/me/onboarding"))).toEqual([]);
  await page.getByRole("button", { name: "Try loading again", exact: true }).click();
  await expect(nameField(page)).toHaveValue("Original name");
});

test("a status note saves while it is still focused, without blur or Enter", async ({ page, context }) => {
  const service = world(); await service.connect(context);
  const draft = parseDraft({ ...nameDraft(), goal: "balance", starting: "fresh", current: "status" });
  draft.completed = stepsFor(draft).slice(0, stepsFor(draft).indexOf("status"));
  service.users[0].onboarding = draft;
  await page.goto("/qa-workflows?view=onboarding");
  await expect(page.getByRole("heading", { name: "How are you showing up today?", exact: true })).toBeFocused();
  const note = page.getByRole("textbox", { name: "Status note (shown to your teams)", exact: true });
  await note.fill("Save while I’m still typing");
  await expect(note).toBeFocused();
  await expect.poll(() => service.users[0].onboarding?.note).toBe("Save while I’m still typing");
  await expect(note).toBeFocused();
  expect(service.users[0].status.note).toBe("");
});
