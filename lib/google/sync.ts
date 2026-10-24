import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LoadItem, Size, Status, Weight } from "@/lib/types";
import type { BoilerResponse, CalendarState, OwnerEvent, Task } from "@/lib/pressure/api-types";
import { computePressure, resolveWeight } from "@/lib/pressure/compute";
import { COMPLETED_RELEASE_HOURS } from "@/lib/pressure/config";
import { fetchPrimaryEvents, type GoogleEvent } from "./calendar";
import { GoogleReconnectError, getAccessToken } from "./client";
import { eventKey, normalizeEvents } from "./normalize";

/** GET /api/me/boiler re-saves the snapshot only when it is older than this. */
export const SNAPSHOT_MAX_AGE_MS = 30 * 60 * 1000;

export interface SyncOptions {
  /** `always` (default) upserts the snapshot; `ifStale` only when missing or older than 30 minutes. */
  persist?: "always" | "ifStale";
}

interface TaskRow {
  id: string;
  title: string;
  due_at: string | null;
  size: Size;
  done_at: string | null;
  source: Task["source"];
  assignment_id: string | null;
}

/**
 * Fetch the user's calendar and tasks, compute pressure, and upsert pressure_snapshots.
 *
 * `admin` is the service-role client (google_tokens is service-role only). It bypasses RLS, so the
 * caller MUST have verified who `userId` is: the signed-in user, or a member the caller has just
 * checked lead rights over (CLAUDE.md rule 6). Every query here is scoped to `userId`.
 *
 * When Google needs a reconnect, the result uses tasks only and the snapshot is NOT saved, so teammates
 * keep seeing the last real score instead of a misleadingly low one.
 */
export async function syncUser(
  admin: SupabaseClient,
  userId: string,
  now: Date = new Date(),
  opts: SyncOptions = {},
): Promise<BoilerResponse> {
  const recentDone = new Date(now.getTime() - COMPLETED_RELEASE_HOURS * 60 * 60 * 1000).toISOString();

  const [tasksRes, weightsRes, profileRes, calendar] = await Promise.all([
    admin
      .from("tasks")
      .select("id, title, due_at, size, done_at, source, assignment_id")
      .eq("owner_id", userId)
      .or(`done_at.is.null,done_at.gte.${recentDone}`)
      .returns<TaskRow[]>(),
    admin.from("event_weights").select("series_key, weight").eq("user_id", userId).returns<{ series_key: string; weight: Weight }[]>(),
    admin.from("profiles").select("status, status_note").eq("id", userId).maybeSingle<{ status: Status; status_note: string | null }>(),
    loadCalendar(admin, userId, now),
  ]);
  if (tasksRes.error) throw new Error(`tasks read failed: ${tasksRes.error.message}`);
  if (weightsRes.error) throw new Error(`event_weights read failed: ${weightsRes.error.message}`);
  if (profileRes.error) throw new Error(`profiles read failed: ${profileRes.error.message}`);

  const weights = new Map((weightsRes.data ?? []).map((w) => [w.series_key, w.weight]));
  const eventItems = normalizeEvents(calendar.events, weights);
  const tasks = (tasksRes.data ?? []).map(toTask).sort(byOpenThenDue);
  const items: LoadItem[] = [...eventItems, ...tasks.map(taskItem)];

  const result = computePressure(items, now, { timeZone: calendar.timeZone });
  const computedAt = now.toISOString();

  if (calendar.state === "ok" && (opts.persist !== "ifStale" || (await snapshotIsStale(admin, userId, now)))) {
    const { error } = await admin.from("pressure_snapshots").upsert(
      {
        user_id: userId,
        score: result.score,
        raw: result.raw,
        zone: result.zone,
        counts: result.counts,
        forecast: result.forecast,
        computed_at: computedAt,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(`pressure_snapshots upsert failed: ${error.message}`);
  }

  return {
    result,
    tasks,
    events: eventItems.map((item) => ownerEvent(item, weights)),
    status: { status: profileRes.data?.status ?? "open", note: profileRes.data?.status_note ?? null },
    calendar: calendar.state,
    computedAt,
  };
}

async function loadCalendar(
  admin: SupabaseClient,
  userId: string,
  now: Date,
): Promise<{ state: CalendarState; events: GoogleEvent[]; timeZone: string }> {
  try {
    const token = await getAccessToken(admin, userId, now);
    const week = await fetchPrimaryEvents(token, now);
    return { state: "ok", ...week };
  } catch (e) {
    if (e instanceof GoogleReconnectError) return { state: "reconnect", events: [], timeZone: "UTC" };
    throw e;
  }
}

async function snapshotIsStale(admin: SupabaseClient, userId: string, now: Date): Promise<boolean> {
  const { data } = await admin
    .from("pressure_snapshots")
    .select("computed_at")
    .eq("user_id", userId)
    .maybeSingle<{ computed_at: string }>();
  return !data || now.getTime() - Date.parse(data.computed_at) > SNAPSHOT_MAX_AGE_MS;
}

export function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    dueAt: row.due_at,
    size: row.size,
    doneAt: row.done_at,
    source: row.source,
    assignmentId: row.assignment_id,
  };
}

function taskItem(t: Task): LoadItem {
  return {
    id: t.id,
    kind: "task",
    source: t.source,
    title: t.title,
    due: t.dueAt ?? undefined,
    doneAt: t.doneAt,
    size: t.size,
  };
}

function byOpenThenDue(a: Task, b: Task): number {
  if (!a.doneAt !== !b.doneAt) return a.doneAt ? 1 : -1;
  if (a.doneAt && b.doneAt) return b.doneAt.localeCompare(a.doneAt);
  return (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999");
}

function ownerEvent(item: LoadItem, weights: ReadonlyMap<string, Weight>): OwnerEvent {
  const override = weights.has(eventKey(item.id))
    ? "event"
    : item.isRecurring && weights.has(item.seriesKey!)
      ? "series"
      : null;
  return {
    id: item.id,
    title: item.title,
    start: item.start!,
    end: item.end!,
    weight: resolveWeight(item),
    override,
    seriesKey: item.seriesKey!,
    isRecurring: Boolean(item.isRecurring),
    release: Boolean(item.release),
  };
}
