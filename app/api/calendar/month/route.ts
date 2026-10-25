import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/me/_lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadSources } from "@/lib/sources/load";
import { zonedTime } from "@/lib/sources/ics";
import { calendarDay, parseMonth, shiftMonth, type MonthDeadline } from "@/lib/calendar/month";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const params = new URL(request.url).searchParams;
  const month = params.get("month");
  const date = parseMonth(month);
  const timeZone = params.get("timeZone") || "UTC";
  if (!date || timeZone.length > 100) return json({ error: "Choose a valid calendar month and time zone." }, 400);
  try { new Intl.DateTimeFormat("en-US", { timeZone }); } catch { return json({ error: "Choose a valid time zone." }, 400); }
  try {
    const next = parseMonth(shiftMonth(month!, 1)) ?? { year: date.year + 1, month: 1 };
    const start = zonedTime(date.year, date.month, 1, 0, 0, timeZone);
    const end = zonedTime(next.year, next.month, 1, 0, 0, timeZone);
    const [tasks, ownedSources] = await Promise.all([
      auth.supabase.from("tasks").select("id,title,due_at,source,course", { count: "exact" }).eq("owner_id", auth.user.id).is("done_at", null)
        .gte("due_at", new Date(start).toISOString()).lt("due_at", new Date(end).toISOString()).order("due_at").order("id").limit(1000),
      auth.supabase.from("sources").select("id").eq("user_id", auth.user.id).eq("kind", "ics"),
    ]);
    if (tasks.error || ownedSources.error) throw new Error("Calendar unavailable");
    // Identity is verified above. Privileged source reads are scoped to this owner.
    // Padding handles all-day entries whose feed zone differs from the viewer's.
    const sources = ownedSources.data?.length ? await loadSources(createAdminClient(), auth.user.id, new Date(), timeZone, {
      dateWindow: { from: new Date(start - 2 * 86400000), to: new Date(end + 2 * 86400000) },
    }) : { items: [], sources: [] };
    const deadlines: MonthDeadline[] = [
      ...(tasks.data ?? []).map((task) => ({ id: task.id, title: task.title, dueAt: task.due_at, source: task.source, ...(task.course ? { course: task.course } : {}) })),
      ...sources.items.filter((item) => item.kind === "task" && item.due && !item.doneAt && !item.completedInSource)
        .map((item) => ({ id: item.id, title: item.title, dueAt: item.due!, source: item.source, ...(item.courseName || item.course ? { course: item.courseName || item.course } : {}) })),
    ].filter((task) => Number.isFinite(Date.parse(task.dueAt)) && calendarDay(task.dueAt, timeZone).startsWith(month!));
    return json({ deadlines, unavailableSources: Math.max(0, (ownedSources.data?.length ?? 0) - sources.sources.length) + sources.sources.filter((source) => source.status === "error").length, truncated: (tasks.count ?? 0) > 1000 });
  } catch {
    return json({ error: "Your deadlines couldn’t load. Please try again." }, 503);
  }
}
