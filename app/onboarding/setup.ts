import type { BoilerResponse } from "@/lib/pressure/api-types";

export const PIP_SETUP_VERSION = "0.3.2";
export function supportsSetup(version: string): boolean {
  if (!/^\d+\.\d+\.\d+$/.test(version)) return false;
  const actual = version.split(".").map(Number);
  const minimum = PIP_SETUP_VERSION.split(".").map(Number);
  for (let i = 0; i < minimum.length; i++) {
    if (actual[i] !== minimum[i]) return actual[i] > minimum[i];
  }
  return true;
}
export function courseworkSources(boiler: BoilerResponse | null) {
  return boiler?.sources.filter((s) => s.kind === "ics" && s.coursework) ?? [];
}
export function courseworkReady(boiler: BoilerResponse | null) {
  const sources = courseworkSources(boiler);
  return sources.length > 0 && sources.every((s) => s.status === "ok" && !!s.lastSyncedAt);
}
export function courseworkDeadlines(boiler: BoilerResponse | null) {
  const ids = new Set(courseworkSources(boiler).map((s) => s.id));
  return (boiler?.tasks ?? []).filter((t) => t.sourceId && ids.has(t.sourceId))
    .sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999") || a.id.localeCompare(b.id));
}
export interface SetupCheck {
  boiler: BoilerResponse;
  reviewReceipt: string | null;
}
