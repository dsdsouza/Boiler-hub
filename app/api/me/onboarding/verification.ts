import "server-only";
import { createHash } from "node:crypto";
import { encrypt, decrypt } from "@/lib/crypto";
import type { BoilerResponse } from "@/lib/pressure/api-types";
import { courseworkSources, courseworkReady, courseworkDeadlines } from "@/app/onboarding/setup";

const REVIEW_TTL = 2 * 60 * 60_000;
function fingerprint(boiler: BoilerResponse) {
  const sources = courseworkSources(boiler).map((s) => [s.id, s.label]).sort();
  const ids = courseworkSources(boiler).map((s) => `${s.id}:`);
  const deadlines = courseworkDeadlines(boiler).map((t) => [t.id, t.title, t.dueAt, t.course ?? t.courseName ?? null]);
  const events = boiler.events.filter((e) => ids.some((id) => e.id.startsWith(id)))
    .map((e) => [e.id, e.title, e.start, e.end, e.course ?? null]).sort();
  return createHash("sha256").update(JSON.stringify({ sources, deadlines, events })).digest("hex");
}
/** Receipt contains only an owner id, digest and time; never event contents or feed credentials. */
export function issueReview(userId: string, boiler: BoilerResponse, now = Date.now()) {
  return courseworkReady(boiler) ? encrypt(JSON.stringify({ purpose: "onboarding-review-v2", userId, digest: fingerprint(boiler), at: now })) : null;
}
export function verifyReview(receipt: unknown, userId: string, boiler: BoilerResponse, now = Date.now()) {
  if (typeof receipt !== "string" || receipt.length > 4096 || !courseworkReady(boiler)) return false;
  try {
    const data = JSON.parse(decrypt(receipt));
    return data.purpose === "onboarding-review-v2" && data.userId === userId &&
      typeof data.at === "number" && data.at <= now && now - data.at < REVIEW_TTL && data.digest === fingerprint(boiler);
  } catch { return false; }
}
