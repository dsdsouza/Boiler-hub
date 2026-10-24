import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LoadItem, Size, Status, Weight } from "@/lib/types";
import type { BoilerResponse, CalendarState, OwnerEvent, Task } from "@/lib/pressure/api-types";
import { computePressure, resolveWeight } from "@/lib/pressure/compute";
import { COMPLETED_RELEASE_HOURS } from "@/lib/pressure/config";
import { loadSources, type LoadedSources } from "@/lib/sources/load";
import type { SourceItem } from "@/lib/sources/types";
import { fetchPrimaryEvents, type GoogleEvent } from "./calendar";
import { GoogleReconnectError, getAccessToken } from "./client";
import { eventKey, normalizeEvents } from "./normalize";

/** GET /api/me/boiler re-saves the snapshot only when it is older than this. */
export const SNAPSHOT_MAX_AGE_MS = 30 * 60 * 1000;

export interface SyncOptions {
  /** `always` (default) upserts the snapshot; `ifStale` only when missing or older than 30 minutes. */
  persist?: "always" | "ifStale";
  /** Refetch every source instead of reusing a fetch from the last few minutes (Refresh, new source). */
  freshSources?: boolean;
}

interface TaskRow {
  id: string;
  title: string;
  due_at: string | null;
  size: Size;
  done_at: string | null;
  source: Task["source"];
  assignment_id: string | null;
  course: string | null;
  /** Embedded on sync's read: the assignment's team, for team tasks. */
  team_assignments?: { team_id: string } | null;
}

/** tasks columns the routes select and return through toTask. */
export const TASK_COLUMNS = "id, title, due_at, size, done_at, source, assignment_id, course";

/**
 * Fetch the user's calendar, tasks and connected sources (ICS, GitHub), compute pressure, and upsert
 * pressure_snapshots. A failing source is marked 'error' and skipped; it never fails the sync.
 *
 * `admin` is the service-role client (google_tokens is service-role only). It bypasses RLS, so the
 * caller MUST have verified who `userId` is: the signed-in user, or a member the caller has just
 * checked lead rights over (CLAUDE.md rule 6). Every query here is scoped to `userId`.
 *
 * When Google needs a reconnect or is unavailable, the result uses tasks only and the snapshot is NOT
 * saved, so teammates keep seeing the last real score instead of a misleadingly low one.
 */
export async function syncUser(
  admin: SupabaseClient,
  userId: string,
  now: Date = new Date(),
  opts: SyncOptions = {},
): Promise<BoilerResponse> {
  const recentDone = new Date(now.getTime() - COMPLETED_RELEASE_HOURS * 60 * 60 * 1000).toISOString();

  const calendarP = loadCalendar(admin, userId, now);
  // Sources fetch in parallel with Google; only all-day deadlines wait for the calendar's zone.
  const timeZone = calendarP.then(
    (c) => c.timeZone,
    () => "UTC",
  );
  const sourcesP = loadSources(admin, userId, now, timeZone, { fresh: opts.freshSources }).catch((e): LoadedSources => {
    console.error("[sync] sources failed", e);
    return { items: [], sources: [] };
  });

  const [tasksRes, weightsRes, profileRes, teamsRes, calendar, sources] = await Promise.all([
    admin
      .from("tasks")
      .select(`${TASK_COLUMNS}, team_assignments(team_id)`)
      .eq("owner_id", userId)
      .or(`done_at.is.null,done_at.gte.${recentDone}`)
      .returns<TaskRow[]>(),
    admin.from("event_weights").select("series_key, weight").eq("user_id", userId).returns<{ series_key: string; weight: Weight }[]>(),
    admin.from("profiles").select("status, status_note").eq("id", userId).maybeSingle<{ status: Status; status_note: string | null }>(),
    // Team names label team tasks. Only teams the user is still a member of, as RLS would allow.
    admin
      .from("memberships")
      .select("team_id, teams(name)")
      .eq("user_id", userId)
      .returns<{ team_id: string; teams: { name: string } | null }[]>(),
    calendarP,
    sourcesP,
  ]);
  if (tasksRes.error) throw new Error(`tasks read failed: ${tasksRes.error.message}`);
  if (weightsRes.error) throw new Error(`event_weights read failed: ${weightsRes.error.message}`);
  if (profileRes.error) throw new Error(`profiles read failed: ${profileRes.error.message}`);
  // Labels are optional: without them, team tasks just show no course.
  if (teamsRes.error) console.error("[sync] team names read failed", teamsRes.error.message);
  const teamNames = new Map((teamsRes.data ?? []).flatMap((m) => (m.teams?.name ? [[m.team_id, m.teams.name] as const] : [])));

  const weights = new Map((weightsRes.data ?? []).map((w) => [w.series_key, w.weight]));
  const eventItems = [
    ...normalizeEvents(calendar.events, weights),
    ...sources.items.filter((i) => i.kind === "event").map((i) => withWeight(i, weights)),
  ];
  const eventCourses = new Map(sources.items.flatMap((i) => (i.kind === "event" && i.course ? [[i.id, i.course] as const] : [])));
  const labels = new Map(sources.sources.map((s) => [s.id, s.label]));
  const tasks = [
    ...(tasksRes.data ?? []).map((row) => toTask(row, teamNames)),
    ...sources.items.filter((i) => i.kind === "task").map((i) => sourceTask(i, labels.get(i.sourceId))),
  ].sort(byOpenThenDue);
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
    timeZone: calendar.timeZone,
    result,
    tasks,
    events: eventItems.map((item) => ownerEvent(item, weights, eventCourses.get(item.id))),
    status: { status: profileRes.data?.status ?? "open", note: profileRes.data?.status_note ?? null },
    calendar: calendar.state,
    sources: sources.sources,
    computedAt,
  };
}

async function loadCalendar(
  admin: SupabaseClient,
  userId: string,
  now: Date,
): Promise<{ state: CalendarState; events: GoogleEvent[]; timeZone: string; reportedTimeZone?: string }> {
  try {
    const token = await getAccessToken(admin, userId, now);
    const week = await fetchPrimaryEvents(token, now);
    return { state: "ok", ...week };
  } catch (e) {
    if (e instanceof GoogleReconnectError) return { state: "reconnect", events: [], timeZone: "UTC" };
    // Anything else (Google 5xx, network, a failed token refresh) is treated like a reconnect
    // for this sync: tasks-only result, no snapshot saved, and the page still renders.
    console.error(`[sync] Google Calendar unavailable for ${userId}`, e);
    return { state: "unavailable", events: [], timeZone: "UTC" };
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

/** A tasks row as a Task. Team tasks are labelled with their team's name, others with their own course. */
export function toTask(row: TaskRow, teamNames?: ReadonlyMap<string, string>): Task {
  const teamId = row.team_assignments?.team_id;
  const course = row.course ?? (teamId ? teamNames?.get(teamId) : undefined);
  return {
    id: row.id,
    title: row.title,
    dueAt: row.due_at,
    size: row.size,
    doneAt: row.done_at,
    source: row.source,
    assignmentId: row.assignment_id,
    ...(course ? { course } : {}),
  };
}

function sourceTask(item: SourceItem, label: string | undefined): Task {
  return {
    id: item.id,
    title: item.title,
    dueAt: item.due ?? null,
    size: item.size ?? "M",
    doneAt: item.doneAt ?? null,
    source: item.source,
    assignmentId: null,
    sourceId: item.sourceId,
    itemKey: item.itemKey,
    ...(label ? { sourceLabel: label } : {}),
    ...(item.url ? { url: item.url } : {}),
    ...(item.course ? { course: item.course } : {}),
    ...(item.courseName ? { courseName: item.courseName } : {}),
    ...(item.completedInSource ? { completedInSource: true } : {}),
  };
}

/** Source events take the owner's Light/Normal/Heavy tags the same way Google events do. */
function withWeight(item: SourceItem, weights: ReadonlyMap<string, Weight>): LoadItem {
  const weight = weights.get(eventKey(item.id)) ?? (item.isRecurring && item.seriesKey ? weights.get(item.seriesKey) : undefined);
  return weight ? { ...item, weight } : item;
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

function ownerEvent(item: LoadItem, weights: ReadonlyMap<string, Weight>, course: string | undefined): OwnerEvent {
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
    ...(item.attendees !== undefined ? { attendees: item.attendees } : {}),
    ...(item.isOrganizer !== undefined ? { isOrganizer: item.isOrganizer } : {}),
    override,
    seriesKey: item.seriesKey!,
    isRecurring: Boolean(item.isRecurring),
    release: Boolean(item.release),
    ...(course ? { course } : {}),
  };
}
