import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadSources } from "@/lib/sources/load";
import type { StudyContext } from "./study";

export interface PipAssignment {
  title: string;
  dueAt: string | null;
  dueLocal?: string | null;
  size: string;
  source: string;
  course: string | null;
}
export interface PipContext {
  study?: StudyContext;
  asOf: string;
  asOfLocal?: string;
  timeZone: string;
  assignments: PipAssignment[];
  totalOpen: number;
  unavailableSources: number;
  truncated: boolean;
}
type TaskRow = { title: string; due_at: string | null; size: string; source: string };

/** userId MUST come from requireUser(). No teammate lookups or client-supplied identity. */
export async function assignmentContext(supabase: SupabaseClient, userId: string, timeZone: string, now = new Date()): Promise<PipContext> {
  const [tasks, ownedSources] = await Promise.all([
    supabase.from("tasks").select("title,due_at,size,source", { count: "exact" })
      .eq("owner_id", userId).is("done_at", null).order("due_at", { nullsFirst: false }).limit(201).returns<TaskRow[]>(),
    supabase.from("sources").select("id").eq("user_id", userId),
  ]);
  if (tasks.error || ownedSources.error) throw new Error("Assignment context unavailable");
  // The authenticated caller owns this resource. loadSources also scopes every privileged
  // query to this verified id, applies completion overrides, and never persists event contents.
  const sources = ownedSources.data?.length
    ? await loadSources(createAdminClient(), userId, now, timeZone)
    : { items: [], sources: [] };
  if (sources.sources.length !== (ownedSources.data?.length ?? 0)) throw new Error("Sources unavailable");
  const imported = sources.items.filter((item) => item.kind === "task" && !item.doneAt && !item.completedInSource);
  const assignments: PipAssignment[] = [
    ...(tasks.data ?? []).map((task) => ({ title: task.title.slice(0, 200), dueAt: task.due_at, size: task.size, source: task.source, course: null })),
    ...imported.map((item) => ({ title: item.title.slice(0, 200), dueAt: item.due ?? null, size: item.size ?? "M", source: item.source, course: item.courseName?.slice(0, 100) ?? null })),
  ].sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"));
  const totalOpen = (tasks.count ?? tasks.data?.length ?? 0) + imported.length;
  const format = new Intl.DateTimeFormat("en-US", { timeZone, dateStyle: "full", timeStyle: "long" });
  return {
    asOf: now.toISOString(), asOfLocal: format.format(now), timeZone,
    assignments: assignments.slice(0, 100).map((assignment) => ({
      ...assignment,
      dueLocal: assignment.dueAt && Number.isFinite(Date.parse(assignment.dueAt))
        ? format.format(new Date(assignment.dueAt)) : null,
    })), totalOpen,
    unavailableSources: sources.sources.filter((source) => source.status === "error").length,
    truncated: totalOpen > 100,
  };
}
