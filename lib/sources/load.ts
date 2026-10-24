import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/crypto";
import type { SourceInfo } from "@/lib/pressure/api-types";
import { githubAdapter } from "./github";
import { icsAdapter } from "./ics";
import { applyItemState } from "./state";
import {
  SOURCE_COLUMNS,
  SourceError,
  type AdapterSource,
  type FetchContext,
  type ItemStateRow,
  type SourceAdapter,
  type SourceItem,
  type SourceKind,
  type SourceRow,
} from "./types";

// Runs every source a user has connected. One failing source never fails the sync: it is marked
// status 'error' with a user-facing message, and the others still count.

export const ADAPTERS: Record<SourceKind, SourceAdapter> = { ics: icsAdapter, github: githubAdapter };

/** Best-effort, per server instance (Vercel instances do not share memory). Live items, never persisted. */
const CACHE_TTL_MS: Record<SourceKind, number> = { ics: 5 * 60_000, github: 2 * 60_000 };
const cache = new Map<string, { at: number; items: SourceItem[] }>();

export type SourceSummary = SourceInfo;

export interface LoadedSources {
  /** Items from every healthy source, with the owner's done/size overrides applied. */
  items: SourceItem[];
  sources: SourceSummary[];
}

export interface LoadOptions {
  /** Skip the in-memory cache (Refresh button, adding a source, Test). */
  fresh?: boolean;
  /** Keep the result in the cache (default true). Off when the time zone is only a guess. */
  store?: boolean;
  fetchImpl?: typeof fetch;
}

type SecretRow = SourceRow & { secret_encrypted: string };

export function toSummary(row: SourceRow): SourceSummary {
  return {
    id: row.id,
    kind: row.kind,
    label: row.label,
    coursework: row.coursework,
    status: row.status,
    error: row.error,
    lastSyncedAt: row.last_synced_at,
  };
}

export function errorMessage(e: unknown): string {
  const msg = e instanceof SourceError ? e.message : "Could not sync this source";
  return msg.slice(0, 300);
}

/** Decrypt and fetch one source's items (or reuse a recent fetch). Throws SourceError (or anything) on failure. */
export async function fetchSource(
  row: SecretRow,
  ctx: FetchContext,
  opts: LoadOptions = {},
): Promise<{ items: SourceItem[]; cached: boolean }> {
  const hit = cache.get(row.id);
  if (!opts.fresh && hit && ctx.now.getTime() - hit.at < CACHE_TTL_MS[row.kind]) return { items: hit.items, cached: true };
  const adapter = ADAPTERS[row.kind];
  if (!adapter) throw new SourceError(`${row.kind} sources are not supported yet`);
  let secret: string;
  try {
    secret = decrypt(row.secret_encrypted);
  } catch {
    throw new SourceError("This source's saved credentials could not be read. Remove it and add it again");
  }
  const source: AdapterSource = { id: row.id, kind: row.kind, label: row.label, coursework: row.coursework, secret };
  const items = await adapter.fetchItems(source, ctx);
  if (opts.store !== false) cache.set(row.id, { at: ctx.now.getTime(), items });
  return { items, cached: false };
}

export function forgetSource(id: string) {
  cache.delete(id);
}

/** Fetch a source the caller is known to own, as an AdapterSource (POST validation). */
export async function fetchNewSource(source: AdapterSource, now: Date, timeZone = "UTC"): Promise<SourceItem[]> {
  const adapter = ADAPTERS[source.kind];
  if (!adapter) throw new SourceError(`${source.kind} sources are not supported yet`);
  return adapter.fetchItems(source, { now, timeZone });
}

/**
 * Test one source (POST /api/sources/[id]/test): refetch it, record the outcome, return its items.
 * The caller MUST have checked with the user client that `userId` owns `sourceId`.
 */
export async function testSource(
  admin: SupabaseClient,
  userId: string,
  sourceId: string,
  now: Date,
): Promise<{ summary: SourceSummary; items: SourceItem[] } | null> {
  const { data: row, error } = await admin
    .from("sources")
    .select(`${SOURCE_COLUMNS}, secret_encrypted`)
    .eq("id", sourceId)
    .eq("user_id", userId)
    .maybeSingle<SecretRow>();
  if (error) throw new Error(`sources read failed: ${error.message}`);
  if (!row) return null;

  let items: SourceItem[] = [];
  let message: string | null = null;
  try {
    // Only the count matters here, so a UTC guess for all-day deadlines is fine; do not cache it.
    items = (await fetchSource(row, { now, timeZone: "UTC" }, { fresh: true, store: false })).items;
  } catch (e) {
    message = errorMessage(e);
  }
  const patch = message
    ? { status: "error" as const, error: message }
    : { status: "ok" as const, error: null, last_synced_at: now.toISOString() };
  const { error: writeError } = await admin.from("sources").update(patch).eq("id", row.id).eq("user_id", userId);
  if (writeError) console.error("[sources] status update failed", writeError.message);
  return { summary: toSummary({ ...row, ...patch }), items };
}

/**
 * Load and merge every source for `userId`. `admin` bypasses RLS, so the caller MUST have verified
 * who `userId` is (CLAUDE.md rule 6); every query here is scoped to it.
 */
export async function loadSources(
  admin: SupabaseClient,
  userId: string,
  now: Date,
  timeZone: Promise<string> | string,
  opts: LoadOptions = {},
): Promise<LoadedSources> {
  const [rowsRes, stateRes] = await Promise.all([
    admin.from("sources").select(`${SOURCE_COLUMNS}, secret_encrypted`).eq("user_id", userId).order("created_at").returns<SecretRow[]>(),
    admin
      .from("source_item_state")
      .select("source_id, item_key, done_at, size_override")
      .eq("user_id", userId)
      .returns<ItemStateRow[]>(),
  ]);
  // Sources are optional: if they cannot be read (e.g. 0002 not applied yet), sync without them.
  if (rowsRes.error) {
    console.error("[sources] sources read failed", rowsRes.error.message);
    return { items: [], sources: [] };
  }
  const rows = rowsRes.data ?? [];
  if (rows.length === 0) return { items: [], sources: [] };
  if (stateRes.error) console.error("[sources] source_item_state read failed", stateRes.error.message);
  const state = [...(stateRes.data ?? [])];

  const ctx: FetchContext = { now, timeZone, fetchImpl: opts.fetchImpl };
  const results = await Promise.all(
    rows.map(async (row) => {
      try {
        return { row, ...(await fetchSource(row, ctx, opts)), error: null };
      } catch (e) {
        if (!(e instanceof SourceError)) console.error(`[sources] ${row.kind} source ${row.id} failed`, e);
        return { row, items: [] as SourceItem[], cached: false, error: errorMessage(e) };
      }
    }),
  );

  const syncedAt = now.toISOString();
  const summaries = await Promise.all(
    results.map(async ({ row, cached, error }) => {
      if (cached) return toSummary(row);
      const patch = error
        ? { status: "error" as const, error }
        : { status: "ok" as const, error: null, last_synced_at: syncedAt };
      const next: SourceRow = { ...row, ...patch };
      // Errors are written only when they change; a fresh success always records last_synced_at.
      if (!error || next.status !== row.status || next.error !== row.error) {
        const { error: writeError } = await admin.from("sources").update(patch).eq("id", row.id).eq("user_id", userId);
        if (writeError) console.error("[sources] status update failed", writeError.message);
      }
      return toSummary(next);
    }),
  );

  // Keep completed/cleared feed items reviewable, including earlier automatic backlog clears.
  return { items: applyItemState(results.flatMap((r) => r.items), state, now, { includeCompleted: true }), sources: summaries };
}
