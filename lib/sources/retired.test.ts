import { afterEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/crypto";
import { fetchNewSource, fetchSource, loadSources, toSummary } from "./load";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/crypto", () => ({ decrypt: vi.fn() }));
afterEach(() => vi.clearAllMocks());
const retired = { id: "retired", kind: "github" as const, label: "Old connection", coursework: false, status: "ok" as const, error: null, last_synced_at: null, created_at: "2026-01-01", secret_encrypted: "never-decrypt" };

it("does not decrypt or fetch a retired source, including through the direct validation path", async () => {
  await expect(fetchSource(retired, { now: new Date(), timeZone: "UTC" })).rejects.toThrow("no longer available");
  await expect(fetchNewSource({ id: "retired", kind: "github", label: "Old", coursework: false, secret: "unused" }, new Date())).rejects.toThrow("no longer available");
  expect(decrypt).not.toHaveBeenCalled();
});

it("excludes retired connections from sync without reading their token or reporting an active source", async () => {
  const writes = vi.fn();
  const from = (table: string) => {
    const q = { select: () => q, eq: () => q, order: () => q, update: writes, returns: async () => ({ data: table === "sources" ? [retired] : [], error: null }) };
    return q;
  };
  expect(await loadSources({ from } as unknown as SupabaseClient, "owner", new Date(), "UTC")).toEqual({ items: [], sources: [] });
  expect(decrypt).not.toHaveBeenCalled();
  expect(writes).not.toHaveBeenCalled();
  expect(toSummary(retired)).toMatchObject({ id: "retired", kind: "github", status: "error", error: "This integration has been removed." });
});
