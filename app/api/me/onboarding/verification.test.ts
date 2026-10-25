import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { BoilerResponse } from "@/lib/pressure/api-types";
vi.mock("server-only", () => ({}));
import { issueReview, verifyReview } from "./verification";

export const courseworkBoiler = () => ({
  sources: [{ id: "school", label: "Brightspace", kind: "ics", coursework: true, status: "ok", lastSyncedAt: "2026-10-24T10:00:00Z", error: null }],
  tasks: [{ id: "school:lab", sourceId: "school", title: "Lab report", dueAt: "2026-11-01T22:00:00Z", course: "Physics" }],
  events: [],
}) as unknown as BoilerResponse;
beforeEach(() => vi.stubEnv("TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64")));
afterEach(() => vi.unstubAllEnvs());
it("binds deadline review to the authenticated owner and unchanged imported contents", () => {
  const boiler = courseworkBoiler();
  const receipt = issueReview("owner", boiler, 1000);
  expect(verifyReview(receipt, "owner", boiler, 2000)).toBe(true);
  expect(verifyReview(receipt, "other-owner", boiler, 2000)).toBe(false);
  expect(verifyReview("forged", "owner", boiler, 2000)).toBe(false);
  boiler.tasks[0].dueAt = "2026-11-03T22:00:00Z";
  expect(verifyReview(receipt, "owner", boiler, 2000)).toBe(false);
});
it("expires reviews and rejects missing, removed or failing coursework feeds", () => {
  const boiler = courseworkBoiler(); const receipt = issueReview("owner", boiler, 1000);
  expect(verifyReview(receipt, "owner", boiler, 1000 + 2 * 3600_000)).toBe(false);
  boiler.sources[0].status = "error";
  expect(issueReview("owner", boiler)).toBeNull();
  expect(verifyReview(receipt, "owner", boiler, 2000)).toBe(false);
  boiler.sources = [];
  expect(issueReview("owner", boiler)).toBeNull();
});
it("allows an explicitly reviewed readable feed with no current deadlines", () => {
  const boiler = courseworkBoiler(); boiler.tasks = [];
  expect(verifyReview(issueReview("owner", boiler), "owner", boiler)).toBe(true);
  boiler.sources[0].coursework = false;
  expect(issueReview("owner", boiler)).toBeNull();
});
